"""
Task 7 — Append-only audit trail helper.

Centralises writing rows to attendance_audit_log so routes/services don't repeat
the boilerplate. The table itself blocks UPDATE/DELETE via SQLAlchemy event
listeners declared in models/schemas.py.
"""
from __future__ import annotations

from typing import Optional
from sqlalchemy.orm import Session

from ..models import schemas


def write_audit(
    db: Session,
    action: str,
    actor_id: Optional[int] = None,
    actor_role: Optional[str] = None,
    target_student_id: Optional[str] = None,
    session_id: Optional[int] = None,
    old_value: Optional[str] = None,
    new_value: Optional[str] = None,
    reason: Optional[str] = None,
    embedding_confidence: Optional[float] = None,
    liveness_score: Optional[float] = None,
    ip_address: Optional[str] = None,
    commit: bool = True,
) -> schemas.AttendanceAuditLog:
    """Insert one audit row. Caller may defer commit by passing commit=False."""
    entry = schemas.AttendanceAuditLog(
        action=action,
        actor_id=actor_id,
        actor_role=actor_role,
        target_student_id=target_student_id,
        session_id=session_id,
        old_value=old_value,
        new_value=new_value,
        reason=reason,
        embedding_confidence=embedding_confidence,
        liveness_score=liveness_score,
        ip_address=ip_address,
    )
    db.add(entry)
    if commit:
        db.commit()
    return entry
