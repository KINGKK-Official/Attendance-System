from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session


from ..models import database, schemas
from ..services import auth_service

router = APIRouter(prefix="/api/student", tags=["Student"])


def _resolve_student_id(current_user: schemas.User) -> str:
    if not current_user.student_id:
        raise HTTPException(status_code=400, detail="This account is not linked to a student record.")
    return current_user.student_id


@router.get("/dashboard", summary="Per-course attendance summary for the logged-in student")
def student_dashboard(
    db: Session = Depends(database.get_db),
    current_user: schemas.User = Depends(auth_service.check_student),
):
    """
    Returns one card per enrolled course: sessions held, sessions attended,
    percentage, status badge, and a per-week attendance series for charting.
    """
    student_id = _resolve_student_id(current_user)
    enrollments = db.query(schemas.Enrollment).filter(
        schemas.Enrollment.student_id == student_id
    ).all()

    courses_out = []
    for e in enrollments:
        course = db.query(schemas.Course).filter(schemas.Course.id == e.course_id).first()
        if not course:
            continue
        sessions = db.query(schemas.Session).filter(
            schemas.Session.course_id == e.course_id,
            schemas.Session.status == "conducted",
        ).order_by(schemas.Session.session_number).all()
        session_ids = [s.id for s in sessions]
        records = db.query(schemas.AttendanceRecord).filter(
            schemas.AttendanceRecord.session_id.in_(session_ids),
            schemas.AttendanceRecord.student_id == student_id,
        ).all() if session_ids else []
        rec_by_session = {r.session_id: r for r in records}

        total_held = len(session_ids)
        present = sum(1 for r in records if str(r.final_status) in ("Present", "present"))
        pct = (present / total_held * 100.0) if total_held else 0.0

        warning = course.warning_threshold if course.warning_threshold is not None else 80.0
        critical = course.critical_threshold if course.critical_threshold is not None else 75.0
        if pct >= warning:
            status = "safe"
        elif pct >= critical:
            status = "warning"
        else:
            status = "critical"

        # Weekly series
        weekly = {}
        for s in sessions:
            r = rec_by_session.get(s.id)
            attended = 1 if (r and str(r.final_status) in ("Present", "present")) else 0
            wk = weekly.setdefault(s.week_number or 0, {"held": 0, "attended": 0})
            wk["held"] += 1
            wk["attended"] += attended
        weekly_series = [
            {"week": w, "held": v["held"], "attended": v["attended"],
             "percentage": round(v["attended"] / v["held"] * 100.0, 1) if v["held"] else 0.0}
            for w, v in sorted(weekly.items())
        ]

        courses_out.append({
            "course_id": course.id,
            "course_code": course.code,
            "course_name": course.name,
            "sessions_held": total_held,
            "sessions_attended": present,
            "percentage": round(pct, 1),
            "status": status,
            "at_risk": bool(e.at_risk),
            "weekly": weekly_series,
        })

    return {"student_id": student_id, "courses": courses_out}


@router.get("/notifications", summary="In-app notifications for the logged-in student")
def get_notifications(
    db: Session = Depends(database.get_db),
    current_user: schemas.User = Depends(auth_service.check_student),
):
    student_id = _resolve_student_id(current_user)
    notes = db.query(schemas.Notification).filter(
        schemas.Notification.student_id == student_id
    ).order_by(schemas.Notification.created_at.desc()).all()
    return [
        {
            "id": n.id,
            "message": n.message,
            "level": n.level,
            "read": n.read,
            "course_id": n.course_id,
            "created_at": n.created_at,
        }
        for n in notes
    ]


@router.post("/notifications/{notification_id}/read", summary="Mark a notification as read")
def mark_notification_read(
    notification_id: int,
    db: Session = Depends(database.get_db),
    current_user: schemas.User = Depends(auth_service.check_student),
):
    student_id = _resolve_student_id(current_user)
    note = db.query(schemas.Notification).filter(
        schemas.Notification.id == notification_id,
        schemas.Notification.student_id == student_id,
    ).first()
    if not note:
        raise HTTPException(status_code=404, detail="Notification not found")
    note.read = True
    db.commit()
    return {"status": "success"}


@router.get("/audit", summary="Manual overrides applied to the student's own records")
def get_my_audit(
    db: Session = Depends(database.get_db),
    current_user: schemas.User = Depends(auth_service.check_student),
):
    """
    Read-only view of manual overrides affecting this student. Faculty actor
    names are resolved for transparency.
    """
    student_id = _resolve_student_id(current_user)
    rows = db.query(schemas.AttendanceAuditLog).filter(
        schemas.AttendanceAuditLog.target_student_id == student_id,
        schemas.AttendanceAuditLog.action == "manual_override",
    ).order_by(schemas.AttendanceAuditLog.timestamp.desc()).all()

    out = []
    for r in rows:
        actor = db.query(schemas.User).filter(schemas.User.id == r.actor_id).first() if r.actor_id else None
        out.append({
            "timestamp": r.timestamp,
            "session_id": r.session_id,
            "actor_name": actor.full_name if actor else "System",
            "old_value": r.old_value,
            "new_value": r.new_value,
            "reason": r.reason,
        })
    return out
