# Tech Stack & Configuration Map

**Date**: 2026-06-30

## Core Technologies
- **Frontend**: React, Vite
- **Backend**: FastAPI, Python 3.x
- **Database**: SQL Server (or SQLite during testing) via SQLAlchemy
- **Streaming**: FFmpeg, imageio_ffmpeg, OpenCV (RTSP proxying)
- **Styling**: Vanilla CSS, \lucide-react\ for icons

## Key Dependencies
- **Frontend** (\rontend/package.json\):
  - \eact\, \eact-dom\, \eact-router-dom\
  - \xios\ for API requests
  - \lucide-react\ for icons
- **Backend** (\ackend/requirements.txt\ or \Pipfile\):
  - \astapi\, \uvicorn\
  - \sqlalchemy\
  - \python-jose[cryptography]\ (JWT)
  - \imageio_ffmpeg\, \opencv-python\ (camera/video streaming)

## Environment Configuration
- **Frontend**: Uses \pi.js\ to set base URL and handle JWT refresh interceptors.
- **Backend**: Environment variables typically load from \.env\.
