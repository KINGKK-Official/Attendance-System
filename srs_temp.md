Software Requirements Specification
AI-Driven Automated Attendance System (MVP)
Target Institution: IQRA University (IU)
Version 2.3 (Logs, Drift Monitoring & Consent Gate Revision)
Status: Core System — Production-Ready | v2.2/v2.3 Enhancements (Queuing, Tiered CV, RBAC, Federated Auth, Kafka+Redis, Logs, Drift Monitoring): Specified, Pending Implementation
1. System Overview
The Attendance MVP is an enterprise-grade automation system designed to eliminate manual attendance roll calls at IQRA University. By leveraging Computer Vision (CV) Edge Probing and a Dual-Hit Consensus Framework, the system scans student faces at set intervals during lectures, verifies their liveness, compares them against encrypted facial templates in the database, and auto-records attendance securely.
2. Completed Implementations & System Capabilities
2.1 Core Modules & Role-Based Access Control (RBAC)
System Administrator
User Directory & Management: Full CRUD for Faculty, IT Managers, and Students.
Academic Configuration: Assigning courses to clusters, setting warning/critical attendance thresholds.
Biometric Enrollment: Captured from webcam, auto-extracts facial templates, and securely encrypts them.
Bulk Upload: Standardized batch ingestion via CSV.
System-Wide Log Access: Full visibility into all audit and system logs across every department (Section 2.3).
Course Management (Attendance Hit Timing)  [NEW]
Per-Course Hit Scheduling: System Administrator (or a role granted this capability via Section 2.2) can configure Hit 1 and Hit 2 time offsets independently for each course, overriding the system default of T+30s / T+60s (Section 5.1). For example, setting a course's Hit 1 offset to 30 seconds initiates that course's Hit 1 capture at T+30s for every session of that course.
Validation Rules: The configured Hit 2 offset must be greater than Hit 1, and both must fall within the course's scheduled session duration; the system enforces minimum and maximum bounds to prevent misconfiguration (e.g., a Hit set at 0 seconds or beyond the class end time).
Default Behavior: Courses without a custom configuration use the system default Hit 1 (T+30s) / Hit 2 (T+60s) timing, unchanged from the original specification.
Tier 2 Timeout Configuration: The bounded maximum processing latency for Tier 2 escalation (Section 3.4 Backpressure & Timeout Policy) is also configurable per course via Course Management, using the same mechanism as Hit 1/Hit 2 timing. Courses without a custom value use the system default (Section 3.4).
Faculty Dashboard
Course Schedule: Overview of assigned lectures.
Live Session Monitoring: Start/stop attendance tracking and monitor the annotated video stream.
Manual Overrides: Authenticated overrides of AI decisions with mandatory audit reasons.
Unified Reporting: Cumulative, Section-wise, and Individual attendance reports with PDF export.
IT Manager Portal
Camera Configuration: Setup RTSP parameters, test host/port connectivity, save Dahua/Hikvision presets.
Live Stream & Audio Preview: Real-time network and audio consent-enabled stream previews.
PTZ & Preset Management: Pan, Tilt, Zoom controls mapped to Dahua CGI API.
Student Portal
Personal Attendance Dashboard: Interactive charts showing week-by-week presence.
Notification Inbox: Automated alerts for at-risk flagging (e.g. attendance below 75%).
Audit Checkpoint: View verified biometric enrollment status.
Head of Department (HOD)  [NEW]
Program & Semester Course Directory: Read access to all courses, sections, and time slots within their assigned program(s), scoped by semester.
Enrolled Student Roster Access: View enrolled students per course within their assigned program, including each student's full list of enrolled courses.
Scope: Access is scoped to the HOD's assigned department/program(s), not university-wide, consistent with least-privilege access. Flagged in Section 7 for confirmation this matches intent.
Extendable Capabilities: Additional capabilities (e.g., course creation) are not granted by default with this role; they are assigned individually via the Permission Assignment system (Section 2.2).
Department-Scoped Log Access: View audit and system logs limited to their assigned department/program (Section 2.3).
Analyzer Portal (Sentiment Analysis Role)  [NEW]
Session Sampling Schedule: Configures random-interval capture windows per class for engagement sampling; independent of the Dual-Hit attendance schedule.
Aggregate Session Sentiment: Consumes face-crop output already produced by the CV Engine's detection pass — no duplicate detection is run. Sentiment is scored and immediately aggregated to a session-level distribution (e.g. percentage neutral / positive / distracted); no per-student identity linkage is retained for sentiment records.
Semester-Wise Class Reports: Rolls up per-session aggregates (target: up to 64 samples/class/semester) into a per-class semester trend, viewable by Faculty and System Administrator only.
Queue Priority: Analyzer jobs are tagged low-priority in the message queue and never contend with attendance-critical (Dual-Hit) jobs for worker capacity.
Consent Gate (Technical Enforcement): Each course has a sentiment_consent_status flag (default: not approved) settable only by System Administrator, or a role explicitly granted this capability via Section 2.2. The Analyzer scheduler checks this flag before dispatching any sampling job for that course — if not approved, no sampling job is ever created. This is enforced at job-dispatch time, not only as a process or documentation requirement.
Defense-in-Depth Check: The Analyzer Worker independently re-checks the course's consent flag before processing any job it receives, so a stray or already-dispatched job cannot be processed if consent was revoked in the interim.
Renewable, Not Permanent: Consent approval is tied to a semester and must be explicitly renewed each semester rather than persisting indefinitely by default.
Immediate Revocation: If consent is revoked mid-semester, the flag change takes effect at the next scheduled sampling check — inherently short, given the system's random-interval sampling design — halting further sampling for that course without requiring a system restart.
Audit Trail: Every consent grant, renewal, and revocation is written to the Logs & Audit Trail (Section 2.3) with actor and timestamp.
2.2 Granular Permission Assignment (Dynamic RBAC)
In addition to the fixed role capabilities described in Section 2.1, System Administrator can grant or restrict individual capabilities on a per-role or per-user basis, so access can be tailored beyond each role's defaults without custom code changes.
Permission Catalog: The system maintains a catalog of discrete capabilities (e.g., Create Course, Edit Course, Manual Override, Export Reports, View Sentiment Data, Enroll Students, Manage Cameras, Assign Permissions).
Role Defaults: Each role (System Administrator, Faculty, IT Manager, Student, Head of Department, Analyzer) starts with the default capability set described in Section 2.1.
Admin-Granted Overrides: System Administrator can grant or revoke individual capabilities for any role or specific user — for example, granting a specific Head of Department the Create Course capability — layering on top of, or restricting, that role's defaults.
Non-Delegable Capability: The Assign Permissions capability itself is restricted to System Administrator by default and is not delegable, preventing a user granted elevated access from further granting access to others (see also Section 4.7).
Audit Trail: Every permission grant or revocation is written to the audit log with actor, target user/role, capability, and timestamp, following the same audit pattern as Manual Overrides (Section 2.1 Faculty Dashboard).
2.3 Logs & Audit Trail
A dedicated, queryable Logs module consolidates the audit trails produced across the system, rather than leaving them siloed inside each feature.
Unified Log Sources: Consolidates manual override records (Section 2.1 Faculty Dashboard), permission grant/revocation records (Section 2.2), Analyzer consent grant/renewal/revocation records (Section 2.1 Analyzer Portal), model threshold recalibration records (Section 3.6), attendance correction events from late Tier 2 results and timeout fallbacks (Section 3.4), and failed/dead-letter capture records (Section 3.4) into a single Logs view.
Role-Scoped Visibility: Head of Department views logs scoped to their assigned department/program only, consistent with their data-access scope elsewhere (Section 2.1). System Administrator views system-wide logs across all departments.
Immutability: Log entries are append-only; corrections are recorded as new entries rather than edits to existing ones, consistent with the audit patterns established elsewhere in the system.
Retention & Storage: Logs are persisted to SQL Server for querying and reporting; decision and correction events also flow through Kafka's durable log (Section 4.6) to support replay and cross-verification.
3. Computer Vision (CV) Engine Specifications
The system utilizes an advanced, localized Computer Vision stack based on SFace (ONNX) running over OpenCV to ensure rapid processing without external cloud dependencies.
3.1 Face Detection & Alignment
Detector: cv2.FaceDetectorYN (YuNet model).
Capabilities: Performs facial bounding-box location, eye/nose/mouth landmark detection, and aligns face frames to normalized pose prior to embedding extraction.
3.2 Face Recognition
Engine: cv2.FaceRecognizerSF (SFace model).
Embedding Output: Extracts a 128-dimensional floating-point vector representing unique facial topology.
Similarity Metric: Computes the Cosine Similarity between live captured vectors and stored enrollment vectors.
Thresholding: Configured dynamically in System Settings (default: 0.363 cosine distance).
3.3 Anti-Spoofing (Liveness Detection)
Engine: Passive Local Binary Patterns (LBP) texture analyzer.
Mitigation: Differentiates between a live human skin pattern and high-frequency noise from printed photos, phone screen replays, or masks.
3.4 Scalability & Queuing Layer  [NEW]
To support simultaneous operation across 110 classroom cameras without overloading a single server instance, the CV Engine is decoupled from real-time video streaming and backed by two complementary technologies: Apache Kafka for job queuing and event streaming, and Redis for low-latency in-memory caching. Both are required and serve distinct purposes — Kafka is not a replacement for Redis, nor Redis for Kafka.
RTSP Connection Lifecycle: Camera connections are opened only for the duration of a Dual-Hit capture (Hit 1 at T+30s, Hit 2 at T+60s) and closed immediately after frame acquisition. No persistent RTSP stream is held open for the duration of a lecture, minimizing concurrent network and decode load across classrooms.
Job Queue: Attendance capture events are published to Apache Kafka rather than executed as in-process background tasks. Topics are partitioned by classroom/course ID, preserving per-classroom ordering while allowing parallelism across all 110 classrooms. This decouples the Web Server from CV workload and absorbs simultaneous triggers across classes with overlapping schedules.
Consumer Groups: Kafka consumer groups mirror the system's job classes: the Tier 1 CV Worker Pool consumes attendance capture jobs, a separate Tier 2 Escalation Pool consumes escalation-only jobs, and the Analyzer Worker Pool consumes sentiment-sampling jobs — each independently scalable without contending with the others.
Kafka Payload Design: Kafka messages carry job dispatch metadata (camera ID, course ID, hit number, scheduled time) and result/decision events (match outcome, confidence, tier used, timestamp) only. Raw frames and biometric embeddings are never transmitted through Kafka; the CV Worker Pool pulls the frame directly from the camera via the short-lived RTSP connection at processing time, keeping Kafka's durable log free of raw biometric payloads. See also Section 4.6.
Retry & Dead-Letter Handling: Failed captures (e.g. unreachable camera, no face detected in either tier) are retried a bounded number of times and then routed to a dead-letter topic for manual review, rather than retried indefinitely.
Backpressure & Timeout Policy: Each hit has a bounded maximum processing latency, configurable per course via Course Management (Section 2.1) using the same mechanism as Hit 1/Hit 2 timing; the system default value is to be set from pilot measurements (Section 7.3). If Tier 1 and, where triggered, Tier 2 cannot produce a confident result within this window, the hit is finalized using the best-available result and flagged for manual override review. Any later-arriving result beyond the timeout is appended as a new audited correction event in the Logs & Audit Trail (Section 2.3) rather than silently overwriting the original decision.
Priority Handling: Queue jobs are tagged by type. Attendance-critical jobs (Hit 1, Hit 2) are processed at higher priority than non-time-sensitive jobs (e.g. Sentiment Analyzer sampling), ensuring attendance accuracy is never degraded by analytics workload.
Worker Pool: CV processing (face detection, recognition, liveness) runs in a horizontally scalable pool of stateless worker processes that consume from Kafka. Worker count scales up during peak class-start windows and scales down between sessions, rather than provisioning a single CV Engine instance sized for constant peak load.
Model Warm-Loading: YuNet and SFace models are loaded once per worker process at startup and held in memory, avoiding reload overhead on each capture event.
Roster & Embedding Caching: At session activation, the encrypted facial templates for a class's enrolled students (50–80 records) are decrypted once and cached in memory (Redis) for the duration of the session, rather than decrypted from the database on every Hit 1 / Hit 2 comparison. Cache is invalidated on session close or roster update. Redis security hardening for this cache is specified in Section 4.5.
Schedule Caching: The active class timetable (room-to-course-to-time mapping) is cached in memory and refreshed on a scheduled interval, rather than queried from the database on every capture trigger.
Database: SQL Server (SSMS) is the required backend for production deployment. SQLite is supported only for local development and testing; it is not suitable for concurrent multi-classroom write load in production.
3.5 Detection & Recognition Accuracy Enhancements  [NEW]
Classroom deployment introduces conditions the baseline YuNet/SFace stack was not originally tuned for: far-field faces (back-of-room students, 50–80 per class), small pixel-area faces from a 2MP sensor, off-angle poses, and mixed visible/IR lighting. Rather than replacing the existing detector/recognizer outright, a two-tier escalation model is used so the heavier, more accurate models are only invoked where they are actually needed — keeping average compute load low across 110 simultaneous classrooms.
Tier 1: Fast Pass (default, every capture)
Detector: cv2.FaceDetectorYN (YuNet), unchanged. Handles the majority case — clear, front-facing, adequately lit faces — at low compute cost.
Recognizer: cv2.FaceRecognizerSF (SFace), unchanged. Cosine-distance threshold (default 0.363, Section 3.2) continues to apply to Tier 1 matches.
Scope: Runs on every Dual-Hit capture across all 110 classrooms, as in the current production system. No change to existing accuracy, latency, or hardware profile for the common case.
Tier 2: Escalation Pass (selective, on ambiguous cases only)
Trigger Conditions: A face crop escalates to Tier 2 only when Tier 1 fails to detect or confidently match a face, or when a Tier 1 match falls into PRESENT_LOW_CONF / DISPUTED (Section 5.1), or when the session is flagged as IR-lit. Escalation is evaluated independently per hit: if Tier 1 fails on Hit 1, Tier 2 runs within Hit 1's processing window before that hit is finalized; the same applies independently to Hit 2. Tier 2 is never deferred to run only after both hits have completed.
Detector: YOLOv10-Face (nano variant). NMS-free, end-to-end architecture improves small-object and far-field detection recall relative to YuNet — applied only to the crops/frames that Tier 1 could not confidently resolve.
Recognizer: AdaFace (lightweight MobileFaceNet-backbone variant). Quality-adaptive margin loss designed for low-resolution, poorly-lit, and off-angle faces. Applied only to the same escalated subset, not to every capture.
Threshold Migration: AdaFace's embedding dimensionality and score distribution differ from SFace's 128-d cosine-distance output. A separate, independently calibrated confidence threshold is maintained for Tier 2 matches; the Tier 1 threshold is not reused.
Timeout Fallback: If Tier 2 cannot resolve within the bounded processing window defined in Section 3.4's Backpressure & Timeout Policy (configurable per course via Course Management, Section 2.1), the hit finalizes on the best-available result and is flagged for manual override review.
Encryption Compatibility: Tier 2 embeddings are encrypted at rest using the same Fernet pipeline (Section 4.1) as Tier 1 embeddings; no change to the cryptographic architecture is required.
Compute Impact
Selective Load: Because Tier 2 only processes the ambiguous minority of captures (failed detections, low-confidence matches, IR sessions) rather than all 50–80 students across all 110 classrooms on every hit, average GPU load stays close to the existing Tier 1 baseline, with headroom consumed only when accuracy actually needs it.
Worker Pool Fit: Tier 2 inference is routed through the same queue and worker pool (Section 3.4) as a higher-latency, lower-priority job class, so it does not block or slow down Tier 1 processing or attendance-critical Dual-Hit timing.
Phased Rollout: Recommended as a piloted addition on a subset of classrooms first — particularly larger rooms and IR-lit early sessions where Tier 1 is weakest — with Tier 2 escalation rate and accuracy lift measured before wider rollout.
Supporting Reliability Measures
Multi-Scale Detection Tuning: Tier 1 detector input scales are tuned to reliably resolve small, far-field faces where feasible, reducing how often escalation to Tier 2 is needed at all.
Face Crop Quality Gating: Each detected face crop is checked for minimum size, blur, and brightness before recognition (either tier); crops failing the gate are excluded from matching rather than forced through recognition.
Multi-Frame Capture per Hit: Each Dual-Hit capture may draw 2–3 closely spaced frames, merging results so a student occluded or turned away in one frame can still be matched from another, at either tier.
Low-Confidence Routing: Matches below the applicable tier's confidence threshold — whether produced by Tier 1 or Tier 2 — are never auto-accepted. They are flagged PRESENT_LOW_CONF / DISPUTED (Section 5.1) and require mandatory manual override review by Faculty, rather than being forced to a PRESENT or ABSENT decision.
3.6 Model Drift Monitoring & Recalibration  [NEW]
Detection and recognition accuracy for both tiers can degrade over time due to camera hardware aging (lens dust, IR LED degradation), seasonal lighting shifts, and new student cohorts entering each semester. This section defines how drift is detected and how thresholds are safely updated, rather than left to silently decay.
Drift Signals: The system tracks rolling per-camera and per-course metrics — Tier 1→Tier 2 escalation rate, PRESENT_LOW_CONF / DISPUTED rate, and manual override rate — over a trailing window of recent sessions. A sustained rise in any of these relative to that camera/course's own historical baseline is treated as a drift signal, not as an automatic threshold change.
Per-Camera Isolation: Drift signals are tracked per physical camera, not only system-wide, so a single degrading camera (failing IR LED, drifting mount angle) can be flagged for IT Manager hardware review (Section 2.1 IT Manager Portal) without altering thresholds for every other classroom.
Scheduled Recalibration Cadence: A full threshold review is performed at minimum once per semester, timed to the start of term after biometric enrollment for the new cohort is complete, since each new cohort changes the embedding population thresholds are matched against.
Event-Triggered Recalibration: Independent of the scheduled cadence, if a drift signal crosses a defined bound, an out-of-cycle recalibration review is triggered automatically rather than waiting for the next semester boundary.
Validation Against Ground Truth: Recalibration decisions are evaluated against a small held-out set of manually-verified attendance sessions (confirmed via Faculty Manual Override records, Section 2.1), so a threshold change is based on measured precision/recall rather than drift signals alone.
Threshold Versioning & Governance: Threshold changes are versioned with an effective date and require System Administrator approval. Each change is written to the Logs & Audit Trail (Section 2.3) with the previous value, new value, approving user, and the supporting validation metrics.
4. Security & Cryptographic Systems
Security is woven directly into the backend architecture to prevent data leaks, SSRF, injection, and replay attacks.
4.1 Biometric Encryption At Rest
Algorithm: Fernet Symmetric Encryption (built on top of AES-128 in CBC mode with HMAC-SHA256).
Implementation: Facial embeddings are encrypted before database insertion. Reference templates cannot be reverse-engineered from ciphertext without the encryption key.
Fallback: Auto-falls back to dev-mode plaintext storage only if the key environment variable is absent.
4.2 Anti-Replay Protection
Mechanism: Cryptographic single-use nonces are generated on session activation.
Verification: When a background hit executes, it validates the issued nonce for the session block, preventing attackers from replaying a previously captured frame or response.
4.3 Network SSRF & Port Protection
Allowed Subnets Gate: Server-side RTSP hosts are validated against a strict subnet whitelist (ALLOWED_CAMERA_SUBNETS).
Active Port Check: Connects via raw TCP sockets first with a 2-second timeout. Unreachable cameras fail early with a user-facing error rather than hanging the request.
4.4 Authentication and Token Management
Mechanism: JWT OAuth2 authentication.
Token Rotation: Short-lived access tokens (15 mins) combined with securely hashed, revocable refresh tokens (7 days).
Revocation: In-memory JTI revocation set with automatic background TTL expiration cleanup.
Federated Identity Providers: In addition to username/password login, users may authenticate via Google OAuth2/OIDC, Microsoft OAuth2/OIDC (personal accounts), or the university's institutional Microsoft identity (Microsoft Entra ID, @iqra.edu.pk).
Institutional Domain Validation: For the @iqra.edu.pk login path, the server validates the domain/tenant claim in the returned OIDC token before granting access; a personal Google or Microsoft account cannot be used to assume an institutional identity.
Account Matching Policy: Federated login authenticates identity only; it does not auto-provision new accounts. The authenticated email must match an existing user record created by System Administrator (Section 2.1 User Directory & Management); unmatched identities are rejected at login.
Post-Federation Token Issuance: After successful federated authentication, the system issues its own short-lived JWT access token and refresh token via the mechanism above, so downstream authorization and revocation logic remain unchanged regardless of login method.
4.5 Session Cache Security (Redis)
The in-memory roster/embedding cache (Section 3.4) holds decrypted biometric templates for the duration of a session — a different trust boundary than the encrypted-at-rest data in Section 4.1, requiring its own safeguards.
Authentication & Transport: Redis instances used for roster/embedding caching require AUTH (or ACL-based credentials) and TLS in transit; unauthenticated or plaintext connections are not permitted.
Persistence Disabled: RDB snapshotting and AOF persistence are disabled for the session-cache Redis instance so decrypted embeddings are never written to disk — the cache is memory-only and lost on restart by design.
Network Isolation: Redis is reachable only from the CV Worker Pool subnet, following the same allowed-subnet gating principle already applied to camera connections (Section 4.3).
TTL Enforcement: Cache entries carry a TTL matching the session length as a backstop to the explicit invalidation on session close (Section 3.4), so an entry cannot outlive its session even if the close event is missed.
4.6 Event Streaming Security (Kafka)
Kafka (Section 3.4) is a new persistent component in the architecture and is scoped and secured accordingly.
Broker Authentication: Kafka brokers require SASL authentication and TLS for both producer and consumer connections; unauthenticated clients are rejected.
Topic-Level ACLs: Each service (Web Server, CV Worker Pool, Tier 2 Escalation Pool, Analyzer Worker) is granted access only to the specific topics it needs to produce or consume, not broker-wide access.
Payload Minimization: As specified in Section 3.4, topics carry job metadata and decision events only — never raw frames or biometric embeddings — limiting what is exposed even if a topic's retention log were compromised.
Retention Policy: Topic retention is tuned per sensitivity: operational/dispatch topics use a short retention window, while decision/audit-trail topics may be retained longer to support the append-only audit requirement, with broker-side encryption at rest in either case.
4.7 Permission Assignment Safeguards
The Granular Permission Assignment system (Section 2.2) introduces the ability to reshape access at runtime, which carries its own risk if not constrained.
Non-Delegable Admin Capability: The Assign Permissions capability is restricted to System Administrator and cannot itself be granted to another role or user, preventing privilege-escalation chains.
Full Audit Logging: Every permission change is logged with actor, target, capability, and timestamp (Section 2.2), reviewable by System Administrator.
Periodic Review: Granted overrides — especially any granting write/creation capabilities outside a role's default — should be periodically reviewed rather than left indefinitely, to avoid silent privilege creep across semesters.
5. Attendance Consensus and Notification Logic
5.1 Dual-Hit Consensus
To ensure high-integrity attendance records and capture class stability, the system runs a Dual-Hit Consensus pipeline:
Hit 1 (default T+30s): Captures initial arrival. Configurable per course via Course Management (Section 2.1); falls back to this default if not customized.
Hit 2 (default T+60s): Verifies classroom stability. Configurable per course via Course Management (Section 2.1), and must be later than that course's configured Hit 1 offset.
Consensus Matrix: 
PRESENT: Student matched in both Hit 1 and Hit 2.
PRESENT_LOW_CONF: Matched in one hit, but embedding confidence or liveness is marginally low. Placed in review.
DISPUTED: Present in one hit, absent in the other. Requires manual override.
ABSENT: Missed in both hits.
5.2 At-Risk Notifications
Threshold Trigger: If a student's attendance percentage falls below the course's warning threshold (e.g., 80%) or critical threshold, an escalation is queued.
Alert Generation: An automated, in-app notification is sent to the student's portal detailing their status and warning them of academic risk.
6. System Architecture
The architecture below reflects the revised, queue-mediated data flow. Persistent per-classroom RTSP streaming has been replaced with scheduled, short-lived connections brokered through a message queue and a scalable worker pool (Section 3.4).
6.1 Revised Component Flow
Browser Client ↔ React/Vite over HTTPS ↔ FastAPI Web Server
Browser Client / FastAPI Web Server ↔ Federated Identity Providers (Google OIDC, Microsoft OIDC, Microsoft Entra ID @iqra.edu.pk) → internal JWT issuance (Section 4.4) [NEW]
FastAPI Web Server → Permission Assignment check (Section 2.2) → route or deny access per capability [NEW]
FastAPI Web Server ↔ SQLAlchemy / SSMS ↔ SQL Server Database
FastAPI Web Server → publishes capture events → Apache Kafka, partitioned by classroom/course [NEW]
Kafka → consumer groups → CV Worker Pool (Tier 1), Tier 2 Escalation Pool, and Analyzer Worker Pool, each independently scalable [NEW]
CV Worker Pool ↔ short-lived RTSP TCP connection ↔ Classroom IP Cameras (open only for Hit 1 / Hit 2)
CV Worker Pool → Tier 1: YuNet + SFace (every capture) → Tier 2 escalation: YOLOv10-Face + AdaFace, inline per hit (ambiguous/failed/IR cases only) [NEW]
CV Worker Pool → LBP Texture Analysis → Liveness Detector
CV Worker Pool ↔ Fernet Encrypt/Decrypt ↔ Cryptography Service
CV Worker Pool ↔ in-memory roster & schedule cache (Redis, secured per Section 4.5) ↔ SQL Server Database [NEW]
Analyzer Worker Pool (Kafka consumer group, low priority) → reads face-crop output from CV Worker Pool → writes aggregated session sentiment → SQL Server Database [NEW]
CV Worker Pool / Tier 2 Escalation Pool → rolling accuracy metrics → Model Drift Monitoring (Section 3.6) [NEW]
Kafka decision/correction events + SQL Server audit tables → aggregated into → Logs & Audit Trail (Section 2.3), role-scoped by department [NEW]
7. Open Risks, Clarifications & Action Items
This section tracks items surfaced during architecture review that affect implementation, security, or governance. It is intended to be worked through and resolved as the system is built, not a permanent caveat list.
7.1 Resolved in v2.2
Tier 2 escalation timing: Clarified as inline, per-hit execution (Section 3.5), not deferred batch processing.
Configurable Hit timing: Course Management (Section 2.1) allows per-course Hit 1 / Hit 2 offsets with validation rules.
New role — Head of Department: Added with program/semester-scoped read access (Section 2.1).
Granular permission assignment: Admin-configurable capability matrix added (Section 2.2), with a non-delegable Assign Permissions safeguard (Section 4.7).
Federated login: Google, Microsoft personal, and institutional Microsoft (@iqra.edu.pk) sign-in added with strict account-matching (Section 4.4).
Redis attack surface: Addressed with AUTH/TLS, disabled persistence, network isolation, and TTL enforcement (Section 4.5).
Message queue durability vs. biometric data: Resolved by restricting Kafka payloads to metadata/decisions only — raw frames and embeddings never transit Kafka (Sections 3.4, 4.6).
7.2 Resolved in v2.3
Model drift / recalibration cadence: Resolved with a full drift-monitoring and recalibration framework (Section 3.6): per-camera/per-course drift signals, scheduled and event-triggered recalibration, validation against a held-out ground-truth set, and versioned/audited threshold changes.
Analyzer consent gate: Resolved as a hard technical gate, not a process step (Section 2.1 Analyzer Portal): a default-denied per-course consent flag checked at job-dispatch time and again by the worker itself, renewable per semester, with immediate effect on revocation and full audit logging.
Kafka vs. Redis clarification: Both are in use for distinct purposes — Kafka for job queuing/event streaming, Redis for in-memory caching — neither replaces the other (Section 3.4).
Tier 2 timeout configurability: The Tier 2 processing-latency timeout is now configurable per course via Course Management, the same mechanism used for Hit 1/Hit 2 (Sections 2.1, 3.4, 3.5).
Logs & Audit Trail: Added as its own module (Section 2.3), consolidating overrides, permission changes, consent events, recalibration events, and correction/dead-letter events, with Head of Department scoped to their department and System Administrator seeing system-wide logs.
7.3 Requires Further Decision
HOD department/program scope: Assumed scoped to the HOD's assigned department(s), not university-wide, per least-privilege — please confirm this matches intent.
Hit and Tier 2 timeout bounds: Specific minimum/maximum offset values for Hit 1/Hit 2 and the Tier 2 timeout in Course Management (Section 2.1) need to be defined with Faculty/Admin input, not left as general "sane bounds."
System default timeout value: The system-default Tier 2 processing latency (used when a course has no custom override) needs a concrete value chosen from real Tier 2 latency measurements once piloted.
Kafka operational ownership: Kafka is heavier to operate than a Redis-only queue (cluster management, monitoring, partition/replication planning). Confirm the team has, or will build, this operational capacity before committing it to production.
Permission review cadence: Section 4.7 recommends periodic review of granted overrides; an owner and cadence (e.g., each semester) should be assigned.
Drift signal thresholds: The rolling-window size and the specific drift-signal bounds that trigger event-based recalibration (Section 3.6) need concrete values, similar to the Hit timing bounds above.
Validation set ownership: The held-out ground-truth set used for recalibration (Section 3.6) needs an owner and a defined process for refreshing it each semester so it does not itself go stale.
7.4 Carried Forward (Still Open)
None outstanding as of v2.3. Both items previously tracked here — model drift/recalibration cadence and the Analyzer consent gate — are resolved above (Section 7.2).
End of Revised Architecture Specification Document
Revision notes (v2.3): Added Section 2.3 (Logs & Audit Trail) consolidating overrides, permission changes, consent events, recalibration events, and correction/dead-letter events, scoped by department for Head of Department and system-wide for System Administrator. Added Section 3.6 (Model Drift Monitoring & Recalibration) with per-camera drift signals, scheduled and event-triggered recalibration, ground-truth validation, and versioned/audited threshold changes. Rebuilt the Analyzer's consent requirement (Section 2.1) into a hard technical gate: default-denied per-course flag checked at dispatch and again by the worker, renewable per semester, audited. Clarified that Kafka and Redis are both in use for distinct purposes (Section 3.4), and that the Tier 2 processing timeout is configurable per course via Course Management, same as Hit 1/Hit 2 (Sections 2.1, 3.4, 3.5). Section 7 restructured to separate v2.2 and v2.3 resolutions from remaining open items. All other content from v2.2 is unchanged.