"""
IT-Manager upgrade — camera_service
Server-side RTSP handling so credentials NEVER reach the browser.
ffmpeg/ffprobe are invoked with ARGUMENT LISTS (never shell strings).
Camera host validated against ALLOWED_CAMERA_SUBNETS (SSRF guard).
"""
import os
import re
import json
import shutil
import socket
import subprocess
import ipaddress
import urllib.parse

import cv2

from . import crypto_service

_ALLOWED = os.getenv(
    "ALLOWED_CAMERA_SUBNETS",
    "10.0.0.0/8,172.16.0.0/12,192.168.0.0/16,127.0.0.1/32",
).split(",")


def _host_allowed(host: str) -> bool:
    if not host:
        return False
    if host.strip() == "0":
        return True
    try:
        ip = ipaddress.ip_address(socket.gethostbyname(host))
    except Exception:
        return False
    for cidr in _ALLOWED:
        cidr = cidr.strip()
        if not cidr:
            continue
        try:
            if ip in ipaddress.ip_network(cidr, strict=False):
                return True
        except ValueError:
            continue
    return False


def build_rtsp_url(classroom) -> str:
    ip = classroom.ip_address
    if not ip:
        return None
    if ip.strip() == "0":
        return "0"
    
    path = classroom.stream_path or ""
    if str(path).lower().startswith("rtsp://"):
        return str(path)

    user = crypto_service.decrypt_secret(classroom.camera_username) if classroom.camera_username else None
    pwd = crypto_service.decrypt_secret(classroom.camera_password) if classroom.camera_password else None
    port = classroom.port or 554
    cred = f"{urllib.parse.quote(user)}:{urllib.parse.quote(pwd)}@" if (user and pwd) else ""
    return f"rtsp://{cred}{ip}:{port}/{path.lstrip('/')}"


def build_rtsp_url_from_parts(ip, port, user, pwd, path) -> str:
    if not ip:
        return None
    if str(ip).strip() == "0":
        return "0"
        
    if path and str(path).lower().startswith("rtsp://"):
        return str(path)

    cred = f"{urllib.parse.quote(user)}:{urllib.parse.quote(pwd)}@" if (user and pwd) else ""
    return f"rtsp://{cred}{ip}:{port or 554}/{(path or '').lstrip('/')}"


def redact_url(url: str) -> str:
    if not url:
        return url
    return re.sub(r"://([^:@/]+):([^@/]+)@", "://***:***@", url)


def host_of(url: str) -> str:
    try:
        if url == "0":
            return "0"
        return urllib.parse.urlparse(url).hostname
    except Exception:
        return None


def ffmpeg_available() -> bool:
    try:
        import imageio_ffmpeg
        return imageio_ffmpeg.get_ffmpeg_exe() is not None
    except Exception:
        return False

