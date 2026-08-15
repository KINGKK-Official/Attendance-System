"""
Lightweight, idempotent schema migration for the new columns/tables introduced
across Tasks 1-11. This stands in for Alembic in this MVP: it inspects the live
database and issues ADD COLUMN / CREATE TABLE statements only where missing.

Safe to run repeatedly. Works for both SQLite (MVP) and SQL Server.

Usage:
    python -m backend.migrations.add_upgrade_columns
"""
from sqlalchemy import inspect, text

from ..models import schemas, database

# table -> [(column_name, sql_type_sqlite, sql_type_mssql, default_clause)]
NEW_COLUMNS = {
    "students": [
        ("face_embedding_enc", "BLOB", "VARBINARY(MAX)", None),
        ("model_version", "VARCHAR(20)", "VARCHAR(20)", "'sface'"),
        ("needs_reenrolment", "BOOLEAN", "BIT", "0"),
    ],
    "users": [
        ("student_id", "VARCHAR(50)", "VARCHAR(50)", None),
    ],
    "courses": [
        ("warning_threshold", "FLOAT", "FLOAT", "80.0"),
        ("critical_threshold", "FLOAT", "FLOAT", "75.0"),
        ("hit_1_offset", "INTEGER", "INT", "30"),
        ("hit_2_offset", "INTEGER", "INT", "60"),
        ("tier2_timeout", "INTEGER", "INT", "10"),
        ("sentiment_consent_status", "BOOLEAN", "BIT", "0"),
    ],
    "enrollments": [
        ("at_risk", "BOOLEAN", "BIT", "0"),
    ],
    "sessions": [
        ("liveness_fail_count", "INTEGER", "INT", "0"),
        ("spoof_alert", "BOOLEAN", "BIT", "0"),
        ("hit_nonce_1", "VARCHAR(64)", "VARCHAR(64)", None),
        ("hit_nonce_2", "VARCHAR(64)", "VARCHAR(64)", None),
        ("hit_1_used", "BOOLEAN", "BIT", "0"),
        ("hit_2_used", "BOOLEAN", "BIT", "0"),
        ("hit_nonce_1_issued_at", "DATETIME", "DATETIME", None),
        ("hit_nonce_2_issued_at", "DATETIME", "DATETIME", None),
    ],
    "attendance_records": [
        ("embedding_confidence", "FLOAT", "FLOAT", None),
        ("hit_1_confidence", "FLOAT", "FLOAT", None),
        ("hit_2_confidence", "FLOAT", "FLOAT", None),
        ("liveness_score", "FLOAT", "FLOAT", None),
        ("consensus_status", "VARCHAR(20)", "VARCHAR(20)", None),
        ("requires_review", "BOOLEAN", "BIT", "0"),
    ],
    "system_settings": [
        ("cv_blur_threshold", "FLOAT", "FLOAT", "80.0"),
        ("cv_embedding_min_norm", "FLOAT", "FLOAT", "5.0"),
        ("liveness_threshold", "FLOAT", "FLOAT", "0.7"),
    ],
}


def run():
    engine = database.engine
    is_sqlite = engine.url.get_backend_name() == "sqlite"
    insp = inspect(engine)

    # 1. Create any brand-new tables (refresh_tokens, notifications, audit log)
    schemas.Base.metadata.create_all(bind=engine)
    print("Ensured all tables exist.")

    # 2. Add missing columns to pre-existing tables
    existing_tables = set(insp.get_table_names())
    with engine.begin() as conn:
        for table, cols in NEW_COLUMNS.items():
            if table not in existing_tables:
                continue  # create_all already handled brand-new tables
            existing_cols = {c["name"] for c in insp.get_columns(table)}
            for name, sqlite_type, mssql_type, default in cols:
                if name in existing_cols:
                    continue
                col_type = sqlite_type if is_sqlite else mssql_type
                ddl = f'ALTER TABLE {table} ADD COLUMN {name} {col_type}' if is_sqlite \
                    else f'ALTER TABLE {table} ADD {name} {col_type}'
                if default is not None:
                    ddl += f" DEFAULT {default}"
                try:
                    conn.execute(text(ddl))
                    print(f"  added {table}.{name}")
                except Exception as exc:
                    print(f"  ! could not add {table}.{name}: {exc}")
    print("Migration complete.")


if __name__ == "__main__":
    run()
