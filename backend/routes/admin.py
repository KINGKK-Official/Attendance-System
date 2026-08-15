from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Request, Query
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime
import os
import uuid
import json
from ..models import database, schemas
from ..services import auth_service, ai_service, crypto_service, audit_service
from pydantic import BaseModel

router = APIRouter(prefix="/api/admin", tags=["Admin"])

class UserCreate(BaseModel):
    full_name: str
    email: str
    password: str
    role: schemas.UserRole
    department_code: Optional[str] = None

class StudentCreate(BaseModel):
    id: str
    full_name: str
    image_path: Optional[str] = None
    face_embedding: Optional[list] = None

class ClusterCreate(BaseModel):
    name: str

class CourseAssign(BaseModel):
    course_id: int
    faculty_id: int

class AcademicEnrollment(BaseModel):
    student_id: str
    course_id: int

@router.post("/users")
def create_user(user: UserCreate, db: Session = Depends(database.get_db), admin: schemas.User = Depends(auth_service.check_admin)):
    db_user = db.query(schemas.User).filter(schemas.User.email == user.email).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Check Associate Dean uniqueness
    if user.role == schemas.UserRole.ASSOCIATE_DEAN:
        existing_ad = db.query(schemas.User).filter(schemas.User.role == schemas.UserRole.ASSOCIATE_DEAN).first()
        if existing_ad:
            raise HTTPException(status_code=400, detail="An Associate Dean already exists. Only one is allowed.")
            
    # Check HOD department requirement
    if user.role == schemas.UserRole.HOD:
        if not user.department_code:
            raise HTTPException(status_code=400, detail="Department Code is required for HOD")
        
        # Ensure department exists
        dept = db.query(schemas.Department).filter(schemas.Department.code == user.department_code).first()
        if not dept:
            dept = schemas.Department(code=user.department_code, name=user.department_code)
            db.add(dept)
            db.flush()

    hashed_password = auth_service.get_password_hash(user.password)
    new_user = schemas.User(
        full_name=user.full_name,
        email=user.email,
        password_hash=hashed_password,
        role=user.role
    )
    db.add(new_user)
    db.flush()

    if user.role == schemas.UserRole.HOD:
        hod_assignment = schemas.HodAssignment(user_id=new_user.id, department_code=user.department_code)
        db.add(hod_assignment)

    db.commit()
    db.refresh(new_user)
    return new_user

@router.get("/users")
def get_users(db: Session = Depends(database.get_db), admin: schemas.User = Depends(auth_service.check_admin)):
    users = db.query(schemas.User).all()
    result = []
    for u in users:
        dept_code = None
        if u.role == schemas.UserRole.HOD:
            assignment = db.query(schemas.HodAssignment).filter(schemas.HodAssignment.user_id == u.id).first()
            if assignment:
                dept_code = assignment.department_code
        result.append({
            "id": u.id,
            "full_name": u.full_name,
            "email": u.email,
            "role": u.role,
            "created_at": u.created_at,
            "department_code": dept_code
        })
    return result

@router.post("/students")
def create_student(student: StudentCreate, db: Session = Depends(database.get_db), admin: schemas.User = Depends(auth_service.check_admin)):
    db_student = db.query(schemas.Student).filter(schemas.Student.id == student.id).first()
    if db_student:
        raise HTTPException(status_code=400, detail="Student ID already exists")
    
    new_student = schemas.Student(
        id=student.id,
        full_name=student.full_name,
        image_path=student.image_path,
        face_embedding=json.dumps(student.face_embedding) if student.face_embedding else None
    )
    db.add(new_student)
    db.commit()
    db.refresh(new_student)
    return new_student

@router.get("/students")
def get_students(db: Session = Depends(database.get_db), admin: schemas.User = Depends(auth_service.check_admin)):
    students = db.query(schemas.Student).all()
    return [
        {
            "id": s.id,
            "full_name": s.full_name,
            "enrollment_date": s.enrollment_date,
            "face_embedding": s.face_embedding,
            "face_embedding_enc": bool(s.face_embedding_enc),
            "model_version": s.model_version,
            "needs_reenrolment": s.needs_reenrolment,
            "image_path": s.image_path
        }
        for s in students
    ]