def ffprobe_available() -> bool:
    try:
        import subprocess
        subprocess.run(["ffprobe", "-version"], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        return True
    except Exception:
        return False

def probe_camera(url: str) -> dict:
    host = host_of(url)
    if not _host_allowed(host):
        return {"reachable": False, "error": "Camera host is not in an allowed subnet.",
                "codec": None, "resolution": None, "fps": None, "has_audio": False, "has_ptz": False}

    if not ffmpeg_available():
        return {"reachable": False, "error": "ffmpeg not available.",
                "codec": None, "resolution": None, "fps": None, "has_audio": False, "has_ptz": False}

    # Quick TCP connection check on RTSP port to detect offline camera early
    if host and host != "0":
        port = 554
        try:
            parsed = urllib.parse.urlparse(url)
            if parsed.port:
                port = parsed.port
        except Exception:
            pass
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            s.settimeout(2.0)
            s.connect((host, port))
            s.close()
        except Exception:
            return {"reachable": False,
                    "error": f"Camera is offline or unreachable at {host}:{port}. Please verify the camera is powered on and connected to the network.",
                    "codec": None, "resolution": None, "fps": None, "has_audio": False, "has_ptz": False}

    if url == "0":
        try:
            cap = cv2.VideoCapture(0)
            if cap.isOpened():
                w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
                h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
                fps = cap.get(cv2.CAP_PROP_FPS) or None
                cap.release()
                return {"reachable": True, "error": None, "codec": "unknown",
                        "resolution": f"{w}x{h}" if w else None, "fps": fps, "has_audio": False,
                        "has_ptz": False}
        except Exception:
            pass
        return {"reachable": False, "error": "Cannot open webcam 0.",
                "codec": None, "resolution": None, "fps": None, "has_audio": False, "has_ptz": False}

    import imageio_ffmpeg
    try:
        gen = imageio_ffmpeg.read_frames(url, input_params=["-rtsp_transport", "tcp"])
        meta = next(gen)
        gen.close()
        
        codec = meta.get("codec")
        w, h = meta.get("size", (None, None))
        res = f"{w}x{h}" if w else None
        fps = meta.get("fps")
        has_audio = bool(meta.get("audio_codec"))
        return {"reachable": True, "error": None, "codec": codec, "resolution": res, "fps": fps,
                "has_audio": has_audio, "has_ptz": bool(re.search(r"realmonitor|onvif|cam/", url, re.I))}
    except Exception as e:
        # Fallback to OpenCV if imageio_ffmpeg fails but OpenCV can read it
        try:
            os.environ["OPENCV_FFMPEG_CAPTURE_OPTIONS"] = "rtsp_transport;tcp"
            cap = cv2.VideoCapture(url)
            if cap.isOpened():
                w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
                h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
                fps = cap.get(cv2.CAP_PROP_FPS) or None
                cap.release()
                return {"reachable": True, "error": None, "codec": "unknown",
                        "resolution": f"{w}x{h}" if w else None, "fps": fps, "has_audio": False,
                        "has_ptz": bool(re.search(r"realmonitor|onvif|cam/", url, re.I))}
        except Exception:
            pass
        return {"reachable": False, "error": str(e),
                "codec": None, "resolution": None, "fps": None, "has_audio": False, "has_ptz": False}


def mjpeg_generator(url: str, max_width: int = 960, quality: int = 70):
    # Set OpenCV environment variable to prioritize TCP for RTSP (if it's RTSP)
    import os
    import numpy as np
    os.environ["OPENCV_FFMPEG_CAPTURE_OPTIONS"] = "rtsp_transport;tcp"
    
    cap = None
    try:
        cap = cv2.VideoCapture(url if str(url) != "0" else 0)
        if not cap.isOpened():
            frame = np.zeros((480, 640, 3), dtype=np.uint8)
            cv2.putText(frame, "CAMERA OFFLINE", (150, 240), cv2.FONT_HERSHEY_SIMPLEX, 1.5, (0, 0, 255), 3)
            ok, buf = cv2.imencode(".jpg", frame, [int(cv2.IMWRITE_JPEG_QUALITY), quality])
            if ok:
                yield (b"--frame\r\nContent-Type: image/jpeg\r\n\r\n" + buf.tobytes() + b"\r\n")
            return

        frame_count = 0
        while True:
            ret, frame = cap.read()
            if not ret: 
                if frame_count == 0:
                    frame = np.zeros((480, 640, 3), dtype=np.uint8)
                    cv2.putText(frame, "STREAM DISCONNECTED", (100, 240), cv2.FONT_HERSHEY_SIMPLEX, 1.2, (0, 0, 255), 3)
                    ok, buf = cv2.imencode(".jpg", frame, [int(cv2.IMWRITE_JPEG_QUALITY), quality])
                    if ok:
                        yield (b"--frame\r\nContent-Type: image/jpeg\r\n\r\n" + buf.tobytes() + b"\r\n")
                break
            frame_count += 1
            h, w = frame.shape[:2]
            if w > max_width:
                frame = cv2.resize(frame, (max_width, int(h * (max_width / w))))
            ok, buf = cv2.imencode(".jpg", frame, [int(cv2.IMWRITE_JPEG_QUALITY), quality])
            if not ok: continue
            yield (b"--frame\r\nContent-Type: image/jpeg\r\n\r\n" + buf.tobytes() + b"\r\n")
    finally:
        try:
            if cap: cap.release()
        except: pass
    return


def audio_generator(url: str):
    if not ffmpeg_available() or url == "0":
        return
    import imageio_ffmpeg
    exe = imageio_ffmpeg.get_ffmpeg_exe()
    args = [exe, "-loglevel", "error", "-rtsp_transport", "tcp", "-i", url,
            "-vn", "-acodec", "libmp3lame", "-b:a", "48k", "-f", "mp3", "-"]
    proc = subprocess.Popen(args, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
    try:
        while True:
            chunk = proc.stdout.read(4096)
            if not chunk:
                break
            yield chunk
    finally:
        try:
            proc.kill()
        except Exception:
            pass


VENDOR_PRESETS = {
    "dahua": "cam/realmonitor?channel=1&subtype=0",
    "hikvision": "Streaming/Channels/101",
    "generic": "h264",
    "webcam": "",
}


def annotated_mjpeg_generator(url: str, enrolled_students: list, threshold: float, ai_engine, session_id: str = "-", max_width: int = 960, quality: int = 70):
    import os
    import time
    os.environ["OPENCV_FFMPEG_CAPTURE_OPTIONS"] = "rtsp_transport;tcp"
    
    try:
        cap = cv2.VideoCapture(url if str(url) != "0" else 0)
        cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
        # To avoid lagging the stream with heavy AI inference, we only run AI every N frames.
        # But for this MVP, if they want real-time, we'll try running it every 5th frame or run it on downscaled frames.
        frame_skip = 5
        frame_count = 0
        last_boxes = []

        while True:
            ret, frame = cap.read()
            if not ret: break
            h, w = frame.shape[:2]
            if w > max_width:
                frame = cv2.resize(frame, (max_width, int(h * (max_width / w))))
            
            frame_count += 1
            if frame_count % frame_skip == 0 or frame_count == 1:
                # Detect and match
                results = ai_engine.detect_and_embed(frame, session_id=session_id)
                new_boxes = []
                for res in results:
                    x, y, bw, bh = res["bbox"]
                    emb = res["embedding"]
                    best_match = None
                    best_sim = 0.0
                    for student in enrolled_students:
                        sim = ai_engine.compare_faces(emb, student["embedding"])
                        if sim > best_sim:
                            best_sim = sim
                            best_match = student
                    
                    if best_match and best_sim > threshold:
                        if not res.get("is_live", True):
                            label = f"SPOOF: {best_match['name']}"
                            color = (0, 165, 255) # Orange
                        else:
                            label = f"{best_match['id']} - {best_match['name']} ({best_sim:.2f})"
                            color = (0, 255, 0)
                    else:
                        label = "Unknown"
                        color = (0, 0, 255) # Red for unknown
                    
                    new_boxes.append({"bbox": (x, y, bw, bh), "label": label, "color": color})
                last_boxes = new_boxes

            # Draw the cached boxes
            for box in last_boxes:
                x, y, bw, bh = box["bbox"]
                label = box["label"]
                color = box["color"]
                cv2.rectangle(frame, (x, y), (x + bw, y + bh), color, 2)
                cv2.putText(frame, label, (x, y - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.6, color, 2)

            ok, buf = cv2.imencode(".jpg", frame, [int(cv2.IMWRITE_JPEG_QUALITY), quality])
            if not ok: continue
            yield (b"--frame\r\nContent-Type: image/jpeg\r\n\r\n" + buf.tobytes() + b"\r\n")
    finally:
        try: cap.release()
        except: pass
    return
