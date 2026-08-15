# Conventions Map

**Date**: 2026-06-30

## Code Style
- **Frontend**: Functional React components with hooks (`useState`, `useEffect`). UI uses inline styles and glassmorphism CSS classes (`.glass-card`).
- **Backend**: Strict typings for endpoints via Pydantic models. Database interaction uses SQLAlchemy sessions dependency injection (`get_db`).

## Error Handling
- **Backend**: Raises FastAPI `HTTPException` for client-side errors, caught and transformed into standard JSON responses.
- **Frontend**: Wraps API calls in `try/catch`. Displays errors using inline UI alerts or simple toasts.

## Secrets & Auth
- JWT tokens are stored in `localStorage` in the frontend.
- API requests automatically attach the token via Axios interceptors in `api.js`.
