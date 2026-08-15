# Concerns Map

**Date**: 2026-06-30

## Technical Debt & Issues
- **Multiple Virtual Environments**: `venv` vs `venv2` exists locally, which can cause confusion when starting the backend server or installing dependencies (e.g., `imageio-ffmpeg`). Need to consolidate to a single reproducible environment (e.g. `requirements.txt` with a clean venv).
- **Hardcoded Default Values**: The Camera configuration module in `CameraSetup.jsx` has some hardcoded IP/port fallback values (like `10.125.0.139`) in the stream string builder.
- **RTSP Connection Handling**: FFmpeg spawning in `camera_service.py` (`build_rtsp_url`) handles credentials directly in the URL string, which requires user education to avoid appending duplicate credentials in the `stream_path` field.

## Security
- `imageio-ffmpeg` downloads a binary; ensure the environment `PATH` is secure.
- Video streams proxy over HTTP multipart; ensure the network connection to the backend is encrypted (HTTPS/WSS) in production.
