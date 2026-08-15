# Requirements - Attendance MVP

## Functional Requirements

### [Admin Module]
- **REQ-A01**: User Management (Create/Update/Delete Faculty and Students).
- **REQ-A02**: Course & Cluster Management (Group courses into clusters).
- **REQ-A03**: Student Biometrics (Take Picture button to capture face and generate 512-d embedding).
- **REQ-A04**: Policy Configuration (75% attendance threshold flagging).
- **REQ-A05**: Data Import (Bulk upload Students/Courses via CSV).

### [Faculty Module]
- **REQ-F01**: Course Dashboard (View assigned courses only).
- **REQ-F02**: Session Control (Start AI Attendance for a specific session).
- **REQ-F03**: Manual Override (Modify hit results before final save).
- **REQ-F04**: Reports (Cumulative Course Report, Classroom Report, Individual Student Report).

### [CV Engine]
- **REQ-C01**: Face Detection (Multi-face detection in a single frame).
- **REQ-C02**: Face Recognition (Match detected faces against stored embeddings).
- **REQ-C03**: Hit Logic (Execute detection at T+X minutes and mark status).

### [System/Auth]
- **REQ-S01**: RBAC Authentication (Login redirects based on 'Admin' or 'Faculty' role).
- **REQ-S02**: API Security (JWT token protected endpoints).

## Data Requirements
- **Lead Model**: id, name, enrollment_date, image_path, face_embedding (512-d).
- **Attendance Record**: session_id, student_id, hit1_present, hit2_present, final_status, is_manual_override.

## Non-Functional Requirements
- **Accuracy**: 100% identity fidelity for recognized faces.
- **Latency**: Hit processing should complete within < 10 seconds.
- **Privacy**: Face data stored as embeddings, not raw pixels (where possible).
