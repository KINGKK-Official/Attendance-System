from models.database import engine, SessionLocal
from sqlalchemy import text

def update_db():
    print("Updating database schema for scheduling fields...")
    with engine.connect() as conn:
        try:
            # Check if columns already exist or just try to add them
            conn.execute(text("ALTER TABLE courses ADD schedule_days VARCHAR(50);"))
            print("Added schedule_days column.")
        except Exception as e:
            print(f"schedule_days column might already exist: {e}")
            
        try:
            conn.execute(text("ALTER TABLE courses ADD time_slot VARCHAR(50);"))
            print("Added time_slot column.")
        except Exception as e:
            print(f"time_slot column might already exist: {e}")
            
        conn.commit()
    print("Database update complete.")

if __name__ == "__main__":
    update_db()