@router.post("/enroll-student")
async def enroll_student(
    request: Request,
    student_id: str = Form(...), 
    full_name: str = Form(...),
    file: Optional[UploadFile] = File(None), 
    db: Session = Depends(database.get_db), 
    admin: schemas.User = Depends(auth_service.check_admin)
):
    """
    Enrol or update a student's biometric template.

    The face embedding is encrypted at rest (Task 6). The captured image is
    deleted from disk immediately after the embedding is generated so no raw
    photos are retained post-enrolment.
    """
    embedding = None
    image_purged = False

    if file:
        contents = await file.read()
        ai = ai_service.get_ai_engine()
        embedding = ai.get_face_embedding(contents)
        if embedding is None:
            raise HTTPException(status_code=400, detail="No face detected in the image")

        # Write a temporary file only to satisfy any downstream tooling, then purge it.
        file_ext = (file.filename or "img.jpg").split(".")[-1]
        file_name = f"{student_id}_{uuid.uuid4().hex}.{file_ext}"
        upload_dir = "backend/uploads/profiles"
        os.makedirs(upload_dir, exist_ok=True)
        tmp_path = os.path.join(upload_dir, file_name)
        try:
            with open(tmp_path, "wb") as f:
                f.write(contents)
        except Exception as e:
            raise HTTPException(status_code=500, detail="Failed to save image")

        # Task 6: overridden by user request. Keep the raw photo.
        image_purged = False
        saved_image_path = f"/uploads/profiles/{file_name}"

    active_model = ai_service.get_ai_engine().active_model
    enc_blob = crypto_service.encrypt_embedding(embedding) if embedding else None

    db_student = db.query(schemas.Student).filter(schemas.Student.id == student_id).first()
    if db_student:
        db_student.full_name = full_name
        if file:
            db_student.image_path = saved_image_path

        if enc_blob is not None:
            db_student.face_embedding_enc = enc_blob
            db_student.face_embedding = None  # drop any legacy plaintext
            db_student.model_version = active_model
            db_student.needs_reenrolment = False
    else:
        db_student = schemas.Student(
            id=student_id,
            full_name=full_name,
            image_path=saved_image_path if file else None,
            face_embedding=None,
            face_embedding_enc=enc_blob,
            model_version=active_model if enc_blob is not None else None,
        )
        db.add(db_student)

    db.commit()
    db.refresh(db_student)

    if embedding is not None:
        ai_service._cv_log("ENROLMENT_COMPLETE", student_id=student_id,
                           detail=f"image_purged={image_purged}")
        audit_service.write_audit(
            db, action="enrolment", actor_id=admin.id, actor_role=str(admin.role),
            target_student_id=student_id, new_value="biometric_enrolled",
            reason="student biometric enrolment",
            ip_address=request.client.host if request.client else None,
        )

    return {"status": "success", "student_id": student_id,
            "has_biometric": embedding is not None, "image_purged": image_purged}

@router.post("/clusters")
def create_cluster(cluster: ClusterCreate, db: Session = Depends(database.get_db), admin: schemas.User = Depends(auth_service.check_admin)):
    new_cluster = schemas.Cluster(name=cluster.name)
    db.add(new_cluster)
    db.commit()
    db.refresh(new_cluster)
    return new_cluster

