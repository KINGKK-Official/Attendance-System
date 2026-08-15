"""
Seed demo students across ALL courses so every faculty can take attendance.
This version enrolls EVERY student in EVERY course for maximum coverage.
"""
import sys
sys.path.insert(0, '.')

from backend.models.database import SessionLocal
from backend.models.schemas import Course, Student, Enrollment

def seed():
    db = SessionLocal()
    try:
        courses = db.query(Course).all()
        students = db.query(Student).all()
        print(f"Found {len(courses)} course(s) and {len(students)} student(s)")

        if not students:
            print("No students found in database. Run seed_students first!")
            return

        for course in courses:
            print(f"\nCourse: {course.name} (id={course.id})")
            for student in students:
                # Check if already enrolled
                existing = db.query(Enrollment).filter(
                    Enrollment.student_id == student.id,
                    Enrollment.course_id == course.id
                ).first()
                
                if not existing:
                    db.add(Enrollment(student_id=student.id, course_id=course.id))
                    print(f"  Enrolled {student.full_name} ({student.id}) -> {course.name}")
                else:
                    print(f"  Already enrolled: {student.full_name} ({student.id})")

        db.commit()
        print("\nDone! All students now enrolled in all courses.")
    except Exception as e:
        db.rollback()
        print(f"ERROR: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    seed()
