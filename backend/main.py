from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from dotenv import load_dotenv
import os

# Load environment variables early
# Load environment variables early from backend dir
env_path = os.path.join(os.path.dirname(__file__), ".env")
load_dotenv(dotenv_path=env_path)

from .models import schemas, database
from .routes import auth, admin, faculty, bulk_upload, it_manager, student, auth_federated, permissions
import uvicorn
from fastapi.staticfiles import StaticFiles

# Create tables on startup (Simple approach for MVP, can use Alembic later)
schemas.Base.metadata.create_all(bind=database.engine)

app = FastAPI(title="Attendance MVP API")

os.makedirs("backend/uploads", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="backend/uploads"), name="uploads")

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth.router)
app.include_router(auth_federated.router)
app.include_router(admin.router)
app.include_router(faculty.router)
app.include_router(bulk_upload.router)
app.include_router(it_manager.router)
app.include_router(student.router)
app.include_router(permissions.router)

@app.get("/health")
def health_check():
    return {"status": "healthy", "database": "connected"}

@app.get("/")
def read_root():
    return {"message": "Welcome to Attendance MVP API"}

if __name__ == "__main__":
    uvicorn.run("backend.main:app", host="0.0.0.0", port=8001, reload=True)
