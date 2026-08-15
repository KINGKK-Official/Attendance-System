from fastapi import APIRouter, Depends, HTTPException, Request, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
import json
import os

from jose import jwt, JWTError

from ..models import database, schemas
from ..services import auth_service, crypto_service, camera_service

router = APIRouter(prefix="/api/it-manager", tags=["IT Manager"])

ENABLE_AUDIO_MONITORING = os.getenv("ENABLE_AUDIO_MONITORING", "false").lower() == "true"
COMPLIANCE_APPROVED = os.getenv("COMPLIANCE_APPROVED", "false").lower() == "true"


class CameraConfig(BaseModel):
    room_number: str
    ip_address: Optional[str] = None
    port: Optional[int] = 554
    camera_username: Optional[str] = None
    camera_password: Optional[str] = None
    stream_path: Optional[str] = None
    audio_consent_on_file: Optional[bool] = None


class SystemSettingsUpdate(BaseModel):
    face_comparison_threshold: float
    face_detection_threshold: float
    double_hit_interval: int


class PTZCommand(BaseModel):
    command: str


class PresetCommand(BaseModel):
    preset: str


def _audit(db, request, user, action, target=None, meta=None, reason=None):
    try:
        db.add(schemas.ITAuditLog(
            actor_id=getattr(user, "id", None), actor_email=getattr(user, "email", None),
            action=action, target=str(target) if target is not None else None,
            metadata_json=json.dumps(meta) if meta else None, reason=reason,
            ip_address=request.client.host if request and request.client else None))
        db.commit()
    except Exception as e:
        db.rollback(); print(f"IT audit failed: {e}")


def _serialize_camera(c):
    return {
        "id": c.id, "room_number": c.room_number, "ip_address": c.ip_address,
        "port": c.port, "stream_path": c.stream_path,
        "has_username": bool(c.camera_username), "has_password": bool(c.camera_password),
        "has_audio": bool(c.has_audio), "has_ptz": bool(c.has_ptz),
        "last_codec": c.last_codec, "last_resolution": c.last_resolution,
        "audio_consent_on_file": bool(c.audio_consent_on_file),
        "redacted_url": camera_service.redact_url(c.camera_url) if c.camera_url else None,
    }


def _stream_user(token: str, db: Session):
    try:
        payload = jwt.decode(token, auth_service.SECRET_KEY, algorithms=[auth_service.ALGORITHM])
        email = payload.get("sub")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid stream token")
    user = db.query(schemas.User).filter(schemas.User.email == email).first()
    allowed_roles = [schemas.UserRole.IT_MANAGER.value, schemas.UserRole.ADMIN.value, schemas.UserRole.FACULTY.value]
    if not user or user.role not in allowed_roles:
        raise HTTPException(status_code=403, detail="Not authorized for camera streams")
    return user


@router.get("/cameras")
def get_cameras(db: Session = Depends(database.get_db),
                current_user: schemas.User = Depends(auth_service.check_it_manager)):
    return [_serialize_camera(c) for c in db.query(schemas.Classroom).all()]


@router.post("/cameras")
def upsert_camera(config: CameraConfig, request: Request,
                  db: Session = Depends(database.get_db),
                  current_user: schemas.User = Depends(auth_service.check_it_manager)):
    classroom = db.query(schemas.Classroom).filter(schemas.Classroom.room_number == config.room_number).first()
    creating = classroom is None
    if creating:
        classroom = schemas.Classroom(room_number=config.room_number)
        db.add(classroom)
    classroom.ip_address = config.ip_address
    classroom.port = config.port
    classroom.stream_path = config.stream_path
    if config.audio_consent_on_file is not None:
        classroom.audio_consent_on_file = config.audio_consent_on_file
    if config.camera_username:
        classroom.camera_username = crypto_service.encrypt_secret(config.camera_username)
    if config.camera_password:
        classroom.camera_password = crypto_service.encrypt_secret(config.camera_password)
    classroom.camera_url = camera_service.build_rtsp_url(classroom)
    db.commit(); db.refresh(classroom)
    _audit(db, request, current_user, "camera_create" if creating else "camera_update",
           target=classroom.room_number, meta={"ip": config.ip_address, "port": config.port})
    return _serialize_camera(classroom)


@router.delete("/cameras/{classroom_id}")
def delete_camera(classroom_id: int, request: Request,
                  db: Session = Depends(database.get_db),
                  current_user: schemas.User = Depends(auth_service.check_it_manager)):
    classroom = db.query(schemas.Classroom).filter(schemas.Classroom.id == classroom_id).first()
    if not classroom:
        raise HTTPException(status_code=404, detail="Classroom not found")
    room = classroom.room_number
    db.delete(classroom); db.commit()
    _audit(db, request, current_user, "camera_delete", target=room)
    return {"status": "success"}


