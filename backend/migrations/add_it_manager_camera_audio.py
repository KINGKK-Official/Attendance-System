"""Migration — IT-Manager upgrade: camera capability/consent columns + IT audit & monitor tables.
Run:  python -m backend.migrations.add_it_manager_camera_audio"""
import os, sys
from sqlalchemy import inspect, text
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(__file__))))
from backend.models import database, schemas  # noqa

NEW_COLS = {"classrooms": [
    ("has_audio", "BOOLEAN DEFAULT 0"), ("has_ptz", "BOOLEAN DEFAULT 0"),
    ("last_codec", "VARCHAR(50)"), ("last_resolution", "VARCHAR(50)"),
    ("audio_consent_on_file", "BOOLEAN DEFAULT 0")]}

def run():
    engine = database.engine; insp = inspect(engine)
    with engine.begin() as conn:
        for tbl, cols in NEW_COLS.items():
            if tbl not in insp.get_table_names():
                print(f"  table {tbl} missing; create_all will handle it."); continue
            existing = {c["name"] for c in insp.get_columns(tbl)}
            for name, ddl in cols:
                if name not in existing:
                    print(f"  + {tbl}.{name}"); conn.execute(text(f"ALTER TABLE {tbl} ADD COLUMN {name} {ddl}"))
                else:
                    print(f"  = {tbl}.{name} present")
    schemas.Base.metadata.create_all(bind=engine)
    print("Migration complete.")

if __name__ == "__main__":
    run()
