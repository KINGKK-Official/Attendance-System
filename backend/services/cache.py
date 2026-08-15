import redis
import os
import json

REDIS_HOST = os.getenv("REDIS_HOST", "localhost")
REDIS_PORT = int(os.getenv("REDIS_PORT", 6379))
REDIS_PASSWORD = os.getenv("REDIS_PASSWORD", "attendance_redis_pass")

redis_client = None

def get_redis():
    global redis_client
    if not redis_client:
        try:
            redis_client = redis.Redis(
                host=REDIS_HOST,
                port=REDIS_PORT,
                password=REDIS_PASSWORD,
                decode_responses=True
            )
        except Exception as e:
            print(f"Failed to connect to Redis: {e}")
    return redis_client

def cache_session_roster(session_id, roster_data_json_str, ttl_seconds=7200):
    client = get_redis()
    if not client: return False
    
    key = f"roster:{session_id}"
    client.set(key, roster_data_json_str, ex=ttl_seconds)
    return True

def get_cached_roster(session_id):
    client = get_redis()
    if not client: return None
    
    key = f"roster:{session_id}"
    return client.get(key)

def invalidate_session_roster(session_id):
    client = get_redis()
    if not client: return False
    
    key = f"roster:{session_id}"
    client.delete(key)
    return True
