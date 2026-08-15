from sqlalchemy import (
    Column, Integer, String, ForeignKey, DateTime, Date, Boolean, Text,
    UniqueConstraint, Float, LargeBinary, event,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from .database import Base
import enum


class UserRole(str, enum.Enum):
    ADMIN = "ADMIN"
    FACULTY = "FACULTY"
    HOD = "HOD"
    DEAN = "DEAN"
    ASSOCIATE_DEAN = "ASSOCIATE_DEAN"
    IT_MANAGER = "IT_MANAGER"
    STUDENT = "STUDENT"
    ANALYZER = "ANALYZER"


class AttendanceStatus(str, enum.Enum):
    PRESENT = "Present"
    ABSENT = "Absent"


# Final consensus states (Task 8)
class FinalStatus(str, enum.Enum):
    PRESENT = "present"
    PRESENT_LOW_CONF = "present_low_conf"
    DISPUTED = "disputed"
    ABSENT = "absent"


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    full_name = Column(String(255))
    email = Column(String(255), unique=True, index=True)
    password_hash = Column(String(255))
    role = Column(String(50))  # Store enum as string for SQL Server
    created_at = Column(DateTime, server_default=func.now())
    # Task 10: link a STUDENT user account to a Student biometric record
    student_id = Column(String(50), ForeignKey("students.id"), nullable=True)


class Department(Base):
    __tablename__ = "departments"
    code = Column(String(10), primary_key=True, index=True)
    name = Column(String(255))


class HodAssignment(Base):
    __tablename__ = "hod_assignments"
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True)
    department_code = Column(String(10), ForeignKey("departments.code"))

    user = relationship("User")
    department = relationship("Department")


class Cluster(Base):
    __tablename__ = "clusters"
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String(255), unique=True)
    courses = relationship("Course", back_populates="cluster")


class Classroom(Base):
    __tablename__ = "classrooms"
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    room_number = Column(String(100), unique=True)
    camera_url = Column(String(500))
    ip_address = Column(String(100), nullable=True)
    port = Column(Integer, nullable=True)
    camera_username = Column(String(100), nullable=True)
    camera_password = Column(String(100), nullable=True)
    stream_path = Column(String(100), nullable=True)
    # IT-Manager upgrade: discovered capabilities + audio consent gate
    has_audio = Column(Boolean, default=False)
    has_ptz = Column(Boolean, default=False)
    last_codec = Column(String(50), nullable=True)
    last_resolution = Column(String(50), nullable=True)
    audio_consent_on_file = Column(Boolean, default=False)


class CourseType(str, enum.Enum):
    TYPE_3HR = "3hr"
    TYPE_1_5HR = "1.5hr"


class Course(Base):
    __tablename__ = "courses"
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    code = Column(String(50))
    name = Column(String(255))
    cluster_id = Column(Integer, ForeignKey("clusters.id"), nullable=True)
    faculty_id = Column(Integer, ForeignKey("users.id"))
    total_weeks = Column(Integer, default=16)

    semester = Column(String(20), nullable=False)
    department = Column(String(10), ForeignKey("departments.code"), nullable=False)
    slot = Column(String(5), nullable=False, default="-")
    course_type = Column(String(10), nullable=False, default="3hr")
    schedule_days = Column(String(50), nullable=True)
    time_slot = Column(String(50), nullable=True)

    # Task 9: per-course configurable attendance thresholds
    warning_threshold = Column(Float, default=80.0)
    critical_threshold = Column(Float, default=75.0)

    # Task 12 (v2.3): Per-course hit scheduling and timeout
    hit_1_offset = Column(Integer, default=30)
    hit_2_offset = Column(Integer, default=60)
    tier2_timeout = Column(Integer, default=10)
    sentiment_consent_status = Column(Boolean, default=False)

    cluster = relationship("Cluster", back_populates="courses")
    faculty = relationship("User")
    dept = relationship("Department")

    __table_args__ = (
        UniqueConstraint('code', 'semester', name='uix_course_sem_sec'),
    )


