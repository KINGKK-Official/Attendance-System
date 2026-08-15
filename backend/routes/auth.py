from fastapi import APIRouter, Depends, HTTPException, status, Header
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from typing import Optional
import requests
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests
from pydantic import BaseModel
from ..models import database, schemas
from ..services import auth_service

class SSOToken(BaseModel):
    token: str

router = APIRouter(prefix="/api/auth", tags=["Authentication"])


@router.post("/login", summary="Authenticate and receive an access + refresh token pair")
async def login(db: Session = Depends(database.get_db),
                form_data: OAuth2PasswordRequestForm = Depends()):
    """
    Validate credentials and issue a 15-minute access token plus a 7-day refresh
    token. The refresh token's hash is stored server-side so it can be revoked.
    """
    user = db.query(schemas.User).filter(schemas.User.email == form_data.username).first()
    if not user or not auth_service.verify_password(form_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    tokens = auth_service.issue_token_pair(db, user)
    return {
        **tokens,
        "user": {
            "full_name": user.full_name,
            "email": user.email,
            "role": user.role,
            "student_id": user.student_id,
        },
    }


@router.post("/refresh", summary="Exchange a refresh token for a new access token")
async def refresh(authorization: Optional[str] = Header(None),
                  db: Session = Depends(database.get_db)):
    """
    Accepts a refresh token in the `Authorization: Bearer <token>` header and,
    if it is valid and not revoked, returns a fresh 15-minute access token.
    """
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Missing bearer refresh token")
    refresh_token = authorization.split(" ", 1)[1].strip()
    access = auth_service.rotate_access_token(db, refresh_token)
    return {"access_token": access, "token_type": "bearer"}


@router.post("/logout", summary="Revoke the supplied refresh token")
async def logout(authorization: Optional[str] = Header(None),
                 db: Session = Depends(database.get_db)):
    """Marks the refresh token revoked so it can no longer mint access tokens."""
    if authorization and authorization.lower().startswith("bearer "):
        token = authorization.split(" ", 1)[1].strip()
        auth_service.revoke_refresh_token(db, token)
    return {"status": "success", "message": "Logged out."}


@router.post("/google", summary="Authenticate via Google SSO")
async def login_google(sso_token: SSOToken, db: Session = Depends(database.get_db)):
    try:
        # Validate the token with Google
        # We don't enforce a specific CLIENT_ID here for the MVP since we use a placeholder,
        # but in production, we would pass audience="YOUR_GOOGLE_CLIENT_ID"
        idinfo = id_token.verify_oauth2_token(sso_token.token, google_requests.Request())
        email = idinfo.get('email')
        
        if not email:
            raise ValueError("Email not provided by Google.")
            
        user = db.query(schemas.User).filter(schemas.User.email == email).first()
        if not user:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Google Account '{email}' is not registered in the system."
            )
            
        tokens = auth_service.issue_token_pair(db, user)
        return {
            **tokens,
            "user": {
                "full_name": user.full_name,
                "email": user.email,
                "role": user.role,
                "student_id": user.student_id,
            },
        }
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid Google Token: {str(e)}"
        )


@router.post("/microsoft", summary="Authenticate via Microsoft SSO")
async def login_microsoft(sso_token: SSOToken, db: Session = Depends(database.get_db)):
    try:
        # Validate the token with Microsoft Graph
        headers = {"Authorization": f"Bearer {sso_token.token}"}
        response = requests.get("https://graph.microsoft.com/v1.0/me", headers=headers)
        
        if response.status_code != 200:
            raise ValueError("Failed to validate token with Microsoft Graph.")
            
        data = response.json()
        email = data.get("mail") or data.get("userPrincipalName")
        
        if not email:
            raise ValueError("Email not provided by Microsoft.")
            
        user = db.query(schemas.User).filter(schemas.User.email == email).first()
        if not user:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Microsoft Account '{email}' is not registered in the system."
            )
            
        tokens = auth_service.issue_token_pair(db, user)
        return {
            **tokens,
            "user": {
                "full_name": user.full_name,
                "email": user.email,
                "role": user.role,
                "student_id": user.student_id,
            },
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid Microsoft Token: {str(e)}"
        )
