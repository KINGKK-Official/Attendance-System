# Roadmap - Attendance MVP

## Milestone 1: Core Foundation & RBAC
**Goal**: Working backend with database, authentication, and basic admin/faculty structures.

- **Phase 1: Project Scaffold & Database**
    - [x] Initialize FastAPI project structure.
    - [x] Setup SQL Server (SSMS) with SQLAlchemy.
    - [x] Create core models: User, Cluster, Course, Student.
- **Phase 2: Auth & User Management**
    - [ ] Implement JWT Authentication.
    - [ ] Admin endpoints for User/Student CRUD.
    - [ ] Faculty dashboard endpoints (Assigned Courses).

## Milestone 2: CV Engine & Biometrics
**Goal**: Ability to capture face data and run recognition hits.

- **Phase 3: Biometric Capture & Training**
    - [ ] Integrate OpenCV/InsightFace for embedding generation.
    - [ ] "Take Picture" endpoint for student enrollment.
- **Phase 4: Hit-Based Logic**
    - [ ] Implement Session and Attendance Record logic.
    - [ ] Background tasks for scheduled AI "Hits".

## Milestone 3: Frontend & Reports
**Goal**: Full UI for Admin and Faculty.

- **Phase 5: Admin UI**
    - [ ] Course/Cluster management screens.
    - [ ] Student enrollment with camera access.
- **Phase 6: Faculty UI & Reports**
    - [ ] Session trigger interface.
    - [ ] Manual override table.
    - [ ] Exportable reports (CSV/PDF).

- **Phase 7: Data Migration & Verification**
    - [x] Create attendance_db in SSMS.
    - [x] Migrate data from SQLite (attendance_mvp.db) to SQL Server.
    - [x] Verify database connectivity and schema integrity.

- **Phase 8: Cleanup, Delete Logic & UI Refinement**
    - [x] Remove PostgreSQL-specific code and Docker services.
    - [x] Add Delete endpoints for Users and Students in Backend.
    - [x] Implement Delete UI in Admin Dashboard.
    - [x] Fix Student Enrollment persistence issues.
    - [x] Improve UI alignment and mobile responsiveness.

## Status
| Phase | Name | Status |
|---|---|---|
| 1 | Project Scaffold & Database | ✅ Complete |
| 2 | Auth & User Management | ✅ Complete |
| 3 | Biometric Capture & Training | ✅ Complete |
| 4 | Hit-Based Logic | ✅ Complete |
| 5 | Admin UI | ✅ Complete |
| 6 | Faculty UI & Reports | ✅ Complete |
| 7 | Data Migration & Verification | ✅ Complete |
| 8 | Cleanup, Delete Logic & UI Refinement | ✅ Complete |