class Student(Base):
    __tablename__ = "students"
    id = Column(String(50), primary_key=True)  # University ID
    full_name = Column(String(255))
    enrollment_date = Column(DateTime, server_default=func.now())
    image_path = Column(String(500))
    # Legacy plaintext JSON embedding (kept for backward-compat / migration source)
    face_embedding = Column(Text)
    # Task 6: encrypted embedding bytes (Fernet). New writes go here.
    face_embedding_enc = Column(LargeBinary, nullable=True)
    # Task 11: which recognition model produced the stored embedding
    model_version = Column(String(20), nullable=True, default="sface")
    needs_reenrolment = Column(Boolean, default=False)


class Enrollment(Base):
    __tablename__ = "enrollments"
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    student_id = Column(String(50), ForeignKey("students.id"))
    course_id = Column(Integer, ForeignKey("courses.id"))
    # Task 9: early-warning flag for this student-course pairing
    at_risk = Column(Boolean, default=False)


class SessionType(str, enum.Enum):
    LECTURE = "lecture"
    LAB = "lab"


class SessionStatus(str, enum.Enum):
    SCHEDULED = "scheduled"
    CONDUCTED = "conducted"
    CANCELLED = "cancelled"


class Session(Base):
    __tablename__ = "sessions"
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    course_id = Column(Integer, ForeignKey("courses.id"))
    room_id = Column(Integer, ForeignKey("classrooms.id"), nullable=True)
    week_number = Column(Integer)
    session_number = Column(Integer)
    session_date = Column(Date, nullable=True)
    session_type = Column(String(20), default="lecture")
    status = Column(String(20), default="scheduled")
    actual_start_time = Column(DateTime, nullable=True)

    # Task 2: anti-spoofing tracking
    liveness_fail_count = Column(Integer, default=0)
    spoof_alert = Column(Boolean, default=False)

    # Task 4: anti-replay nonces
    hit_nonce_1 = Column(String(64), nullable=True)
    hit_nonce_2 = Column(String(64), nullable=True)
    hit_1_used = Column(Boolean, default=False)
    hit_2_used = Column(Boolean, default=False)
    hit_nonce_1_issued_at = Column(DateTime, nullable=True)
    hit_nonce_2_issued_at = Column(DateTime, nullable=True)


class AttendanceRecord(Base):
    __tablename__ = "attendance_records"
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    session_id = Column(Integer, ForeignKey("sessions.id"))
    student_id = Column(String(50), ForeignKey("students.id"))
    hit_1_present = Column(Boolean, nullable=True)
    hit_2_present = Column(Boolean, nullable=True)
    final_status = Column(String(50), default="Absent")  # Store enum as string
    is_manual_override = Column(Boolean, default=False)
    override_reason = Column(String(500), nullable=True)

    # Task 3: embedding quality / confidence per hit (0..1)
    embedding_confidence = Column(Float, nullable=True)
    hit_1_confidence = Column(Float, nullable=True)
    hit_2_confidence = Column(Float, nullable=True)
    # Task 2: liveness score recorded at match time
    liveness_score = Column(Float, nullable=True)

    # Task 8: consensus result + review queue flag
    consensus_status = Column(String(20), nullable=True)  # FinalStatus value
    requires_review = Column(Boolean, default=False)


class SystemSettings(Base):
    __tablename__ = "system_settings"
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    face_comparison_threshold = Column(Float, default=0.363)
    face_detection_threshold = Column(Float, default=0.6)
    double_hit_interval = Column(Integer, default=30)

    # Task 1: CV pre-processing knobs
    cv_blur_threshold = Column(Float, default=80.0)
    # Task 3: minimum raw embedding norm to accept a face crop
    cv_embedding_min_norm = Column(Float, default=5.0)
    # Task 2: liveness acceptance threshold
    liveness_threshold = Column(Float, default=0.7)


