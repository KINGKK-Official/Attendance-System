import json
import time
from backend.services.queue import get_consumer
from backend.models.database import SessionLocal
from backend.models.schemas import Course, SessionSentiment

def process_job(message):
    job = message.value
    print(f"[Analyzer] Processing sentiment job: {job}")
    
    course_id = job.get("course_id")
    
    db = SessionLocal()
    try:
        # Enforce consent gate: Must check before processing
        course = db.query(Course).filter(Course.id == course_id).first()
        if not course or not getattr(course, 'sentiment_consent_status', False):
            print(f"[Analyzer] Rejecting job for course {course_id} due to lacking consent.")
            return

        print(f"[Analyzer] Consent verified for course {course_id}. Processing sentiment.")
        
        # Simulate sentiment distribution scoring
        # In MVP, mock the stats
        sentiment = SessionSentiment(
            session_id=1, # Mock session
            course_id=course_id,
            neutral_pct=60.0,
            positive_pct=25.0,
            distracted_pct=15.0,
            sample_count=1
        )
        db.add(sentiment)
        db.commit()
    finally:
        db.close()

def main():
    consumer = get_consumer("sentiment_jobs", "analyzer_group")
    if not consumer:
        print("Failed to initialize Analyzer consumer.")
        return
        
    print("Analyzer Worker started. Listening for sentiment jobs...")
    for message in consumer:
        try:
            process_job(message)
        except Exception as e:
            print(f"Error processing job: {e}")

if __name__ == "__main__":
    time.sleep(5)
    main()