@router.post("/cameras/test")
def test_camera_connection(config: CameraConfig, request: Request,
                           db: Session = Depends(database.get_db),
                           current_user: schemas.User = Depends(auth_service.check_it_manager)):
    user = config.camera_username
    pwd = config.camera_password
    if (not user or not pwd) and config.room_number:
        existing = db.query(schemas.Classroom).filter(schemas.Classroom.room_number == config.room_number).first()
        if existing:
            user = user or (crypto_service.decrypt_secret(existing.camera_username) if existing.camera_username else None)
            pwd = pwd or (crypto_service.decrypt_secret(existing.camera_password) if existing.camera_password else None)
    url = camera_service.build_rtsp_url_from_parts(config.ip_address, config.port, user, pwd, config.stream_path)
    if not url:
        raise HTTPException(status_code=400, detail="IP address / webcam index is required.")
    result = camera_service.probe_camera(url)
    _audit(db, request, current_user, "test_connection", target=config.room_number or config.ip_address,
           meta={"reachable": result["reachable"], "has_audio": result["has_audio"]})
    if config.room_number:
        cam = db.query(schemas.Classroom).filter(schemas.Classroom.room_number == config.room_number).first()
        if cam and result["reachable"]:
            cam.has_audio = result["has_audio"]; cam.has_ptz = result["has_ptz"]
            cam.last_codec = result["codec"]; cam.last_resolution = result["resolution"]
            db.commit()
    if not result["reachable"]:
        raise HTTPException(status_code=400, detail=result.get("error") or "Connection failed.")
    return {"status": "success", "message": "Connection successful.", **result}


@router.get("/cameras/{classroom_id}/video")
def video_feed(classroom_id: int, token: str = Query(...), db: Session = Depends(database.get_db)):
    user = _stream_user(token, db)
    cam = db.query(schemas.Classroom).filter(schemas.Classroom.id == classroom_id).first()
    if not cam:
        raise HTTPException(status_code=404, detail="Camera not found")
    url = camera_service.build_rtsp_url(cam)
    if not url:
        raise HTTPException(status_code=400, detail="Camera not configured")
    _audit(db, None, user, "video_view", target=cam.room_number)
    return StreamingResponse(camera_service.mjpeg_generator(url),
                             media_type="multipart/x-mixed-replace; boundary=frame")


@router.get("/audio-status")
def audio_status(current_user: schemas.User = Depends(auth_service.check_it_manager)):
    return {"enabled": ENABLE_AUDIO_MONITORING and COMPLIANCE_APPROVED,
            "ffmpeg": camera_service.ffmpeg_available(),
            "flag_enable_audio": ENABLE_AUDIO_MONITORING,
            "flag_compliance_approved": COMPLIANCE_APPROVED}


@router.get("/cameras/{classroom_id}/audio")
def audio_feed(classroom_id: int, token: str = Query(...), db: Session = Depends(database.get_db)):
    user = _stream_user(token, db)
    if not (ENABLE_AUDIO_MONITORING and COMPLIANCE_APPROVED):
        raise HTTPException(status_code=403, detail="Audio monitoring is disabled. Requires "
                            "ENABLE_AUDIO_MONITORING and COMPLIANCE_APPROVED plus institutional sign-off.")
    if not camera_service.ffmpeg_available():
        raise HTTPException(status_code=503, detail="ffmpeg not available on server.")
    cam = db.query(schemas.Classroom).filter(schemas.Classroom.id == classroom_id).first()
    if not cam:
        raise HTTPException(status_code=404, detail="Camera not found")
    if not cam.has_audio:
        raise HTTPException(status_code=400, detail="No audio track detected. Run Test Connection first.")
    if not cam.audio_consent_on_file:
        raise HTTPException(status_code=403, detail="Audio consent / notice is not on file for this room.")
    url = camera_service.build_rtsp_url(cam)
    sess = schemas.MonitorSession(user_id=user.id, user_email=user.email, classroom_id=cam.id,
                                  room_number=cam.room_number, kind="audio", active=True)
    db.add(sess); db.commit(); db.refresh(sess)
    _audit(db, None, user, "audio_listen_start", target=cam.room_number, meta={"session_id": sess.id})

    def _gen():
        try:
            for chunk in camera_service.audio_generator(url):
                yield chunk
        finally:
            from sqlalchemy.sql import func as _f
            s = db.query(schemas.MonitorSession).filter(schemas.MonitorSession.id == sess.id).first()
            if s and s.active:
                s.active = False; s.ended_at = _f.now(); db.commit()
            _audit(db, None, user, "audio_listen_stop", target=cam.room_number, meta={"session_id": sess.id})

    return StreamingResponse(_gen(), media_type="audio/mpeg")