# ─── Task 5: refresh-token store for JWT hardening ───────────────────────────
class RefreshToken(Base):
    __tablename__ = "refresh_tokens"
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    token_hash = Column(String(64), unique=True, index=True, nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    user_role = Column(String(20), nullable=False)
    expires_at = Column(DateTime, nullable=False)
    revoked = Column(Boolean, default=False)
    created_at = Column(DateTime, server_default=func.now())


# ─── Task 9: in-app notifications ────────────────────────────────────────────
class Notification(Base):
    __tablename__ = "notifications"
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    student_id = Column(String(50), ForeignKey("students.id"), nullable=False)
    course_id = Column(Integer, ForeignKey("courses.id"), nullable=True)
    message = Column(Text, nullable=False)
    level = Column(String(20), nullable=False)  # 'warning' | 'critical'
    read = Column(Boolean, default=False)
    created_at = Column(DateTime, server_default=func.now())


# ─── Task 7: append-only audit log ───────────────────────────────────────────
class AttendanceAuditLog(Base):
    __tablename__ = "attendance_audit_log"
    id = Column(Integer, primary_key=True, autoincrement=True)
    timestamp = Column(DateTime, default=func.now(), nullable=False)
    actor_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    actor_role = Column(String(20), nullable=True)  # 'faculty' | 'admin' | 'system'
    action = Column(String(50), nullable=False)     # 'manual_override' | 'ai_mark' | 'enrolment' | 'session_start' ...
    target_student_id = Column(String(50), ForeignKey("students.id"), nullable=True)
    session_id = Column(Integer, ForeignKey("sessions.id"), nullable=True)
    old_value = Column(String(100), nullable=True)
    new_value = Column(String(100), nullable=True)
    reason = Column(Text, nullable=True)
    embedding_confidence = Column(Float, nullable=True)
    liveness_score = Column(Float, nullable=True)
    ip_address = Column(String(45), nullable=True)


# Append-only enforcement: block UPDATE / DELETE on the audit log table.
@event.listens_for(AttendanceAuditLog, "before_update", propagate=True)
def _block_audit_update(mapper, connection, target):
    raise PermissionError("attendance_audit_log is append-only; UPDATE is not permitted.")


@event.listens_for(AttendanceAuditLog, "before_delete", propagate=True)
def _block_audit_delete(mapper, connection, target):
    raise PermissionError("attendance_audit_log is append-only; DELETE is not permitted.")


# ─── IT-Manager upgrade: append-only IT/security audit log ───────────────────
class ITAuditLog(Base):
    __tablename__ = "it_audit_log"
    id = Column(Integer, primary_key=True, autoincrement=True)
    timestamp = Column(DateTime, default=func.now(), nullable=False)
    actor_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    actor_email = Column(String(255), nullable=True)
    action = Column(String(60), nullable=False)
    target = Column(String(255), nullable=True)
    metadata_json = Column(Text, nullable=True)
    reason = Column(Text, nullable=True)
    ip_address = Column(String(45), nullable=True)


@event.listens_for(ITAuditLog, "before_update", propagate=True)
def _block_itaudit_update(mapper, connection, target):
    raise PermissionError("it_audit_log is append-only; UPDATE is not permitted.")


@event.listens_for(ITAuditLog, "before_delete", propagate=True)
def _block_itaudit_delete(mapper, connection, target):
    raise PermissionError("it_audit_log is append-only; DELETE is not permitted.")


# ─── IT-Manager upgrade: live monitor sessions (who is watching/listening) ────
class MonitorSession(Base):
    __tablename__ = "monitor_sessions"
    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    user_email = Column(String(255), nullable=True)
    classroom_id = Column(Integer, ForeignKey("classrooms.id"), nullable=True)
    room_number = Column(String(100), nullable=True)
    kind = Column(String(20), nullable=False)       # 'video' | 'audio'
    started_at = Column(DateTime, default=func.now(), nullable=False)
    ended_at = Column(DateTime, nullable=True)
    active = Column(Boolean, default=True)


# ─── v2.3 Upgrades: Sentiment Analyzer ───────────────────────────────────────────
class SessionSentiment(Base):
    __tablename__ = "session_sentiments"
    id = Column(Integer, primary_key=True, autoincrement=True)
    session_id = Column(Integer, ForeignKey("sessions.id"), nullable=False)
    course_id = Column(Integer, ForeignKey("courses.id"), nullable=False)
    neutral_pct = Column(Float, default=0.0)
    positive_pct = Column(Float, default=0.0)
    distracted_pct = Column(Float, default=0.0)
    sample_count = Column(Integer, default=0)
    recorded_at = Column(DateTime, default=func.now())


# ─── v2.3 Upgrades: Granular RBAC ───────────────────────────────────────────
class Permission(Base):
    __tablename__ = "permissions"
    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(100), unique=True, nullable=False) # e.g. 'Create Course', 'Assign Permissions'
    description = Column(String(255))