@router.post("/assign-course")
def assign_course(data: CourseAssign, db: Session = Depends(database.get_db), admin: schemas.User = Depends(auth_service.check_admin)):
    course = db.query(schemas.Course).filter(schemas.Course.id == data.course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    
    faculty = db.query(schemas.User).filter(schemas.User.id == data.faculty_id, schemas.User.role == schemas.UserRole.FACULTY).first()
    if not faculty:
        raise HTTPException(status_code=404, detail="Faculty member not found")
    
    course.faculty_id = data.faculty_id
    db.commit()
    return {"status": "success", "message": f"Course {course.name} assigned to {faculty.full_name}"}

@router.get("/clusters")
def get_clusters(db: Session = Depends(database.get_db), admin: schemas.User = Depends(auth_service.check_admin)):
    return db.query(schemas.Cluster).all()

# ─── Course Management ────────────────────────────────────────────────────────

class CourseCreate(BaseModel):
    name: str
    code: str
    faculty_id: Optional[int] = None
    semester: str
    department: str
    course_type: str = "3hr"
    schedule_days: Optional[str] = None
    time_slot: Optional[str] = None

@router.get("/courses")
def get_courses(db: Session = Depends(database.get_db), current_user: schemas.User = Depends(auth_service.check_leadership)):
    if current_user.role == schemas.UserRole.HOD:
        hod_assignment = db.query(schemas.HodAssignment).filter(schemas.HodAssignment.user_id == current_user.id).first()
        dept_code = hod_assignment.department_code if hod_assignment else None
        courses = db.query(schemas.Course).filter(schemas.Course.department == dept_code).all()
    else:
        courses = db.query(schemas.Course).all()
    
    result = []
    for c in courses:
        faculty = db.query(schemas.User).filter(schemas.User.id == c.faculty_id).first() if c.faculty_id else None
        result.append({
            "id": c.id,
            "code": c.code,
            "name": c.name,
            "semester": c.semester,
            "department": c.department,
            "course_type": c.course_type,
            "schedule_days": c.schedule_days,
            "time_slot": c.time_slot,
            "faculty_id": c.faculty_id,
            "faculty_name": faculty.full_name if faculty else "Unassigned",
        })
    return result

@router.post("/courses")
def create_course(course: CourseCreate, db: Session = Depends(database.get_db), admin: schemas.User = Depends(auth_service.check_admin)):
    dept = db.query(schemas.Department).filter(schemas.Department.code == course.department).first()
    if not dept:
        dept = schemas.Department(code=course.department, name=course.department)
        db.add(dept)
        db.flush()
        
    existing = db.query(schemas.Course).filter(
        schemas.Course.code == course.code,
        schemas.Course.semester == course.semester
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Course with same code and semester already exists")
        
    new_course = schemas.Course(
        name=course.name, 
        code=course.code, 
        faculty_id=course.faculty_id,
        semester=course.semester,
        department=course.department,
        course_type=course.course_type,
        schedule_days=course.schedule_days,
        time_slot=course.time_slot,
        total_weeks=16
    )
    db.add(new_course)
    db.flush()
    
    # Generate sessions based on course type
    total_sessions = 32 if course.course_type == "1.5hr" else 16
    
    for i in range(1, total_sessions + 1):
        # If 32 sessions (2/week), week is ((i-1)//2)+1. If 16 sessions (1/week), week is i.
        week = ((i - 1) // 2) + 1 if total_sessions == 32 else i
        session = schemas.Session(
            course_id=new_course.id,
            week_number=week,
            session_number=i,
            session_type="lecture",
            status="scheduled"
        )
        db.add(session)
        
    db.commit()
    db.refresh(new_course)
    return new_course

# ─── Academic Enrollment ──────────────────────────────────────────────────────

@router.post("/enroll-academic")
def enroll_academic(data: AcademicEnrollment, db: Session = Depends(database.get_db), admin: schemas.User = Depends(auth_service.check_admin)):
    existing = db.query(schemas.Enrollment).filter(
        schemas.Enrollment.student_id == data.student_id,
        schemas.Enrollment.course_id == data.course_id
    ).first()
    if existing:
        return {"status": "info", "message": "Student already enrolled in this course"}
    
    new_enrollment = schemas.Enrollment(student_id=data.student_id, course_id=data.course_id)
    db.add(new_enrollment)
    db.commit()
    return {"status": "success", "message": "Student enrolled in course successfully"}

@router.get("/enrollments")
def get_enrollments(db: Session = Depends(database.get_db), admin: schemas.User = Depends(auth_service.check_admin)):
    enrollments = db.query(schemas.Enrollment).all()
    result = []
    for e in enrollments:
        student = db.query(schemas.Student).filter(schemas.Student.id == e.student_id).first()
        course = db.query(schemas.Course).filter(schemas.Course.id == e.course_id).first()
        result.append({
            "student_id": e.student_id,
            "student_name": student.full_name if student else "Unknown",
            "course_id": e.course_id,
            "course_name": course.name if course else "Unknown",
            "course_code": course.code if course else "Unknown"
        })
    return result

# ─── Delete Functionality ──────────────────────────────────────────────────


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    email: Optional[str] = None
    role: Optional[schemas.UserRole] = None
    department_code: Optional[str] = None

@router.put("/users/{user_id}")
def update_user(user_id: int, user_update: UserUpdate, db: Session = Depends(database.get_db), admin: schemas.User = Depends(auth_service.check_admin)):
    db_user = db.query(schemas.User).filter(schemas.User.id == user_id).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if user_update.full_name is not None:
        db_user.full_name = user_update.full_name
    if user_update.email is not None:
        # check if email is taken
        existing = db.query(schemas.User).filter(schemas.User.email == user_update.email, schemas.User.id != user_id).first()
        if existing:
            raise HTTPException(status_code=400, detail="Email already taken")
        db_user.email = user_update.email
    if user_update.role is not None:
        db_user.role = user_update.role
        
    db.commit()
    db.refresh(db_user)
    return db_user

@router.delete("/users/{user_id}")
def delete_user(user_id: int, db: Session = Depends(database.get_db), admin: schemas.User = Depends(auth_service.check_admin)):
    user = db.query(schemas.User).filter(schemas.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Check if user is trying to delete themselves
    if user.id == admin.id:
        raise HTTPException(status_code=400, detail="Cannot delete your own admin account")
    
    # Check if user is faculty and assigned to courses
    assigned_courses = db.query(schemas.Course).filter(schemas.Course.faculty_id == user_id).all()
    for course in assigned_courses:
        course.faculty_id = None  # Unassign faculty instead of deleting course
    
    # Delete related HOD assignment if exists
    db.query(schemas.HodAssignment).filter(schemas.HodAssignment.user_id == user_id).delete()
    
    db.delete(user)
    db.commit()
    return {"status": "success", "message": f"User {user.full_name} deleted successfully"}


class StudentUpdate(BaseModel):
    new_id: Optional[str] = None
    full_name: Optional[str] = None
    email: Optional[str] = None
    password: Optional[str] = None

@router.put("/students/{student_id}")
def update_student(student_id: str, student_update: StudentUpdate, db: Session = Depends(database.get_db), admin: schemas.User = Depends(auth_service.check_admin)):
    db_student = db.query(schemas.Student).filter(schemas.Student.id == student_id).first()
    if not db_student:
        raise HTTPException(status_code=404, detail="Student not found")
    
    if student_update.full_name is not None:
        db_student.full_name = student_update.full_name
        
    if student_update.new_id and student_update.new_id != student_id:
        new_id = student_update.new_id
        # Check if new_id already exists
        if db.query(schemas.Student).filter(schemas.Student.id == new_id).first():
            raise HTTPException(status_code=400, detail="New Student ID already exists")
        
        # Cascade update across tables (sqlite doesn't do it automatically here)
        db.query(schemas.Enrollment).filter(schemas.Enrollment.student_id == student_id).update({"student_id": new_id})
        db.query(schemas.AttendanceRecord).filter(schemas.AttendanceRecord.student_id == student_id).update({"student_id": new_id})
        db.query(schemas.AttendanceAuditLog).filter(schemas.AttendanceAuditLog.target_student_id == student_id).update({"target_student_id": new_id})
        db.query(schemas.User).filter(schemas.User.student_id == student_id).update({"student_id": new_id})
        
        # Finally update the student id
        # SQLAlchemy might complain about changing primary key. 
        # Safest way in SQLite without ON UPDATE CASCADE is to insert new and delete old, 
        # but let's try direct update first.
        db.execute(
            schemas.Student.__table__.update()
            .where(schemas.Student.id == student_id)
            .values(id=new_id)
        )
        db_student = db.query(schemas.Student).filter(schemas.Student.id == new_id).first()
        student_id = new_id
        
    # Handle email and password for login creation
    if student_update.email and student_update.password:
        existing_user = db.query(schemas.User).filter(schemas.User.student_id == student_id).first()
        if existing_user:
            existing_user.email = student_update.email
            existing_user.password_hash = auth_service.get_password_hash(student_update.password)
        else:
            if db.query(schemas.User).filter(schemas.User.email == student_update.email).first():
                raise HTTPException(status_code=400, detail="Email already taken by another user")
            user = schemas.User(
                full_name=db_student.full_name,
                email=student_update.email,
                password_hash=auth_service.get_password_hash(student_update.password),
                role=schemas.UserRole.STUDENT.value,
                student_id=student_id,
            )
            db.add(user)

    db.commit()
    db.refresh(db_student)
    return db_student

@router.delete("/students/{student_id}")
def delete_student(student_id: str, db: Session = Depends(database.get_db), admin: schemas.User = Depends(auth_service.check_admin)):
    student = db.query(schemas.Student).filter(schemas.Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    
    # Delete related enrollments and attendance records first
    db.query(schemas.Enrollment).filter(schemas.Enrollment.student_id == student_id).delete()
    db.query(schemas.AttendanceRecord).filter(schemas.AttendanceRecord.student_id == student_id).delete()
    
    db.delete(student)
    db.commit()
    return {"status": "success", "message": f"Student {student.full_name} deleted successfully"}
@router.delete("/courses/{course_id}")
def delete_course(course_id: int, db: Session = Depends(database.get_db), admin: schemas.User = Depends(auth_service.check_admin)):
    course = db.query(schemas.Course).filter(schemas.Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    
    # Delete related enrollments, sessions, and attendance records first
    db.query(schemas.Enrollment).filter(schemas.Enrollment.course_id == course_id).delete()
    
    sessions = db.query(schemas.Session).filter(schemas.Session.course_id == course_id).all()
    session_ids = [s.id for s in sessions]
    db.query(schemas.AttendanceRecord).filter(schemas.AttendanceRecord.session_id.in_(session_ids)).delete()
    db.query(schemas.Session).filter(schemas.Session.course_id == course_id).delete()
    
    db.delete(course)
    db.commit()
    return {"status": "success", "message": f"Course {course.name} deleted successfully"}


# ─── Task 7: audit-log query endpoint ────────────────────────────────────────
@router.get("/audit-log", summary="Query the append-only attendance audit log")
def get_audit_log(
    student_id: Optional[str] = Query(None),
    session_id: Optional[int] = Query(None),
    actor_id: Optional[int] = Query(None),
    action: Optional[str] = Query(None),
    date_from: Optional[str] = Query(None, description="ISO date/time lower bound"),
    date_to: Optional[str] = Query(None, description="ISO date/time upper bound"),
    page: int = Query(1, ge=1),
    db: Session = Depends(database.get_db),
    admin: schemas.User = Depends(auth_service.check_admin),
):
    """
    Return audit rows with optional filters, paginated 50 per page.
    The audit table is append-only; this endpoint is read-only.
    """
    q = db.query(schemas.AttendanceAuditLog)
    if student_id:
        q = q.filter(schemas.AttendanceAuditLog.target_student_id == student_id)
    if session_id:
        q = q.filter(schemas.AttendanceAuditLog.session_id == session_id)
    if actor_id:
        q = q.filter(schemas.AttendanceAuditLog.actor_id == actor_id)
    if action:
        q = q.filter(schemas.AttendanceAuditLog.action == action)
    if date_from:
        try:
            q = q.filter(schemas.AttendanceAuditLog.timestamp >= datetime.fromisoformat(date_from))
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date_from")
    if date_to:
        try:
            q = q.filter(schemas.AttendanceAuditLog.timestamp <= datetime.fromisoformat(date_to))
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date_to")

    per_page = 50
    total = q.count()
    rows = (q.order_by(schemas.AttendanceAuditLog.timestamp.desc())
              .offset((page - 1) * per_page).limit(per_page).all())
    return {
        "page": page,
        "per_page": per_page,
        "total": total,
        "results": [
            {
                "id": r.id,
                "timestamp": r.timestamp,
                "actor_id": r.actor_id,
                "actor_role": r.actor_role,
                "action": r.action,
                "target_student_id": r.target_student_id,
                "session_id": r.session_id,
                "old_value": r.old_value,
                "new_value": r.new_value,
                "reason": r.reason,
                "embedding_confidence": r.embedding_confidence,
                "liveness_score": r.liveness_score,
                "ip_address": r.ip_address,
            }
            for r in rows
        ],
    }


# ─── Task 9: at-risk students endpoint ───────────────────────────────────────
@router.get("/at-risk-students", summary="List at-risk students grouped by course")
def get_at_risk_students(
    db: Session = Depends(database.get_db),
    admin: schemas.User = Depends(auth_service.check_admin),
):
    """Return students flagged at_risk, grouped by course, with current %."""
    enrollments = db.query(schemas.Enrollment).filter(
        schemas.Enrollment.at_risk == True  # noqa: E712
    ).all()

    grouped: dict[int, dict] = {}
    for e in enrollments:
        course = db.query(schemas.Course).filter(schemas.Course.id == e.course_id).first()
        student = db.query(schemas.Student).filter(schemas.Student.id == e.student_id).first()

        session_ids = [
            s.id for s in db.query(schemas.Session).filter(
                schemas.Session.course_id == e.course_id,
                schemas.Session.status == "conducted",
            ).all()
        ]
        total_held = len(session_ids)
        records = db.query(schemas.AttendanceRecord).filter(
            schemas.AttendanceRecord.session_id.in_(session_ids),
            schemas.AttendanceRecord.student_id == e.student_id,
        ).all() if session_ids else []
        present = sum(1 for r in records if str(r.final_status) in ("Present", "present"))
        pct = (present / total_held * 100.0) if total_held else 0.0

        grp = grouped.setdefault(e.course_id, {
            "course_id": e.course_id,
            "course_name": course.name if course else "Unknown",
            "course_code": course.code if course else "Unknown",
            "students": [],
        })
        grp["students"].append({
            "student_id": e.student_id,
            "full_name": student.full_name if student else "Unknown",
            "attendance_percentage": round(pct, 1),
        })

    return list(grouped.values())


# ─── Task 10: create a student login linked to a biometric record ────────────
class StudentAccountCreate(BaseModel):
    student_id: str
    email: str
    password: str
    full_name: Optional[str] = None


@router.post("/student-accounts", summary="Create a STUDENT login linked to a student record")
def create_student_account(
    data: StudentAccountCreate,
    db: Session = Depends(database.get_db),
    admin: schemas.User = Depends(auth_service.check_admin),
):
    """Create a user with role STUDENT bound to an existing student id."""
    student = db.query(schemas.Student).filter(schemas.Student.id == data.student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student record not found")
    if db.query(schemas.User).filter(schemas.User.email == data.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")

    user = schemas.User(
        full_name=data.full_name or student.full_name,
        email=data.email,
        password_hash=auth_service.get_password_hash(data.password),
        role=schemas.UserRole.STUDENT.value,
        student_id=data.student_id,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return {"status": "success", "user_id": user.id, "student_id": data.student_id}


# ─── Analytics: aggregated KPIs for the futuristic dashboard ─────────────────
@router.get("/analytics/overview", summary="Institution-wide analytics for the admin dashboard")
def analytics_overview(
    db: Session = Depends(database.get_db),
    admin: schemas.User = Depends(auth_service.check_admin),
):
    """
    Aggregate live data into dashboard-ready metrics:
    KPI counters, attendance distribution, per-course attendance, weekly trend,
    role breakdown, at-risk count, CV/security signals (spoof alerts, reviews).
    Everything is derived from real records — no mock data.
    """
    users = db.query(schemas.User).all()
    students = db.query(schemas.Student).all()
    courses = db.query(schemas.Course).all()
    conducted = db.query(schemas.Session).filter(schemas.Session.status == "conducted").all()
    conducted_ids = [s.id for s in conducted]
    records = db.query(schemas.AttendanceRecord).filter(
        schemas.AttendanceRecord.session_id.in_(conducted_ids)
    ).all() if conducted_ids else []

    def is_present(r):
        return str(r.final_status) in ("Present", "present", "present_low_conf")

    present_total = sum(1 for r in records if is_present(r))
    overall_pct = round(present_total / len(records) * 100.0, 1) if records else 0.0

    # Role breakdown
    role_counts = {}
    for u in users:
        role_counts[str(u.role)] = role_counts.get(str(u.role), 0) + 1

    # Per-course attendance %
    course_breakdown = []
    for course in courses:
        c_sessions = [s.id for s in conducted if s.course_id == course.id]
        c_records = [r for r in records if r.session_id in c_sessions]
        c_present = sum(1 for r in c_records if is_present(r))
        pct = round(c_present / len(c_records) * 100.0, 1) if c_records else 0.0
        enrolled = db.query(schemas.Enrollment).filter(
            schemas.Enrollment.course_id == course.id
        ).count()
        course_breakdown.append({
            "course_id": course.id,
            "course_code": course.code,
            "course_name": course.name,
            "percentage": pct,
            "sessions_held": len(c_sessions),
            "students_enrolled": enrolled,
        })
    course_breakdown.sort(key=lambda x: x["percentage"])

    # Attendance distribution buckets (by student-course standing)
    enrollments = db.query(schemas.Enrollment).all()
    dist = {"safe": 0, "warning": 0, "critical": 0}
    for e in enrollments:
        c_sessions = [s.id for s in conducted if s.course_id == e.course_id]
        c_recs = [r for r in records if r.session_id in c_sessions and r.student_id == e.student_id]
        if not c_sessions:
            continue
        pres = sum(1 for r in c_recs if is_present(r))
        p = pres / len(c_sessions) * 100.0
        if p >= 80:
            dist["safe"] += 1
        elif p >= 75:
            dist["warning"] += 1
        else:
            dist["critical"] += 1

    # Weekly attendance trend (avg % per week across all courses)
    weekly = {}
    for s in conducted:
        wk = s.week_number or 0
        s_recs = [r for r in records if r.session_id == s.id]
        if not s_recs:
            continue
        pres = sum(1 for r in s_recs if is_present(r))
        bucket = weekly.setdefault(wk, {"present": 0, "total": 0})
        bucket["present"] += pres
        bucket["total"] += len(s_recs)
    weekly_trend = [
        {"week": w, "percentage": round(v["present"] / v["total"] * 100.0, 1) if v["total"] else 0.0}
        for w, v in sorted(weekly.items())
    ]

    # Security / CV signals
    spoof_alerts = db.query(schemas.Session).filter(
        schemas.Session.spoof_alert == True  # noqa: E712
    ).count()
    total_liveness_fails = sum((s.liveness_fail_count or 0) for s in db.query(schemas.Session).all())
    reviews_pending = db.query(schemas.AttendanceRecord).filter(
        schemas.AttendanceRecord.requires_review == True  # noqa: E712
    ).count()
    at_risk = db.query(schemas.Enrollment).filter(
        schemas.Enrollment.at_risk == True  # noqa: E712
    ).count()
    biometric_enrolled = sum(
        1 for s in students if (s.face_embedding_enc is not None or s.face_embedding)
    )

    return {
        "kpis": {
            "total_students": len(students),
            "total_courses": len(courses),
            "total_users": len(users),
            "sessions_conducted": len(conducted),
            "overall_attendance": overall_pct,
            "biometric_enrolled": biometric_enrolled,
            "at_risk_students": at_risk,
            "reviews_pending": reviews_pending,
        },
        "attendance_distribution": dist,
        "course_breakdown": course_breakdown,
        "weekly_trend": weekly_trend,
        "role_breakdown": [{"role": k, "count": v} for k, v in role_counts.items()],
        "security": {
            "spoof_alerts": spoof_alerts,
            "liveness_failures": total_liveness_fails,
            "reviews_pending": reviews_pending,
        },
    }


# ─── Analytics: live activity feed (recent audit events) ─────────────────────
@router.get("/analytics/activity", summary="Recent system activity for the live feed")
def analytics_activity(
    limit: int = Query(12, ge=1, le=50),
    db: Session = Depends(database.get_db),
    admin: schemas.User = Depends(auth_service.check_admin),
):
    """Most-recent audit rows, shaped for the dashboard's live activity stream."""
    rows = (db.query(schemas.AttendanceAuditLog)
            .order_by(schemas.AttendanceAuditLog.timestamp.desc())
            .limit(limit).all())
    actor_cache: dict = {}

    def actor_name(aid):
        if aid is None:
            return "System"
        if aid not in actor_cache:
            u = db.query(schemas.User).filter(schemas.User.id == aid).first()
            actor_cache[aid] = u.full_name if u else f"User #{aid}"
        return actor_cache[aid]

    out = []
    for r in rows:
        out.append({
            "id": r.id,
            "timestamp": r.timestamp,
            "action": r.action,
            "actor": actor_name(r.actor_id),
            "actor_role": r.actor_role,
            "student_id": r.target_student_id,
            "session_id": r.session_id,
            "old_value": r.old_value,
            "new_value": r.new_value,
            "liveness_score": r.liveness_score,
        })
    return out


# ─── Analytics: department breakdown + composite risk score ──────────────────
@router.get("/analytics/security", summary="Composite security & risk telemetry")
def analytics_security(
    db: Session = Depends(database.get_db),
    admin: schemas.User = Depends(auth_service.check_admin),
):
    """
    Department attendance heatmap + a 0-100 institutional risk score derived from
    at-risk ratio, spoof activity, and pending reviews. Higher = more risk.
    """
    courses = db.query(schemas.Course).all()
    conducted = db.query(schemas.Session).filter(schemas.Session.status == "conducted").all()
    conducted_by_course = {}
    for s in conducted:
        conducted_by_course.setdefault(s.course_id, []).append(s.id)
    all_session_ids = [s.id for s in conducted]
    records = db.query(schemas.AttendanceRecord).filter(
        schemas.AttendanceRecord.session_id.in_(all_session_ids)
    ).all() if all_session_ids else []

    def is_present(r):
        return str(r.final_status) in ("Present", "present", "present_low_conf")

    recs_by_session = {}
    for r in records:
        recs_by_session.setdefault(r.session_id, []).append(r)

    dept_stats = {}
    for course in courses:
        dept = course.department or "—"
        sids = conducted_by_course.get(course.id, [])
        present = total = 0
        for sid in sids:
            for r in recs_by_session.get(sid, []):
                total += 1
                if is_present(r):
                    present += 1
        d = dept_stats.setdefault(dept, {"present": 0, "total": 0, "courses": 0})
        d["present"] += present
        d["total"] += total
        d["courses"] += 1

    departments = [
        {
            "department": dept,
            "courses": v["courses"],
            "percentage": round(v["present"] / v["total"] * 100.0, 1) if v["total"] else 0.0,
        }
        for dept, v in sorted(dept_stats.items())
    ]

    total_enr = db.query(schemas.Enrollment).count() or 1
    at_risk = db.query(schemas.Enrollment).filter(schemas.Enrollment.at_risk == True).count()  # noqa: E712
    spoof_alerts = db.query(schemas.Session).filter(schemas.Session.spoof_alert == True).count()  # noqa: E712
    reviews = db.query(schemas.AttendanceRecord).filter(schemas.AttendanceRecord.requires_review == True).count()  # noqa: E712
    total_sessions = max(len(conducted), 1)

    # Composite risk: weighted blend, clamped 0-100
    risk = min(100.0, round(
        (at_risk / total_enr) * 55.0 +
        (spoof_alerts / total_sessions) * 30.0 +
        min(reviews, 20) / 20.0 * 15.0, 1
    ))
    if risk < 25:
        level = "low"
    elif risk < 55:
        level = "moderate"
    else:
        level = "elevated"

    return {
        "departments": departments,
        "risk_score": risk,
        "risk_level": level,
        "signals": {
            "at_risk": at_risk,
            "spoof_alerts": spoof_alerts,
            "pending_reviews": reviews,
            "enrolments": total_enr,
        },
    }
