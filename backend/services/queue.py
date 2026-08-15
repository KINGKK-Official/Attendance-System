import json
import os
from kafka import KafkaProducer, KafkaConsumer

KAFKA_BOOTSTRAP_SERVERS = os.getenv("KAFKA_BOOTSTRAP_SERVERS", "localhost:9092")

# Kafka Producer initialization
producer = None

def get_producer():
    global producer
    if not producer:
        try:
            producer = KafkaProducer(
                bootstrap_servers=KAFKA_BOOTSTRAP_SERVERS,
                value_serializer=lambda v: json.dumps(v).encode('utf-8')
            )
        except Exception as e:
            print(f"Failed to connect to Kafka Producer: {e}")
    return producer

def publish_capture_event(camera_id, course_id, hit_number, scheduled_time, is_tier2=False):
    prod = get_producer()
    if not prod:
        return False
    
    topic = "cv_tier2_jobs" if is_tier2 else "cv_tier1_jobs"
    
    payload = {
        "camera_id": camera_id,
        "course_id": course_id,
        "hit_number": hit_number,
        "scheduled_time": scheduled_time.isoformat() if hasattr(scheduled_time, "isoformat") else scheduled_time,
    }
    
    # Partition by course_id to preserve ordering per class
    prod.send(topic, key=str(course_id).encode('utf-8'), value=payload)
    prod.flush()
    return True

def publish_sentiment_event(camera_id, course_id, capture_time):
    prod = get_producer()
    if not prod:
        return False
    
    payload = {
        "camera_id": camera_id,
        "course_id": course_id,
        "capture_time": capture_time.isoformat() if hasattr(capture_time, "isoformat") else capture_time,
    }
    
    prod.send("sentiment_jobs", key=str(course_id).encode('utf-8'), value=payload)
    prod.flush()
    return True

def get_consumer(topic, group_id):
    try:
        consumer = KafkaConsumer(
            topic,
            bootstrap_servers=KAFKA_BOOTSTRAP_SERVERS,
            group_id=group_id,
            value_deserializer=lambda m: json.loads(m.decode('utf-8')),
            auto_offset_reset='earliest'
        )
        return consumer
    except Exception as e:
        print(f"Failed to connect to Kafka Consumer: {e}")
        return None