@router.post("/cameras/{classroom_id}/ptz")
def control_camera_ptz(classroom_id: int, ptz: PTZCommand, request: Request,
                       db: Session = Depends(database.get_db),
                       current_user: schemas.User = Depends(auth_service.check_it_manager)):
    cam = db.query(schemas.Classroom).filter(schemas.Classroom.id == classroom_id).first()
    if not cam:
        raise HTTPException(status_code=404, detail="Classroom not found")
    print(f"PTZ '{ptz.command}' -> {cam.room_number} ({cam.ip_address})")
    try:
        import requests
        from requests.auth import HTTPDigestAuth
        
        user = crypto_service.decrypt_secret(cam.camera_username) if cam.camera_username else ""
        pwd = crypto_service.decrypt_secret(cam.camera_password) if cam.camera_password else ""
        
        cmd_map = {
            "up": "Up", "down": "Down", "left": "Left", "right": "Right",
            "zoom_in": "ZoomTele", "zoom_out": "ZoomWide"
        }
        dahua_cmd = cmd_map.get(ptz.command, ptz.command)
        
        if cam.stream_path and "realmonitor" in cam.stream_path.lower():
            url_start = f"http://{cam.ip_address}/cgi-bin/ptz.cgi?action=start&channel=1&code={dahua_cmd}&arg1=4&arg2=4&arg3=0"
            url_stop = f"http://{cam.ip_address}/cgi-bin/ptz.cgi?action=stop&channel=1&code={dahua_cmd}&arg1=4&arg2=4&arg3=0"
            
            auth = HTTPDigestAuth(user, pwd) if user and pwd else None
            
            try:
                import time
                try:
                    requests.get(url_start, auth=auth, timeout=1.5)
                except Exception as e:
                    print(f"PTZ start request error: {e}")
                
                # Stop after a short delay so the camera doesn't get stuck panning forever
                time.sleep(0.5)
                
                try:
                    requests.get(url_stop, auth=auth, timeout=1.5)
                except Exception as e:
                    print(f"PTZ stop request error: {e}")
            except Exception as e:
                print(f"PTZ logic error: {e}")
                
    except Exception as e:
        print(f"PTZ API failed: {e}")
        
    _audit(db, request, current_user, "ptz", target=cam.room_number, meta={"command": ptz.command})
    return {"status": "success", "message": f"PTZ command {ptz.command} executed"}


@router.post("/cameras/{classroom_id}/preset")
def control_camera_preset(classroom_id: int, preset: PresetCommand, request: Request,
                          db: Session = Depends(database.get_db),
                          current_user: schemas.User = Depends(auth_service.check_it_manager)):
    cam = db.query(schemas.Classroom).filter(schemas.Classroom.id == classroom_id).first()
    if not cam:
        raise HTTPException(status_code=404, detail="Classroom not found")
    print(f"PRESET '{preset.preset}' -> {cam.room_number}")
    try:
        import requests
        from requests.auth import HTTPDigestAuth
        
        user = crypto_service.decrypt_secret(cam.camera_username) if cam.camera_username else ""
        pwd = crypto_service.decrypt_secret(cam.camera_password) if cam.camera_password else ""
        
        p_num = preset.preset.replace('P', '')
        
        if cam.stream_path and "realmonitor" in cam.stream_path.lower():
            url = f"http://{cam.ip_address}/cgi-bin/ptz.cgi?action=start&channel=1&code=GotoPreset&arg1=0&arg2={p_num}&arg3=0"
            auth = HTTPDigestAuth(user, pwd) if user and pwd else None
            try:
                requests.get(url, auth=auth, timeout=2)
            except Exception as e:
                print(f"Preset failed: {e}")
    except Exception as e:
        print(f"Preset API failed: {e}")
        
    _audit(db, request, current_user, "preset", target=cam.room_number, meta={"preset": preset.preset})
    return {"status": "success", "message": f"Preset {preset.preset} called"}


@router.get("/settings")
def get_settings(db: Session = Depends(database.get_db),
                 current_user: schemas.User = Depends(auth_service.check_it_manager)):
    settings = db.query(schemas.SystemSettings).first()
    if not settings:
        settings = schemas.SystemSettings(); db.add(settings); db.commit(); db.refresh(settings)
    return settings


