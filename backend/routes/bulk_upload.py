from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from ..models import schemas, database
import pandas as pd
import io

router = APIRouter(prefix="/api/bulk-upload", tags=["Bulk Upload"])

@router.post("/courses")
async def bulk_upload_courses(file: UploadFile = File(...), db: Session = Depends(database.get_db)):
    if not file.filename.endswith('.xlsx'):
        raise HTTPException(status_code=400, detail="Only .xlsx format is supported.")
    
    content = await file.read()
    try:
        df = pd.read_excel(io.BytesIO(content), engine='openpyxl')
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error reading Excel file: {str(e)}")
        
    expected_columns = ['course_code', 'course_name', 'credit_hours', 'type', 'department', 'semester', 'course_category']
    missing_cols = [col for col in expected_columns if col not in df.columns]
    if missing_cols:
        raise HTTPException(status_code=400, detail=f"Missing columns: {', '.join(missing_cols)}")
        
    errors = []
    courses_to_add = []
    
    for index, row in df.iterrows():
        try:
            # Validate types and required fields
            code = str(row['course_code']).strip()
            name = str(row['course_name']).strip()
            semester = str(row['semester']).strip()
            department = str(row['department']).strip()
            c_type = str(row['type']).strip()
            
            if pd.isna(row['course_code']) or not all([code, name, semester, department, c_type]):
                errors.append({"row": index + 2, "error": "Missing required fields"})
                continue
                
            if c_type not in ["3hr", "1.5hr"]:
                errors.append({"row": index + 2, "error": "Invalid course type (must be 3hr or 1.5hr)"})
                continue
                
            # Check if department exists
            dept = db.query(schemas.Department).filter(schemas.Department.code == department).first()
            if not dept:
                # For MVP, auto-create department if missing
                dept = schemas.Department(code=department, name=department)
                db.add(dept)
                db.flush()
                
            # Check for duplicate course
            existing = db.query(schemas.Course).filter(
                schemas.Course.code == code,
                schemas.Course.semester == semester
            ).first()
            if existing:
                errors.append({"row": index + 2, "error": "Course with same code and semester already exists"})
                continue
                
            new_course = schemas.Course(
                code=code,
                name=name,
                semester=semester,
                department=department,
                course_type=c_type,
                total_weeks=16
            )
            courses_to_add.append(new_course)
        except Exception as e:
            errors.append({"row": index + 2, "error": str(e)})
            
    if errors:
        # Do not commit anything
        return {"success": False, "errors": errors, "message": "Import failed due to validation errors. No records saved."}
        
    # Bulk insert courses and generate sessions
    try:
        for course in courses_to_add:
            db.add(course)
            db.flush() # flush to get course.id
            
            # Generate 32 sessions
            for i in range(1, 33):
                week = ((i - 1) // 2) + 1
                session = schemas.Session(
                    course_id=course.id,
                    week_number=week,
                    session_number=i,
                    session_type="lecture",
                    status="scheduled"
                )
                db.add(session)
                
        db.commit()
        return {"success": True, "message": f"Successfully imported {len(courses_to_add)} courses and generated sessions."}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database error during insert: {str(e)}")

@router.post("/students")
async def bulk_upload_students(file: UploadFile = File(...), db: Session = Depends(database.get_db)):
    if not file.filename.endswith('.xlsx'):
        raise HTTPException(status_code=400, detail="Only .xlsx format is supported.")
        
    content = await file.read()
    try:
        df = pd.read_excel(io.BytesIO(content), engine='openpyxl')
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error reading Excel file: {str(e)}")
        
    expected_columns = ['student_id', 'full_name', 'email', 'department', 'semester', 'enrolled_courses']
    missing_cols = [col for col in expected_columns if col not in df.columns]
    if missing_cols:
        raise HTTPException(status_code=400, detail=f"Missing columns: {', '.join(missing_cols)}")
        
    errors = []
    students_to_add = []
    enrollments_to_add = []
    
    for index, row in df.iterrows():
        try:
            student_id = str(row['student_id']).strip()
            name = str(row['full_name']).strip()
            
            if not student_id or not name or pd.isna(row['student_id']):
                errors.append({"row": index + 2, "error": "Missing student_id or full_name"})
                continue
                
            existing_student = db.query(schemas.Student).filter(schemas.Student.id == student_id).first()
            if not existing_student:
                students_to_add.append(schemas.Student(id=student_id, full_name=name))
                
            if not pd.isna(row['enrolled_courses']):
                courses = [c.strip() for c in str(row['enrolled_courses']).split(',')]
                for course_code in courses:
                    course = db.query(schemas.Course).filter(schemas.Course.code == course_code).first()
                    if course:
                        enrollments_to_add.append((student_id, course.id))
                    else:
                        errors.append({"row": index + 2, "error": f"Course {course_code} not found"})
        except Exception as e:
            errors.append({"row": index + 2, "error": str(e)})
            
    if errors:
        return {"success": False, "errors": errors, "message": "Import failed due to validation errors. No records saved."}
        
    try:
        for st in students_to_add:
            db.add(st)
        db.flush()
        
        # Add enrollments
        for st_id, crs_id in set(enrollments_to_add):
            exists = db.query(schemas.Enrollment).filter(
                schemas.Enrollment.student_id == st_id,
                schemas.Enrollment.course_id == crs_id
            ).first()
            if not exists:
                db.add(schemas.Enrollment(student_id=st_id, course_id=crs_id))
                
        db.commit()
        return {"success": True, "message": f"Successfully imported {len(students_to_add)} students and enrollments."}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database error during insert: {str(e)}")

@router.post("/faculty")
async def bulk_upload_faculty(file: UploadFile = File(...), db: Session = Depends(database.get_db)):
    if not file.filename.endswith('.xlsx'):
        raise HTTPException(status_code=400, detail="Only .xlsx format is supported.")
        
    content = await file.read()
    try:
        df = pd.read_excel(io.BytesIO(content), engine='openpyxl')
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error reading Excel file: {str(e)}")
        
    expected_columns = ['faculty_id', 'full_name', 'email', 'department', 'assigned_courses']
    missing_cols = [col for col in expected_columns if col not in df.columns]
    if missing_cols:
        raise HTTPException(status_code=400, detail=f"Missing columns: {', '.join(missing_cols)}")
        
    errors = []
    faculty_to_add = []
    course_assignments = []
    
    for index, row in df.iterrows():
        try:
            email = str(row['email']).strip()
            name = str(row['full_name']).strip()
            
            if not email or pd.isna(row['email']):
                errors.append({"row": index + 2, "error": "Missing email"})
                continue
                
            user = db.query(schemas.User).filter(schemas.User.email == email).first()
            if not user:
                user = schemas.User(
                    full_name=name,
                    email=email,
                    role=schemas.UserRole.FACULTY,
                    password_hash="$2b$12$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW" # default 'password'
                )
                faculty_to_add.append(user)
            
            if not pd.isna(row['assigned_courses']):
                courses = [c.strip() for c in str(row['assigned_courses']).split(',')]
                course_assignments.append((email, courses))
                
        except Exception as e:
            errors.append({"row": index + 2, "error": str(e)})
            
    if errors:
        return {"success": False, "errors": errors, "message": "Import failed due to validation errors. No records saved."}
        
    try:
        for fac in faculty_to_add:
            db.add(fac)
        db.flush()
        
        for email, courses in course_assignments:
            user = db.query(schemas.User).filter(schemas.User.email == email).first()
            if user:
                for course_code in courses:
                    course = db.query(schemas.Course).filter(schemas.Course.code == course_code).first()
                    if course:
                        course.faculty_id = user.id
                        
        db.commit()
        return {"success": True, "message": f"Successfully imported {len(faculty_to_add)} faculty and assignments."}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database error during insert: {str(e)}")
