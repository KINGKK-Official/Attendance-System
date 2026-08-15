from .models import schemas, database
from sqlalchemy.orm import Session
import random

def seed_students():
    db = next(database.get_db())
    
    # 1. Get the course
    course = db.query(schemas.Course).filter(schemas.Course.code == "CS-401").first()
    if not course:
        print("Course CS-401 not found. Please run seed_demo.py first.")
        return

    # 2. Create Students
    student_data = [
        {"id": "2021-IU-101", "name": "Alice Johnson"},
        {"id": "2021-IU-102", "name": "Bob Smith"},
        {"id": "2021-IU-103", "name": "Charlie Davis"},
        {"id": "2021-IU-104", "name": "Diana Prince"},
    ]

    for data in student_data:
        student = db.query(schemas.Student).filter(schemas.Student.id == data["id"]).first()
        if not student:
            print(f"Creating student: {data['name']}")
            # We add a dummy 128-d embedding for demo purposes
            dummy_embedding = [random.uniform(-1, 1) for _ in range(128)]
            student = schemas.Student(
                id=data["id"],
                full_name=data["name"],
                face_embedding=dummy_embedding
            )
            db.add(student)
            db.commit()
            db.refresh(student)
        
        # Enroll student
        enrollment = db.query(schemas.Enrollment).filter(
            schemas.Enrollment.student_id == student.id,
            schemas.Enrollment.course_id == course.id
        ).first()
        if not enrollment:
            print(f"Enrolling {data['name']} in {course.name}")
            enrollment = schemas.Enrollment(student_id=student.id, course_id=course.id)
            db.add(enrollment)
    
    db.commit()
    print("Random student data and enrollments seeded successfully!")

if __name__ == "__main__":
    seed_students()
