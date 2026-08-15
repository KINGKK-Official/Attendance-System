 +# Attendance System MVP - Project Brain & History

## Architecture & Infrastructure
- **Backend:** FastAPI, SQLAlchemy (SQLite for MVP, MSSQL ready)
- **Frontend:** React + Vite
- **Event Bus:** Kafka (running in Docker)
- **Cache / State:** Redis (running in Docker)
- **Deployment:** Docker Compose managing 7 services (`backend`, `cv_tier1_worker`, `cv_tier2_worker`, `analyzer_worker`, `kafka`, `zookeeper`, `redis`)

## Recent Work (v2.3 Compliance & Audit Fixes)
1. **Background Workers & Decoupling:**
   - Moved CV and Analyzer logic into standalone background workers (`cv_tier1_worker.py`, `cv_tier2_worker.py`, `analyzer_worker.py`).
   - Implemented Kafka event publishing from API (`services/queue.py`) and subscribing in workers.
   - Updated `docker-compose.yml` to spin up workers alongside the backend, passing proper `KAFKA_BOOTSTRAP_SERVERS` and `REDIS_URL` to ensure container-to-container connectivity.

2. **Unified Audit Log:**
   - Consolidated `attendance_audit_log` and `it_audit_log` into a `UnifiedAuditLog` model in `schemas.py`.
   - Enforced an **Append-Only** constraint using SQLAlchemy `before_update` and `before_delete` event listeners to prevent tampering.

3. **Granular RBAC (Role-Based Access Control):**
   - Implemented `Permission` and `RolePermissionOverride` tables.
   - Created `dependencies.py` to enforce permissions like `require_permissions("Manage Users")`.
   - Updated the API endpoints (`admin.py`, `faculty.py`, `it_manager.py`) to check these fine-grained permissions instead of simple role checks.

4. **Frontend Updates:**
   - Updated `HODDashboard`, `AnalyzerPortal`, and `AdminDashboard` to conform to v2.3 SRS requirements.

## Current State & Next Steps
- The infrastructure is fully Dockerized and currently running.
- We are completing the removal of temporary files used for local testing (e.g., `test_audit.py`, `recreate_db.py`).
- All v2.3 SRS components (Event-driven Architecture, Unified Audit, Granular RBAC) are implemented and integrated.
