from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Request, Header
from sqlalchemy.orm import Session
from typing import Optional
from ..models import database, schemas
from ..services import auth_service, attendance_service, audit_service
from pydantic import BaseModel
from datetime import datetime
import io
import uuid
from fpdf import FPDF
from fastapi.responses import StreamingResponse

router = APIRouter(prefix="/api/faculty", tags=["Faculty"])

class SessionStart(BaseModel):
    course_id: int
    room_id: int
    week_number: int
    session_number: int

class AttendanceOverride(BaseModel):
    session_id: int
    student_id: str
    new_status: schemas.AttendanceStatus
    reason: str

@router.get("/courses")
def get_my_courses(db: Session = Depends(database.get_db), faculty: schemas.User = Depends(auth_service.check_faculty)):
    if faculty.role == schemas.UserRole.ADMIN:
        return db.query(schemas.Course).all()
    return db.query(schemas.Course).filter(schemas.Course.faculty_id == faculty.id).all()

@router.post("/sessions/start")
async def start_session(
    data: SessionStart, 
    background_tasks: BackgroundTasks, 
    db: Session = Depends(database.get_db), 
    faculty: schemas.User = Depends(auth_service.check_faculty)
):
    if data.session_number > 32:
        raise HTTPException(status_code=400, detail="Maximum 32 sessions allowed for this course")
        
    session = db.query(schemas.Session).filter(
        schemas.Session.course_id == data.course_id,
        schemas.Session.session_number == data.session_number
    ).first()
    
    is_new = False
    if not session:
        session = schemas.Session(
            course_id=data.course_id,
            room_id=data.room_id,
            week_number=data.week_number,
            session_number=data.session_number,
        )
        db.add(session)
        is_new = True
    elif session.status != "conducted":
        is_new = True
        
    session.actual_start_time = datetime.now()
    session.room_id = data.room_id
    session.status = "conducted"
    
    db.commit()
    db.refresh(session)
    
    # Pre-create attendance records so the UI shows the student list immediately
    enrolled_students = db.query(schemas.Enrollment).filter(schemas.Enrollment.course_id == data.course_id).all()
    for enrollment in enrolled_students:
        existing_record = db.query(schemas.AttendanceRecord).filter(
            schemas.AttendanceRecord.session_id == session.id,
            schemas.AttendanceRecord.student_id == enrollment.student_id
        ).first()
        if not existing_record:
            record = schemas.AttendanceRecord(
                session_id=session.id,
                student_id=enrollment.student_id,
                hit_1_present=None,
                hit_2_present=None,
                final_status=schemas.AttendanceStatus.ABSENT
            )
            db.add(record)
    db.commit()

    # Schedule hits in background only if this is a new session
    if is_new:
        background_tasks.add_task(attendance_service.schedule_hits, session.id)

    # Task 7: audit the session start
    audit_service.write_audit(
        db, action="session_start", actor_id=faculty.id, actor_role=str(faculty.role),
        session_id=session.id, new_value="conducted",
    )

    return {"status": "success", "session_id": session.id, "message": "Attendance session started and hits scheduled."}

@router.get("/sessions/active")
def get_active_session(
    db: Session = Depends(database.get_db),
    faculty: schemas.User = Depends(auth_service.check_faculty)
):
    course_ids = [c.id for c in db.query(schemas.Course).filter(schemas.Course.faculty_id == faculty.id).all()]
    if not course_ids:
        if faculty.role == schemas.UserRole.ADMIN:
            course_ids = [c.id for c in db.query(schemas.Course).all()]
        else:
            return None
            
    active_session = db.query(schemas.Session).filter(
        schemas.Session.course_id.in_(course_ids),
        schemas.Session.status == "conducted"
    ).order_by(schemas.Session.actual_start_time.desc()).first()
    
    if active_session:
        return {"session_id": active_session.id}
    return None

@router.get("/sessions/{session_id}/results")
def get_session_results(
    session_id: int, 
    db: Session = Depends(database.get_db), 
    faculty: schemas.User = Depends(auth_service.check_faculty)
):
    results = db.query(schemas.AttendanceRecord).filter(schemas.AttendanceRecord.session_id == session_id).all()
    # Also get student names for display
    student_results = []
    for r in results:
        student = db.query(schemas.Student).filter(schemas.Student.id == r.student_id).first()
        student_results.append({
            "student_id": r.student_id,
            "full_name": student.full_name if student else "Unknown",
            "hit_1": r.hit_1_present,
            "hit_2": r.hit_2_present,
            "hit_1_confidence": r.hit_1_confidence,
            "hit_2_confidence": r.hit_2_confidence,
            "embedding_confidence": r.embedding_confidence,
            "liveness_score": r.liveness_score,
            "consensus_status": r.consensus_status,
            "requires_review": r.requires_review,
            "status": r.final_status,
            "is_override": r.is_manual_override,
            "reason": r.override_reason
        })
    return student_results