@router.post("/settings")
def update_settings(config: SystemSettingsUpdate, request: Request,
                    db: Session = Depends(database.get_db),
                    current_user: schemas.User = Depends(auth_service.check_it_manager)):
    settings = db.query(schemas.SystemSettings).first()
    if not settings:
        settings = schemas.SystemSettings(); db.add(settings)
    if not (0.0 <= config.face_comparison_threshold <= 1.0):
        raise HTTPException(status_code=400, detail="Face comparison threshold must be 0..1")
    if not (0.0 <= config.face_detection_threshold <= 1.0):
        raise HTTPException(status_code=400, detail="Face detection threshold must be 0..1")
    if config.double_hit_interval < 1:
        raise HTTPException(status_code=400, detail="Double-hit interval must be >= 1s")
    settings.face_comparison_threshold = config.face_comparison_threshold
    settings.face_detection_threshold = config.face_detection_threshold
    settings.double_hit_interval = config.double_hit_interval
    db.commit(); db.refresh(settings)
    _audit(db, request, current_user, "settings_update",
           meta={"cosine": config.face_comparison_threshold, "detect": config.face_detection_threshold,
                 "interval": config.double_hit_interval})
    return settings


@router.get("/diagnostics")
def diagnostics(db: Session = Depends(database.get_db),
                current_user: schemas.User = Depends(auth_service.check_it_manager)):
    import time
    from sqlalchemy import text
    t0 = time.time(); db_ok = True
    try:
        db.execute(text("SELECT 1"))
    except Exception:
        db_ok = False
    db_ping_ms = round((time.time() - t0) * 1000, 1)
    cpu = ram = disk = None
    try:
        import psutil
        cpu = psutil.cpu_percent(interval=0.2)
        ram = psutil.virtual_memory().percent
        disk = psutil.disk_usage("/").percent
    except Exception:
        pass
    cams = db.query(schemas.Classroom).all()
    cam_status = [{"room_number": c.room_number, "configured": bool(c.camera_url),
                   "redacted_url": camera_service.redact_url(c.camera_url) if c.camera_url else None,
                   "has_audio": bool(c.has_audio), "has_ptz": bool(c.has_ptz)} for c in cams]
    return {"cpu_load": cpu, "ram_usage": ram, "disk_usage": disk, "db_ping_ms": db_ping_ms, "db_ok": db_ok,
            "ffmpeg": camera_service.ffmpeg_available(), "ffprobe": camera_service.ffprobe_available(),
            "audio_monitoring_enabled": ENABLE_AUDIO_MONITORING and COMPLIANCE_APPROVED, "cameras": cam_status}


@router.get("/sessions")
def list_sessions(db: Session = Depends(database.get_db),
                  current_user: schemas.User = Depends(auth_service.check_it_manager)):
    rows = db.query(schemas.MonitorSession).filter(schemas.MonitorSession.active == True).order_by(  # noqa: E712
        schemas.MonitorSession.started_at.desc()).all()
    return [{"id": s.id, "user_email": s.user_email, "room_number": s.room_number,
             "kind": s.kind, "started_at": str(s.started_at)} for s in rows]


@router.delete("/sessions/{session_id}")
def kill_session(session_id: int, request: Request, db: Session = Depends(database.get_db),
                 current_user: schemas.User = Depends(auth_service.check_it_manager)):
    s = db.query(schemas.MonitorSession).filter(schemas.MonitorSession.id == session_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Session not found")
    from sqlalchemy.sql import func as _f
    s.active = False; s.ended_at = _f.now(); db.commit()
    _audit(db, request, current_user, "session_kill", target=s.room_number, meta={"session_id": session_id})
    return {"status": "success"}


@router.get("/audit")
def get_it_audit(limit: int = 100, db: Session = Depends(database.get_db),
                 current_user: schemas.User = Depends(auth_service.check_it_manager)):
    rows = db.query(schemas.ITAuditLog).order_by(schemas.ITAuditLog.timestamp.desc()).limit(min(limit, 500)).all()
    return [{"id": r.id, "timestamp": str(r.timestamp), "actor_email": r.actor_email, "action": r.action,
             "target": r.target, "reason": r.reason,
             "metadata": json.loads(r.metadata_json) if r.metadata_json else None,
             "ip_address": r.ip_address} for r in rows]


@router.get("/vendor-presets")
def vendor_presets(current_user: schemas.User = Depends(auth_service.check_it_manager)):
    return camera_service.VENDOR_PRESETS
