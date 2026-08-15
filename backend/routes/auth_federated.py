from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
import httpx
from ..models import database, schemas
from ..services import auth_service

router = APIRouter(prefix="/api/auth", tags=["Federated Authentication"])

class FederatedLoginRequest(BaseModel):
    provider: str # 'google', 'microsoft', 'iqra'
    token: str # the OIDC token from the provider

@router.post("/federated", summary="Authenticate via Federated Identity Provider")
async def federated_login(req: FederatedLoginRequest, db: Session = Depends(database.get_db)):
    # In a real implementation, we would verify the OIDC token using the provider's JWKS.
    # For MVP purposes, we'll simulate token verification and extract the email.
    
    # Simulate extraction
    email = None
    if req.provider == "google":
        # Simulate: verify with Google endpoint
        email = "simulated_google_user@example.com"
    elif req.provider == "microsoft":
        email = "simulated_ms_user@example.com"
    elif req.provider == "iqra":
        # Simulate: verify with Microsoft Entra ID and check @iqra.edu.pk domain
        # In MVP, we just assume the token contains the right email
        # if not email.endswith('@iqra.edu.pk'): raise
        email = "simulated_iqra_user@iqra.edu.pk"
    else:
        raise HTTPException(status_code=400, detail="Unsupported provider")
        
    # IMPORTANT: The token parsing above must be replaced with proper verification in production
    
    # Account Matching Policy: MUST match an existing user record created by Admin
    user = db.query(schemas.User).filter(schemas.User.email == email).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Federated login failed: Account not found in directory. Please contact Admin."
        )

    # Issue our own tokens
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
