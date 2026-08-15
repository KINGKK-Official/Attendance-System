import json
import time
from backend.services.queue import get_consumer, publish_capture_event
from backend.models.database import SessionLocal
from backend.models.schemas import Course, AttendanceRecord, FinalStatus, UnifiedAuditLog

def process_job(message):
    job = message.value
    print(f"[Tier 1] Processing job: {job}")
    
    # In MVP, we mock the CV processing
    camera_id = job.get("camera_id")
    course_id = job.get("course_id")
    hit_number = job.get("hit_number")
    
    db = SessionLocal()
    try:
        # Simulate Tier 1 outcome (YuNet + SFace)
        # We will mock a low confidence match for testing Tier 2 escalation
        confidence = 0.5 # Below threshold to trigger tier 2
        
        if confidence < 0.6: # Simulate low confidence
            print(f"[Tier 1] Low confidence ({confidence}). Escalating to Tier 2.")
            publish_capture_event(
                camera_id=camera_id, 
                course_id=course_id, 
                hit_number=hit_number, 
                scheduled_time=job.get("scheduled_time"), 
                is_tier2=True
            )
        else:
            print(f"[Tier 1] High confidence ({confidence}). Saving result.")
            # Normal DB update logic here...
    finally:
        db.close()

def main():
    consumer = get_consumer("cv_tier1_jobs", "cv_tier1_group")
    if not consumer:
        print("Failed to initialize Tier 1 consumer.")
        return
        
    print("Tier 1 Worker started. Listening for jobs...")
    for message in consumer:
        try:
            process_job(message)
        except Exception as e:
            print(f"Error processing job: {e}")

if __name__ == "__main__":
    # Add a small delay to ensure Kafka is up in docker-compose
    time.sleep(5)
    main()
