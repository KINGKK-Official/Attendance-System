# Architecture Map

**Date**: 2026-06-30

## System Architecture
A standard modern web application architecture consisting of:
- **Client Layer**: A React Single Page Application (SPA).
- **API Layer**: FastAPI Python server acting as the REST API provider.
- **Data Layer**: SQLAlchemy ORM connecting to an SQL database.

## Design Patterns
- **Role-Based Access Control (RBAC)**: Centralized routing protection in `App.jsx` and JWT endpoint protection in FastAPI (`auth_service.py`).
- **Service Layer Pattern**: Business logic and external hardware interfacing (like cameras) are decoupled from route handlers and placed in `services/` (e.g., `camera_service.py`, `auth_service.py`).

## Data Flow (Camera Streaming)
1. IT Manager configures RTSP credentials in the frontend.
2. Frontend requests `/api/it-manager/cameras/{id}/video`.
3. Backend proxy (`camera_service.py`) spawns an FFmpeg subprocess using `imageio_ffmpeg` to read the RTSP feed, decodes it with OpenCV, and yields an MJPEG stream (`Multipart/x-mixed-replace`).
4. Frontend renders the stream directly into an `<img>` tag.
