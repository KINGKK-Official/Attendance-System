from .models import schemas, database
from .services import auth_service
from sqlalchemy.orm import Session

def seed_demo_data():
    db = next(database.get_db())
    
    # 1. Create Faculty User
    faculty_email = "faculty@iqra.edu.pk"
    faculty = db.query(schemas.User).filter(schemas.User.email == faculty_email).first()
    if not faculty:
        print(f"Creating faculty: {faculty_email}")
        faculty = schemas.User(
            full_name="Dr. Jane Smith",
            email=faculty_email,
            password_hash=auth_service.get_password_hash("faculty123"),
            role=schemas.UserRole.FACULTY
        )
        db.add(faculty)
        db.commit()
        db.refresh(faculty)

    # 2. Create Course
    course_name = "Artificial Intelligence"
    course = db.query(schemas.Course).filter(schemas.Course.name == course_name).first()
    if not course:
        print(f"Creating course: {course_name}")
        course = schemas.Course(
            name=course_name,
            code="CS-401",
            faculty_id=faculty.id
        )
        db.add(course)
        db.commit()
        db.refresh(course)

    # 3. Create Classroom
    classroom = db.query(schemas.Classroom).first()
    if not classroom:
        print("Creating default classroom...")
        classroom = schemas.Classroom(
            room_number="Room 101",
            camera_url="rtsp://demo:1234@localhost:8554/mystream"
        )
        db.add(classroom)
        db.commit()

    print("Demo data seeded successfully!")

if __name__ == "__main__":
    seed_demo_data()
