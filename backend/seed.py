from models import schemas, database
from services import auth_service
import random

def seed_database():
    db = next(database.get_db())
    print("Seeding database with default test data...")

    # 1. Create Test Users
    test_users = [
        {"email": "admin@test.com", "full_name": "Test Admin", "role": schemas.UserRole.ADMIN},
        {"email": "itmanager@test.com", "full_name": "Test IT Manager", "role": schemas.UserRole.IT_MANAGER},
        {"email": "hod@test.com", "full_name": "Test HOD", "role": schemas.UserRole.HOD, "department_code": "CS"},
        {"email": "dean@test.com", "full_name": "Test Dean", "role": schemas.UserRole.DEAN},
        {"email": "analyzer@test.com", "full_name": "Test Analyzer", "role": schemas.UserRole.FACULTY},
        {"email": "student@test.com", "full_name": "Test Student", "role": schemas.UserRole.STUDENT},
    ]

    hashed_password = auth_service.get_password_hash("testpassword123")
    
    faculty_user = None
    for u in test_users:
        existing = db.query(schemas.User).filter(schemas.User.email == u["email"]).first()
        if not existing:
            new_user = schemas.User(
                email=u["email"],
                full_name=u["full_name"],
                password_hash=hashed_password,
                role=u["role"],
            )
            # Department code isn't in User schema but we can set it if it existed.
            # In our setup, department_code is typically linked to faculty profile. 
            db.add(new_user)
            db.commit()
            db.refresh(new_user)
            print(f"Created user: {u['email']}")
            if u["email"] == "analyzer@test.com":
                faculty_user = new_user
        else:
            if u["email"] == "analyzer@test.com":
                faculty_user = existing

    # 2. Create Default Classroom
    classroom = db.query(schemas.Classroom).first()
    if not classroom:
        classroom = schemas.Classroom(
            room_number="Room 101",
            camera_url="rtsp://demo:1234@localhost:8554/mystream"
        )
        db.add(classroom)
        db.commit()
        print("Created default classroom")

    # 3. Create a Test Course
    course = db.query(schemas.Course).filter(schemas.Course.code == "CS-101").first()
    if not course and faculty_user:
        course = schemas.Course(
            name="Introduction to Computer Science",
            code="CS-101",
            faculty_id=faculty_user.id
        )
        db.add(course)
        db.commit()
        db.refresh(course)
        print("Created test course: CS-101")

    # 4. Create Test Students and Enrollments
    if course:
        student_data = [
            {"id": "STD-001", "name": "Alice Johnson"},
            {"id": "STD-002", "name": "Bob Smith"},
            {"id": "STD-003", "name": "Charlie Davis"},
            {"id": "STD-004", "name": "Diana Prince"},
        ]

        for data in student_data:
            student = db.query(schemas.Student).filter(schemas.Student.id == data["id"]).first()
            if not student:
                dummy_embedding = [random.uniform(-1, 1) for _ in range(128)]
                student = schemas.Student(
                    id=data["id"],
                    full_name=data["name"],
                    face_embedding=dummy_embedding
                )
                db.add(student)
                db.commit()
                db.refresh(student)
                print(f"Created student: {data['name']}")
            
            # Enroll student
            enrollment = db.query(schemas.Enrollment).filter(
                schemas.Enrollment.student_id == student.id,
                schemas.Enrollment.course_id == course.id
            ).first()
            if not enrollment:
                enrollment = schemas.Enrollment(student_id=student.id, course_id=course.id)
                db.add(enrollment)
                print(f"Enrolled {data['name']} in {course.code}")

        db.commit()

    print("\nDatabase seed complete! The system is ready for testing.")

if __name__ == "__main__":
    seed_database()
