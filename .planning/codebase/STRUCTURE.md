# Structure Map

**Date**: 2026-06-30

## Directory Layout
- **`backend/`**: FastAPI Backend Application
  - `main.py`: Application entry point.
  - `routes/`: API endpoint definitions organized by role (`admin.py`, `it_manager.py`, `student.py`, etc.).
  - `services/`: Business logic (`auth_service.py`, `camera_service.py`).
  - `models/`: SQLAlchemy models (`schemas.py`, `database.py`).
- **`frontend/`**: React Frontend Application
  - `src/App.jsx`: Main routing configuration and role-based access guard.
  - `src/context/`: React context providers (`AuthContext.js`, `ThemeContext.js`).
  - `src/pages/`: Role-specific view components (`admin/`, `faculty/`, `it_manager/`, `student/`).
  - `src/api.js`: Axios configuration and interceptors.

## Naming Conventions
- React components use `PascalCase`.
- Backend endpoints and python files use `snake_case`.
- Environment variables use `UPPER_SNAKE_CASE`.