class RolePermissionOverride(Base):
    __tablename__ = "role_permission_overrides"
    id = Column(Integer, primary_key=True, autoincrement=True)
    role = Column(String(50), nullable=True) # If applied to role
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True) # If applied to specific user
    permission_id = Column(Integer, ForeignKey("permissions.id"), nullable=False)
    is_granted = Column(Boolean, default=True) # False means revoked


# ─── v2.3 Upgrades: Unified Audit Log ───────────────────────────────────────
class UnifiedAuditLog(Base):
    __tablename__ = "unified_audit_log"
    id = Column(Integer, primary_key=True, autoincrement=True)
    timestamp = Column(DateTime, default=func.now(), nullable=False)
    actor_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    actor_role = Column(String(50), nullable=True)
    department_code = Column(String(10), ForeignKey("departments.code"), nullable=True) # For HOD scoping
    action = Column(String(100), nullable=False)
    target_type = Column(String(50), nullable=True) # e.g., 'User', 'Course', 'SystemSettings'
    target_id = Column(String(50), nullable=True)
    old_value = Column(Text, nullable=True)
    new_value = Column(Text, nullable=True)
    reason = Column(Text, nullable=True)
    ip_address = Column(String(45), nullable=True)

@event.listens_for(UnifiedAuditLog, "before_update", propagate=True)
def _block_unified_audit_update(mapper, connection, target):
    raise PermissionError("unified_audit_log is append-only; UPDATE is not permitted.")

@event.listens_for(UnifiedAuditLog, "before_delete", propagate=True)
def _block_unified_audit_delete(mapper, connection, target):
    raise PermissionError("unified_audit_log is append-only; DELETE is not permitted.")


# ─── v2.3 Upgrades: Model Drift & Recalibration ─────────────────────────────
class ModelDriftMetrics(Base):
    __tablename__ = "model_drift_metrics"
    id = Column(Integer, primary_key=True, autoincrement=True)
    camera_id = Column(Integer, ForeignKey("classrooms.id"), nullable=True)
    course_id = Column(Integer, ForeignKey("courses.id"), nullable=True)
    recorded_at = Column(DateTime, default=func.now())
    tier2_escalation_rate = Column(Float, default=0.0)
    low_conf_rate = Column(Float, default=0.0)
    manual_override_rate = Column(Float, default=0.0)

class ThresholdVersion(Base):
    __tablename__ = "threshold_versions"
    id = Column(Integer, primary_key=True, autoincrement=True)
    effective_date = Column(DateTime, default=func.now())
    approved_by = Column(Integer, ForeignKey("users.id"))
    old_tier1_threshold = Column(Float)
    new_tier1_threshold = Column(Float)
    old_tier2_threshold = Column(Float)
    new_tier2_threshold = Column(Float)
    validation_metrics_json = Column(Text)