@router.get("/sessions/{session_id}/video", summary="Live annotated video stream")
def get_session_video(
    session_id: int,
    token: str,
    db: Session = Depends(database.get_db)
):
    # Manual token verification for the video stream (since it's an <img> tag)
    payload = auth_service.verify_access_token(token)
    role = payload.get("role") if payload else None
    if not payload or role not in ("FACULTY", "ADMIN"):
        raise HTTPException(status_code=403, detail="Not authorized")
        
    session = db.query(schemas.Session).filter(schemas.Session.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
        
    classroom = db.query(schemas.Classroom).filter(schemas.Classroom.id == session.room_id).first()
    from ..services import camera_service
    camera_url = camera_service.build_rtsp_url(classroom) if classroom else None
    if not camera_url:
        raise HTTPException(status_code=404, detail="Camera not configured for this room")
        
    # Get enrolled students and embeddings
    from ..services.ai_service import get_ai_engine
    from ..services import crypto_service
    ai = get_ai_engine()
    settings = db.query(schemas.SystemSettings).first()
    threshold = settings.face_comparison_threshold if settings and settings.face_comparison_threshold else 0.363
    
    enrolled = db.query(schemas.Enrollment).filter(schemas.Enrollment.course_id == session.course_id).all()
    enrolled_students = []
    for enr in enrolled:
        student = db.query(schemas.Student).filter(schemas.Student.id == enr.student_id).first()
        if student:
            # Decode embedding
            emb = None
            if getattr(student, "face_embedding_enc", None):
                emb = crypto_service.embedding_to_list(student.face_embedding_enc)
            elif student.face_embedding:
                emb = crypto_service.embedding_to_list(student.face_embedding)
                
            if emb:
                enrolled_students.append({
                    "id": student.id,
                    "name": student.full_name,
                    "embedding": emb
                })

    return StreamingResponse(
        camera_service.annotated_mjpeg_generator(
            url=camera_url, 
            enrolled_students=enrolled_students, 
            threshold=threshold, 
            ai_engine=ai, 
            session_id=str(session_id)
        ),
        media_type="multipart/x-mixed-replace; boundary=frame"
    )


@router.get("/sessions/{session_id}/status", summary="Live session status incl. spoof/liveness alerts")
def get_session_status(
    session_id: int,
    db: Session = Depends(database.get_db),
    faculty: schemas.User = Depends(auth_service.check_faculty)
):
    """
    Task 2 — lightweight status the faculty dashboard polls (every ~4s) to learn
    about anti-spoofing alerts in near-real-time without a WebSocket. Returns the
    session's spoof_alert flag and cumulative liveness failure count.
    """
    session = db.query(schemas.Session).filter(schemas.Session.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    review_count = db.query(schemas.AttendanceRecord).filter(
        schemas.AttendanceRecord.session_id == session_id,
        schemas.AttendanceRecord.requires_review == True,  # noqa: E712
    ).count()
    from ..services.attendance_service import ACTIVE_HITS
    return {
        "session_id": session_id,
        "status": session.status,
        "spoof_alert": bool(session.spoof_alert),
        "liveness_fail_count": session.liveness_fail_count or 0,
        "records_requiring_review": review_count,
        "is_capturing": session_id in ACTIVE_HITS,
    }

@router.post("/attendance/override", summary="Manually override a student's attendance (audited)")
def override_attendance(
    data: AttendanceOverride,
    request: Request,
    db: Session = Depends(database.get_db),
    faculty: schemas.User = Depends(auth_service.check_faculty)
):
    """
    Manually set a student's attendance status. A reason of at least 10
    characters is mandatory and the change is written to the append-only
    attendance audit log.
    """
    # Task 7: enforce a meaningful reason at the service boundary
    if not data.reason or len(data.reason.strip()) < 10:
        raise HTTPException(
            status_code=400,
            detail="A reason of at least 10 characters is required for a manual override.",
        )

    record = db.query(schemas.AttendanceRecord).filter(
        schemas.AttendanceRecord.session_id == data.session_id,
        schemas.AttendanceRecord.student_id == data.student_id
    ).first()

    old_value = None
    if not record:
        record = schemas.AttendanceRecord(
            session_id=data.session_id,
            student_id=data.student_id
        )
        db.add(record)
    else:
        old_value = str(record.final_status)

    new_value = data.new_status.value if hasattr(data.new_status, "value") else str(data.new_status)
    record.final_status = new_value
    record.is_manual_override = True
    record.override_reason = data.reason
    record.requires_review = False  # a human decision clears the review flag

    # Task 7: audit row
    audit_service.write_audit(
        db,
        action="manual_override",
        actor_id=faculty.id,
        actor_role=str(faculty.role),
        target_student_id=data.student_id,
        session_id=data.session_id,
        old_value=old_value,
        new_value=new_value,
        reason=data.reason,
        ip_address=request.client.host if request and request.client else None,
        commit=False,
    )
    db.commit()
    return {"status": "success", "message": "Attendance status overridden."}


# ─── Task 4: anti-replay nonce flow ──────────────────────────────────────────
class ExecuteHit(BaseModel):
    session_id: int
    hit_number: int


@router.post("/sessions/{session_id}/hit/{hit_number}", summary="Initiate a hit and receive a one-time nonce")
def initiate_hit(
    session_id: int,
    hit_number: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(database.get_db),
    faculty: schemas.User = Depends(auth_service.check_faculty),
):
    """
    Generate a server-side single-use nonce for the given hit. The client must
    echo this nonce in the `X-Hit-Nonce` header on the subsequent execute-hit
    call, within ±30 seconds, to actually run the hit.
    """
    if hit_number not in (1, 2):
        raise HTTPException(status_code=400, detail="hit_number must be 1 or 2")
    session = db.query(schemas.Session).filter(schemas.Session.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    nonce = str(uuid.uuid4())
    now = datetime.utcnow()
    if hit_number == 1:
        session.hit_nonce_1 = nonce
        session.hit_1_used = False
        session.hit_nonce_1_issued_at = now
    else:
        session.hit_nonce_2 = nonce
        session.hit_2_used = False
        session.hit_nonce_2_issued_at = now
    db.commit()
    return {"nonce": nonce, "server_time": now.isoformat(), "valid_seconds": 30}


@router.post("/sessions/{session_id}/execute-hit", summary="Execute a hit using a valid one-time nonce")
def execute_hit(
    session_id: int,
    data: ExecuteHit,
    background_tasks: BackgroundTasks,
    db: Session = Depends(database.get_db),
    faculty: schemas.User = Depends(auth_service.check_faculty),
    x_hit_nonce: Optional[str] = Header(None),
):
    """
    Validate the supplied X-Hit-Nonce against the session, ensure it has not
    been consumed and is within the ±30s window, then run the hit in the
    background. Replays of a used nonce return HTTP 409.
    """
    session = db.query(schemas.Session).filter(schemas.Session.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if data.hit_number not in (1, 2):
        raise HTTPException(status_code=400, detail="hit_number must be 1 or 2")

    if data.hit_number == 1:
        stored, used, issued = session.hit_nonce_1, session.hit_1_used, session.hit_nonce_1_issued_at
    else:
        stored, used, issued = session.hit_nonce_2, session.hit_2_used, session.hit_nonce_2_issued_at

    if not x_hit_nonce or stored is None or x_hit_nonce != stored:
        raise HTTPException(status_code=401, detail="Invalid or missing hit nonce")
    if used:
        raise HTTPException(status_code=409, detail="This hit nonce has already been used")
    if issued is None or abs((datetime.utcnow() - issued).total_seconds()) > 30:
        raise HTTPException(status_code=401, detail="Hit nonce expired (outside ±30s window)")

    # Consume the nonce
    if data.hit_number == 1:
        session.hit_1_used = True
    else:
        session.hit_2_used = True
    db.commit()

    background_tasks.add_task(attendance_service.process_attendance_hit, session_id, data.hit_number)
    return {"status": "success", "message": f"Hit {data.hit_number} accepted and executing."}


@router.get("/sessions/{session_id}/review-queue", summary="Records flagged for faculty review")
def get_review_queue(
    session_id: int,
    db: Session = Depends(database.get_db),
    faculty: schemas.User = Depends(auth_service.check_faculty),
):
    """
    Task 8 — return all attendance records in this session where
    requires_review is True, with confidence and liveness details.
    """
    records = db.query(schemas.AttendanceRecord).filter(
        schemas.AttendanceRecord.session_id == session_id,
        schemas.AttendanceRecord.requires_review == True,  # noqa: E712
    ).all()
    out = []
    for r in records:
        student = db.query(schemas.Student).filter(schemas.Student.id == r.student_id).first()
        out.append({
            "student_id": r.student_id,
            "full_name": student.full_name if student else "Unknown",
            "hit_1": r.hit_1_present,
            "hit_2": r.hit_2_present,
            "hit_1_confidence": r.hit_1_confidence,
            "hit_2_confidence": r.hit_2_confidence,
            "consensus_status": r.consensus_status,
            "liveness_score": r.liveness_score,
        })
    return out

@router.get("/courses/{course_id}/cumulative")
def get_cumulative_report(
    course_id: int, 
    db: Session = Depends(database.get_db), 
    faculty: schemas.User = Depends(auth_service.check_faculty)
):
    # Get all students enrolled in this course
    enrollments = db.query(schemas.Enrollment).filter(schemas.Enrollment.course_id == course_id).all()
    # Get all sessions for this course
    sessions = db.query(schemas.Session).filter(schemas.Session.course_id == course_id).all()
    session_ids = [s.id for s in sessions]
    
    report = []
    for enr in enrollments:
        student = db.query(schemas.Student).filter(schemas.Student.id == enr.student_id).first()
        # Get attendance records for this student in these sessions
        records = db.query(schemas.AttendanceRecord).filter(
            schemas.AttendanceRecord.session_id.in_(session_ids),
            schemas.AttendanceRecord.student_id == enr.student_id
        ).all()
        
        present_count = sum(1 for r in records if r.final_status == schemas.AttendanceStatus.PRESENT)
        total_sessions = len(session_ids)
        percentage = (present_count / total_sessions * 100) if total_sessions > 0 else 0
        
        report.append({
            "student_id": enr.student_id,
            "full_name": student.full_name if student else "Unknown",
            "total_sessions": total_sessions,
            "present_count": present_count,
            "percentage": f"{percentage:.1f}%",
            "alert": "Below 75%" if percentage < 75 else "Good"
        })
    
    return report

@router.get("/courses/{course_id}/export-pdf")
def export_attendance_pdf(
    course_id: int, 
    db: Session = Depends(database.get_db), 
    faculty: schemas.User = Depends(auth_service.check_faculty)
):
    # 1. Get Data (Reuse logic from get_cumulative_report)
    course = db.query(schemas.Course).filter(schemas.Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
        
    enrollments = db.query(schemas.Enrollment).filter(schemas.Enrollment.course_id == course_id).all()
    sessions = db.query(schemas.Session).filter(schemas.Session.course_id == course_id).all()
    session_ids = [s.id for s in sessions]
    
    # 2. Generate PDF
    pdf = FPDF()
    pdf.add_page()
    
    # Header
    pdf.set_font("Arial", "B", 16)
    pdf.cell(190, 10, "Attendance Report", 0, 1, "C")
    pdf.set_font("Arial", "", 12)
    pdf.cell(190, 10, f"Course: {course.name} ({course.code})", 0, 1, "C")
    pdf.cell(190, 10, f"Generated on: {datetime.now().strftime('%Y-%m-%d %H:%M')}", 0, 1, "C")
    pdf.ln(10)
    
    # Table Header
    pdf.set_fill_color(241, 245, 249)
    pdf.set_font("Arial", "B", 10)
    pdf.cell(30, 10, "Student ID", 1, 0, "C", True)
    pdf.cell(70, 10, "Full Name", 1, 0, "C", True)
    pdf.cell(30, 10, "Present", 1, 0, "C", True)
    pdf.cell(30, 10, "Total", 1, 0, "C", True)
    pdf.cell(30, 10, "Percentage", 1, 1, "C", True)
    
    # Table Rows
    pdf.set_font("Arial", "", 10)
    for enr in enrollments:
        student = db.query(schemas.Student).filter(schemas.Student.id == enr.student_id).first()
        records = db.query(schemas.AttendanceRecord).filter(
            schemas.AttendanceRecord.session_id.in_(session_ids),
            schemas.AttendanceRecord.student_id == enr.student_id
        ).all()
        
        present_count = sum(1 for r in records if r.final_status == schemas.AttendanceStatus.PRESENT)
        total_sessions = len(session_ids)
        percentage = (present_count / total_sessions * 100) if total_sessions > 0 else 0
        
        pdf.cell(30, 10, str(enr.student_id), 1)
        pdf.cell(70, 10, str(student.full_name if student else "Unknown"), 1)
        pdf.cell(30, 10, str(present_count), 1, 0, "C")
        pdf.cell(30, 10, str(total_sessions), 1, 0, "C")
        pdf.cell(30, 10, f"{percentage:.1f}%", 1, 1, "C")
    
    # Output to buffer
    pdf_output = io.BytesIO()
    pdf_content = pdf.output()
    pdf_output.write(pdf_content)
    pdf_output.seek(0)
    
    return StreamingResponse(
        pdf_output, 
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=attendance_report_{course.code}.pdf"}
    )
