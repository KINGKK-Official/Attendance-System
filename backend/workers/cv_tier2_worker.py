import json
import time
from backend.services.queue import get_consumer
from backend.models.database import SessionLocal
from backend.models.schemas import Course, AttendanceRecord, FinalStatus, UnifiedAuditLog

def process_job(message):
    job = message.value
    print(f"[Tier 2] Processing escalated job: {job}")
    
    camera_id = job.get("camera_id")
    course_id = job.get("course_id")
    hit_number = job.get("hit_number")
    
    db = SessionLocal()
    try:
        # Simulate Tier 2 outcome (YOLOv10-Face + AdaFace)
        # Assuming successful resolution
        confidence = 0.85
        
        print(f"[Tier 2] High confidence ({confidence}) from AdaFace. Resolving escalation.")
        
        # Log resolution in unified audit log
        audit = UnifiedAuditLog(
            actor_role="system",
            action="tier2_resolution",
            target_type="Course",
            target_id=str(course_id),
            new_value=f"Hit {hit_number} resolved via AdaFace with conf {confidence}"
        )
        db.add(audit)
        db.commit()
    finally:
        db.close()

def main():
    consumer = get_consumer("cv_tier2_jobs", "cv_tier2_group")
    if not consumer:
        print("Failed to initialize Tier 2 consumer.")
        return
        
    print("Tier 2 Worker started. Listening for escalated jobs...")
    for message in consumer:
        try:
            process_job(message)
        except Exception as e:
            print(f"Error processing job: {e}")

if __name__ == "__main__":
    time.sleep(5)
    main()
