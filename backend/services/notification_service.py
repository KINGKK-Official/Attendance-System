"""
Task 9 — Early-warning notification engine.

After a session is finalised, recompute each affected student's attendance
percentage per course and raise warning / critical notifications via two
backends: SMTP email (best-effort) and an in-app Notifications table row.
"""
from __future__ import annotations

import os
import smtplib
import ssl
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional

from sqlalchemy.orm import Session

from ..models import schemas, database

TEMPLATE_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "templates", "email_warning.html")


def _load_email_template() -> str:
    try:
        with open(TEMPLATE_PATH, "r", encoding="utf-8") as fh:
            return fh.read()
    except Exception:
        return (
            "<html><body><h2>Attendance Alert</h2>"
            "<p>Dear {student_name},</p><p>{message}</p>"
            "<p>Current attendance: <b>{percentage:.1f}%</b> in {course_name}.</p>"
            "<p>— IQRA University Attendance System</p></body></html>"
        )


def _student_email(db: Session, student_id: str) -> Optional[str]:
    user = db.query(schemas.User).filter(schemas.User.student_id == student_id).first()
    return user.email if user else None


def send_notification(student_id: str, level: str, message: str,
                      course_id: Optional[int] = None,
                      course_name: str = "", percentage: float = 0.0,
                      db: Optional[Session] = None):
    """Persist an in-app notification and attempt an email. Never raises."""
    own_db = False
    if db is None:
        db = database.SessionLocal()
        own_db = True
    try:
        # In-app notification
        note = schemas.Notification(
            student_id=student_id,
            course_id=course_id,
            message=message,
            level=level,
        )
        db.add(note)
        db.commit()

        # Email (best-effort)
        student = db.query(schemas.Student).filter(schemas.Student.id == student_id).first()
        to_addr = _student_email(db, student_id)
        if to_addr:
            _send_email(
                to_addr,
                subject=f"[{level.upper()}] Attendance Alert — {course_name}",
                html=_load_email_template().format(
                    student_name=student.full_name if student else student_id,
                    message=message,
                    percentage=percentage,
                    course_name=course_name or "your course",
                ),
            )
    except Exception as exc:
        print(f"notification_service WARNING: send_notification failed ({exc})")
        try:
            db.rollback()
        except Exception:
            pass
    finally:
        if own_db:
            db.close()


def _send_email(to_addr: str, subject: str, html: str):
    host = os.environ.get("SMTP_HOST")
    if not host:
        print(f"notification_service: SMTP not configured; skipping email to {to_addr}.")
        return
    port = int(os.environ.get("SMTP_PORT", "587"))
    user = os.environ.get("SMTP_USER")
    password = os.environ.get("SMTP_PASS")

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = user or "no-reply@iqra.edu.pk"
    msg["To"] = to_addr
    msg.attach(MIMEText(html, "html"))

    try:
        context = ssl.create_default_context()
        with smtplib.SMTP(host, port, timeout=10) as server:
            server.starttls(context=context)
            if user and password:
                server.login(user, password)
            server.sendmail(msg["From"], [to_addr], msg.as_string())
        print(f"notification_service: email sent to {to_addr}.")
    except Exception as exc:
        print(f"notification_service WARNING: email to {to_addr} failed ({exc})")


def check_attendance_thresholds(student_id: str, course_id: int, db: Optional[Session] = None):
    """
    Recompute attendance % for a student in a course and raise notifications.
    Sets enrollment.at_risk = True when below the critical threshold.
    """
    own_db = False
    if db is None:
        db = database.SessionLocal()
        own_db = True
    try:
        course = db.query(schemas.Course).filter(schemas.Course.id == course_id).first()
        if not course:
            return
        warning_threshold = course.warning_threshold if course.warning_threshold is not None else 80.0
        critical_threshold = course.critical_threshold if course.critical_threshold is not None else 75.0

        session_ids = [
            s.id for s in db.query(schemas.Session).filter(
                schemas.Session.course_id == course_id,
                schemas.Session.status == "conducted",
            ).all()
        ]
        total_held = len(session_ids)
        if total_held == 0:
            return

        records = db.query(schemas.AttendanceRecord).filter(
            schemas.AttendanceRecord.session_id.in_(session_ids),
            schemas.AttendanceRecord.student_id == student_id,
        ).all()
        present_count = sum(
            1 for r in records
            if str(r.final_status) in (schemas.AttendanceStatus.PRESENT.value, "Present", "present", "present_low_conf")
        )
        percentage = present_count / total_held * 100.0

        enrollment = db.query(schemas.Enrollment).filter(
            schemas.Enrollment.student_id == student_id,
            schemas.Enrollment.course_id == course_id,
        ).first()

        if percentage < critical_threshold:
            if enrollment:
                enrollment.at_risk = True
                db.commit()
            send_notification(
                student_id, "critical",
                f"Your attendance in {course.name} has dropped to {percentage:.1f}%, "
                f"below the critical threshold of {critical_threshold:.0f}%. You are at risk.",
                course_id=course_id, course_name=course.name, percentage=percentage, db=db,
            )
        elif percentage < warning_threshold:
            send_notification(
                student_id, "warning",
                f"Your attendance in {course.name} is {percentage:.1f}%, "
                f"below the {warning_threshold:.0f}% warning threshold.",
                course_id=course_id, course_name=course.name, percentage=percentage, db=db,
            )
        else:
            if enrollment and enrollment.at_risk:
                enrollment.at_risk = False
                db.commit()
    except Exception as exc:
        print(f"notification_service WARNING: threshold check failed ({exc})")
    finally:
        if own_db:
            db.close()


def finalize_session_notifications(session_id: int, db: Optional[Session] = None):
    """Run threshold checks for every student in a finalised session's course."""
    own_db = False
    if db is None:
        db = database.SessionLocal()
        own_db = True
    try:
        session = db.query(schemas.Session).filter(schemas.Session.id == session_id).first()
        if not session:
            return
        student_ids = [
            e.student_id for e in db.query(schemas.Enrollment).filter(
                schemas.Enrollment.course_id == session.course_id
            ).all()
        ]
        for sid in student_ids:
            check_attendance_thresholds(sid, session.course_id, db=db)
    finally:
        if own_db:
            db.close()
