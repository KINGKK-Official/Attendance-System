# Integrations Map

**Date**: 2026-06-30

## External APIs & Services
- **RTSP Cameras**: Connects locally/on-LAN to RTSP IP Cameras using `imageio_ffmpeg` and `opencv`. The system acts as a proxy for these feeds to serve them securely to the frontend.
- **SQL Server**: Central database for managing students, courses, attendance sessions, and auth.

## Authentication & Authorization
- **JWT (JSON Web Tokens)**: Used for stateless authentication.
- **Roles**: System has distinct roles (`ADMIN`, `IT_MANAGER`, `FACULTY`, `STUDENT`, `HOD`, `DEAN`) managed internally.

## File Storage
- Local file system storage might be used for logs or exported data, but primary data is in the RDBMS.

## Hardware Integration
- **IP Cameras / Webcams**: Managed by the IT Manager module (`camera_service.py`), relying on PTZ, RTSP streams, and audio extraction capabilities.
