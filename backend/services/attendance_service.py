import cv2
import random
from sqlalchemy.orm import Session
from datetime import datetime
import time

from ..models import schemas, database
from .ai_service import get_ai_engine, _cv_log
from . import crypto_service, audit_service, notification_service, camera_service

ACTIVE_HITS = set()


def _get_fresh_db() -> Session:
    """Open a fresh DB session, fully independent of request scope."""
    return database.SessionLocal()


def _load_settings(db: Session) -> schemas.SystemSettings:
    settings = db.query(schemas.SystemSettings).first()
    if not settings:
        settings = schemas.SystemSettings()
        db.add(settings)
        db.commit()
        db.refresh(settings)
    return settings


def _student_embedding(student) -> list | None:
    """Return a usable embedding list from encrypted bytes or legacy JSON text."""
    if getattr(student, "face_embedding_enc", None):
        emb = crypto_service.embedding_to_list(student.face_embedding_enc)
        if emb is not None:
            return emb
    if student.face_embedding:
        return crypto_service.embedding_to_list(student.face_embedding)
    return None


def process_attendance_hit(session_id: int, hit_number: int):
    """
    Process one attendance hit for a session.
    Opens and closes its own DB session so it is safe to call from a background thread.
    """
    print(f"Starting Attendance Hit {hit_number} for Session {session_id}...")
    ACTIVE_HITS.add(session_id)
    db = _get_fresh_db()
    try:
        session = db.query(schemas.Session).filter(schemas.Session.id == session_id).first()
        if not session:
            _cv_log("SESSION_NOT_FOUND", session_id=session_id, detail=f"hit={hit_number}")
            return

        settings = _load_settings(db)
        classroom = db.query(schemas.Classroom).filter(schemas.Classroom.id == session.room_id).first()
        camera_url = camera_service.build_rtsp_url(classroom) if classroom else None

        _cv_log("HIT_START", session_id=session_id, detail=f"hit={hit_number} camera='{camera_url}'")

        frame = None
        if camera_url:
            try:
                if camera_url == "0":
                    cap = cv2.VideoCapture(0)
                    ret, f_bgr = cap.read()
                    cap.release()
                    if ret: frame = f_bgr
                else:
                    import imageio_ffmpeg
                    import numpy as np
                    gen_test = imageio_ffmpeg.read_frames(
                        camera_url,
                        pix_fmt="bgr24",
                        input_params=["-rtsp_transport", "tcp"]
                    )
                    meta_test = next(gen_test)
                    w_t, h_t = meta_test.get("size", (0, 0))
                    if w_t > 0 and h_t > 0:
                        f_bytes = next(gen_test)
                        frame = np.frombuffer(f_bytes, dtype=np.uint8).reshape((h_t, w_t, 3))
                    gen_test.close()
            except Exception as e:
                _cv_log("CAMERA_READ_FAIL", session_id=session_id, detail=f"camera='{camera_url}' err={str(e)}")
                frame = None

        # ─── DEMO MODE — no real camera ───────────────────────────────────
        if frame is None:
            _demo_mark(db, session, session_id, hit_number)
            _post_hit(db, session, session_id, hit_number)
            return

        # ─── REAL MODE — AI engine ────────────────────────────────────────
        ai = get_ai_engine()
        ai.apply_settings(settings)
        comparison_threshold = settings.face_comparison_threshold or 0.363

        try:
            if camera_url == "0":
                def _webcam_gen():
                    cap = cv2.VideoCapture(0)
                    if cap.isOpened():
                        yield {"size": (int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)), int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT)))}
                        while True:
                            ret, bgr = cap.read()
                            if not ret: break
                            yield bgr.tobytes()
                    cap.release()
                gen = _webcam_gen()
            else:
                import imageio_ffmpeg
                gen = imageio_ffmpeg.read_frames(
                    camera_url,
                    pix_fmt="bgr24",
                    input_params=["-rtsp_transport", "tcp"]
                )
            meta = next(gen)
            w, h = meta.get("size", (0, 0))
            if w == 0 or h == 0:
                iterator = None
            else:
                iterator = gen
        except Exception:
            iterator = None

        start_time = time.time()
        # student_id -> best (confidence, liveness_score)
        matched: dict[str, tuple[float, float]] = {}

        enrolled_students = (
            db.query(schemas.Student)
            .join(schemas.Enrollment)
            .filter(schemas.Enrollment.course_id == session.course_id)
            .all()
        )

        _cv_log("LIVE_FEED_START", session_id=session_id, detail="duration=5s")
        frame_idx = 0
        while (time.time() - start_time) < 5.0 and iterator is not None:
            try:
                raw_bytes = next(iterator)
                import numpy as np
                raw = np.frombuffer(raw_bytes, dtype=np.uint8).reshape((h, w, 3))
            except StopIteration:
                break
            except Exception:
                continue

            frame_idx += 1
            if frame_idx % 5 != 0:
                continue

            # Task 1: pre-process; skip blurry / duplicate frames
            frame = ai.preprocess_frame(raw, session_id=session_id)
            if frame is None:
                continue

            detection_results = ai.detect_and_embed(frame, session_id=session_id)

            for det in detection_results:
                d_emb = det["embedding"]
                bbox = det["bbox"]
                confidence = det.get("embedding_confidence", 0.0)
                is_live = det.get("is_live", True)
                liveness_score = det.get("liveness_score", 1.0)

                # Task 2: reject spoofed faces
                if not is_live:
                    _cv_log("LIVENESS_FAIL", session_id=session_id, student_id="unknown",
                            detail=f"score={liveness_score:.2f}")
                    session.liveness_fail_count = (session.liveness_fail_count or 0) + 1
                    if session.liveness_fail_count >= 3 and not session.spoof_alert:
                        session.spoof_alert = True
                        _cv_log("SPOOF_ALERT", session_id=session_id,
                                detail=f"fail_count={session.liveness_fail_count}")
                    db.commit()
                    x, y, w, h = bbox
                    cv2.rectangle(frame, (x, y), (x + w, y + h), (0, 165, 255), 2)
                    cv2.putText(frame, "SPOOF?", (x, y - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 165, 255), 2)
                    continue

                match_label = "Unknown"
                match_found = False
                for student in enrolled_students:
                    s_emb = _student_embedding(student)
                    if not s_emb:
                        continue
                    # Task 11: only compare same-model embeddings
                    if getattr(student, "needs_reenrolment", False):
                        continue
                    try:
                        score = ai.compare_faces(s_emb, d_emb)
                    except Exception as exc:
                        _cv_log("COMPARE_ERROR", session_id=session_id, student_id=student.id, detail=str(exc))
                        continue
                    if score > comparison_threshold:
                        prev = matched.get(student.id)
                        if prev is None or confidence > prev[0]:
                            matched[student.id] = (confidence, liveness_score)
                        match_label = f"{student.full_name} ({student.id})"
                        match_found = True
                        _cv_log("MATCH", session_id=session_id, student_id=student.id,
                                detail=f"score={score:.3f} conf={confidence:.2f} live={liveness_score:.2f}")
                        break

                color = (0, 255, 0) if match_found else (0, 0, 255)
                x, y, w, h = bbox
                cv2.rectangle(frame, (x, y), (x + w, y + h), color, 2)
                cv2.putText(frame, match_label, (x, y - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.6, color, 2)

            try:
                cv2.imshow(f"AI Attendance Scanning - Session {session_id}", frame)
                if cv2.waitKey(1) & 0xFF == ord("q"):
                    break
            except Exception:
                pass

        if iterator is not None:
            try:
                iterator.close()
            except:
                pass
        try:
            cv2.destroyAllWindows()
        except Exception:
            pass

        # ─── Persist records for this hit ─────────────────────────────────
        for student in enrolled_students:
            record = _get_or_create_record(db, session_id, student.id)
            conf, live = matched.get(student.id, (None, None))
            present = student.id in matched

            if hit_number == 1:
                record.hit_1_present = present
                record.hit_1_confidence = conf
            else:
                record.hit_2_present = present
                record.hit_2_confidence = conf

            if conf is not None:
                record.embedding_confidence = conf
            if live is not None:
                record.liveness_score = live

            h1 = record.hit_1_present if record.hit_1_present is not None else False
            h2 = record.hit_2_present if record.hit_2_present is not None else False
            record.final_status = (
                schemas.AttendanceStatus.PRESENT.value if (h1 or h2)
                else schemas.AttendanceStatus.ABSENT.value
            )

            # Task 7: audit every AI mark
            audit_service.write_audit(
                db, action="ai_mark", actor_role="system",
                target_student_id=student.id, session_id=session_id,
                new_value="present" if present else "absent",
                embedding_confidence=conf, liveness_score=live,
                reason=f"hit_{hit_number}", commit=False,
            )

        db.commit()
        _cv_log("HIT_COMPLETE", session_id=session_id, detail=f"hit={hit_number} matched={len(matched)}")
        _post_hit(db, session, session_id, hit_number)

    except Exception as exc:
        import traceback
        error_msg = f"ERROR in Hit {hit_number} for Session {session_id}: {exc}\n{traceback.format_exc()}\n"
        print(error_msg)
        try:
            with open("backend_error.log", "a") as f:
                f.write(f"[{datetime.now()}] {error_msg}")
        except Exception:
            pass
        db.rollback()
    finally:
        ACTIVE_HITS.discard(session_id)
        db.close()


def _demo_mark(db, session, session_id, hit_number):
    """No-camera demo path: mark students randomly but still record confidence/audit."""
    _cv_log("DEMO_MODE", session_id=session_id, detail=f"hit={hit_number}")
    enrolled_students = (
        db.query(schemas.Student)
        .join(schemas.Enrollment)
        .filter(schemas.Enrollment.course_id == session.course_id)
        .all()
    )
    for student in enrolled_students:
        record = _get_or_create_record(db, session_id, student.id)
        present = random.random() > 0.3
        conf = round(random.uniform(0.45, 0.95), 2) if present else None
        if hit_number == 1:
            record.hit_1_present = present
            record.hit_1_confidence = conf
        else:
            record.hit_2_present = present
            record.hit_2_confidence = conf
        if conf is not None:
            record.embedding_confidence = conf
        record.final_status = (
            schemas.AttendanceStatus.PRESENT.value
            if (record.hit_1_present or record.hit_2_present)
            else schemas.AttendanceStatus.ABSENT.value
        )
        audit_service.write_audit(
            db, action="ai_mark", actor_role="system",
            target_student_id=student.id, session_id=session_id,
            new_value="present" if present else "absent",
            embedding_confidence=conf, reason=f"demo_hit_{hit_number}", commit=False,
        )
    db.commit()


def _get_or_create_record(db, session_id, student_id):
    record = (
        db.query(schemas.AttendanceRecord)
        .filter(
            schemas.AttendanceRecord.session_id == session_id,
            schemas.AttendanceRecord.student_id == student_id,
        )
        .first()
    )
    if not record:
        record = schemas.AttendanceRecord(session_id=session_id, student_id=student_id)
        db.add(record)
        db.flush()
    return record


def _post_hit(db, session, session_id, hit_number):
    """After hit 2, run consensus (Task 8) and notifications (Task 9)."""
    if hit_number != 2:
        return
    try:
        compute_consensus(db, session_id)
    except Exception as exc:
        _cv_log("CONSENSUS_ERROR", session_id=session_id, detail=str(exc))
    try:
        notification_service.finalize_session_notifications(session_id, db=db)
    except Exception as exc:
        _cv_log("NOTIFY_ERROR", session_id=session_id, detail=str(exc))


def compute_consensus(db: Session, session_id: int):
    """
    Task 8 — dual-hit consensus & low-confidence quarantine.
    Sets consensus_status + requires_review on each record.
    """
    LOW_CONF = 0.4
    records = db.query(schemas.AttendanceRecord).filter(
        schemas.AttendanceRecord.session_id == session_id
    ).all()

    for r in records:
        if r.is_manual_override:
            continue  # never override a human decision

        h1 = bool(r.hit_1_present)
        h2 = bool(r.hit_2_present)
        c1 = r.hit_1_confidence if r.hit_1_confidence is not None else 0.0
        c2 = r.hit_2_confidence if r.hit_2_confidence is not None else 0.0

        requires_review = False
        if h1 and h2:
            status = schemas.FinalStatus.PRESENT.value
        elif (h1 ^ h2):
            present_conf = c1 if h1 else c2
            other_conf = c2 if h1 else c1
            if other_conf < LOW_CONF or present_conf < LOW_CONF:
                status = schemas.FinalStatus.PRESENT_LOW_CONF.value
                requires_review = True
            else:
                status = schemas.FinalStatus.DISPUTED.value
                requires_review = True
        else:
            status = schemas.FinalStatus.ABSENT.value

        r.consensus_status = status
        r.requires_review = requires_review
        # Keep the coarse Present/Absent final_status consistent for legacy reports
        r.final_status = (
            schemas.AttendanceStatus.ABSENT.value
            if status == schemas.FinalStatus.ABSENT.value
            else schemas.AttendanceStatus.PRESENT.value
        )

    db.commit()
    _cv_log("CONSENSUS_DONE", session_id=session_id, detail=f"records={len(records)}")


def schedule_hits(session_id: int):
    """
    FastAPI BackgroundTask: fire Hit 1 after 30s and Hit 2 after 60s total.
    """
    time.sleep(30)
    process_attendance_hit(session_id, 1)
    time.sleep(30)
    process_attendance_hit(session_id, 2)
