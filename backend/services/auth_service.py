from datetime import datetime, timedelta
from typing import Optional
import os
import uuid
import hashlib
import threading

from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from ..models import schemas, database

# Config
SECRET_KEY = os.getenv("SECRET_KEY", "your-secret-key-for-attendance-mvp-123")
ALGORITHM = os.getenv("ALGORITHM", "HS256")
# Task 5: short-lived access tokens + long-lived refresh tokens
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "15"))
REFRESH_TOKEN_EXPIRE_DAYS = int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", "7"))

pwd_context = CryptContext(schemes=["pbkdf2_sha256", "bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/auth/login")

# Task 5: in-memory jti revocation set with TTL (Redis-free fallback).
_jti_revoked: dict[str, datetime] = {}
_jti_lock = threading.Lock()


def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password):
    return pwd_context.hash(password)


def _sha256(value: str) -> str:
    return hashlib.sha256(value.encode()).hexdigest()


def revoke_jti(jti: str, exp: datetime):
    with _jti_lock:
        _jti_revoked[jti] = exp
        # opportunistic cleanup
        now = datetime.utcnow()
        for k in [k for k, v in _jti_revoked.items() if v < now]:
            _jti_revoked.pop(k, None)


def is_jti_revoked(jti: str) -> bool:
    with _jti_lock:
        exp = _jti_revoked.get(jti)
        if exp is None:
            return False
        if exp < datetime.utcnow():
            _jti_revoked.pop(jti, None)
            return False
        return True


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    jti = str(uuid.uuid4())
    to_encode.update({"exp": expire, "jti": jti, "type": "access"})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def create_refresh_token(db: Session, user: "schemas.User") -> str:
    """Issue a refresh JWT and persist its SHA-256 hash for revocation."""
    expire = datetime.utcnow() + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    jti = str(uuid.uuid4())
    token = jwt.encode(
        {"sub": user.email, "exp": expire, "jti": jti, "type": "refresh"},
        SECRET_KEY, algorithm=ALGORITHM,
    )
    db.add(schemas.RefreshToken(
        token_hash=_sha256(token),
        user_id=user.id,
        user_role=str(user.role),
        expires_at=expire,
        revoked=False,
    ))
    db.commit()
    return token


def issue_token_pair(db: Session, user: "schemas.User") -> dict:
    access = create_access_token(data={"sub": user.email, "role": str(user.role)})
    refresh = create_refresh_token(db, user)
    return {"access_token": access, "refresh_token": refresh, "token_type": "bearer"}


def rotate_access_token(db: Session, refresh_token: str) -> str:
    """Validate a refresh token against the DB and mint a fresh access token."""
    cred_exc = HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,
                             detail="Invalid or expired refresh token")
    try:
        payload = jwt.decode(refresh_token, SECRET_KEY, algorithms=[ALGORITHM])
        if payload.get("type") != "refresh":
            raise cred_exc
        email = payload.get("sub")
    except JWTError:
        raise cred_exc

    rec = db.query(schemas.RefreshToken).filter(
        schemas.RefreshToken.token_hash == _sha256(refresh_token)
    ).first()
    if not rec or rec.revoked or rec.expires_at < datetime.utcnow():
        raise cred_exc

    user = db.query(schemas.User).filter(schemas.User.email == email).first()
    if not user:
        raise cred_exc
    return create_access_token(data={"sub": user.email, "role": str(user.role)})


def revoke_refresh_token(db: Session, refresh_token: str):
    rec = db.query(schemas.RefreshToken).filter(
        schemas.RefreshToken.token_hash == _sha256(refresh_token)
    ).first()
    if rec:
        rec.revoked = True
        db.commit()


def verify_access_token(token: str) -> dict:
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

async def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(database.get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = verify_access_token(token)
        email: str = payload.get("sub")
        jti: str = payload.get("jti")
        if email is None:
            raise credentials_exception
        if jti and is_jti_revoked(jti):
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    user = db.query(schemas.User).filter(schemas.User.email == email).first()
    if user is None:
        raise credentials_exception
    return user


def check_admin(current_user: schemas.User = Depends(get_current_user)):
    if current_user.role != schemas.UserRole.ADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                            detail="The user doesn't have enough privileges")
    return current_user


def check_it_manager(current_user: schemas.User = Depends(get_current_user)):
    if current_user.role not in [schemas.UserRole.IT_MANAGER, schemas.UserRole.ADMIN]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                            detail="The user doesn't have enough privileges")
    return current_user


def check_leadership(current_user: schemas.User = Depends(get_current_user)):
    if current_user.role not in [schemas.UserRole.ADMIN, schemas.UserRole.HOD,
                                 schemas.UserRole.DEAN, schemas.UserRole.ASSOCIATE_DEAN]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                            detail="The user doesn't have enough privileges")
    return current_user


def check_faculty(current_user: schemas.User = Depends(get_current_user)):
    if current_user.role not in [schemas.UserRole.FACULTY, schemas.UserRole.ADMIN]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                            detail="The user doesn't have enough privileges")
    return current_user


def check_student(current_user: schemas.User = Depends(get_current_user)):
    # Task 10: student self-service guard
    if current_user.role not in [schemas.UserRole.STUDENT, schemas.UserRole.ADMIN]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                            detail="The user doesn't have enough privileges")
    return current_user

def require_permission(permission_name: str):
    def dependency(current_user: schemas.User = Depends(get_current_user), db: Session = Depends(database.get_db)):
        # Admin gets all by default, unless explicitly revoked
        # Other roles get their defaults (which we'll handle loosely here), unless explicitly granted/revoked
        # For MVP, we check RolePermissionOverride
        
        user_override = db.query(schemas.RolePermissionOverride).join(schemas.Permission).filter(
            schemas.Permission.name == permission_name,
            schemas.RolePermissionOverride.user_id == current_user.id
        ).first()

        if user_override:
            if not user_override.is_granted:
                raise HTTPException(status_code=403, detail="Permission revoked")
            return current_user

        role_override = db.query(schemas.RolePermissionOverride).join(schemas.Permission).filter(
            schemas.Permission.name == permission_name,
            schemas.RolePermissionOverride.role == str(current_user.role)
        ).first()

        if role_override:
            if not role_override.is_granted:
                raise HTTPException(status_code=403, detail="Permission revoked for role")
            return current_user
            
        if current_user.role == schemas.UserRole.ADMIN:
            return current_user
            
        # By default, if not explicitly granted to non-admins and not a base role feature, deny
        # Real implementation would have a base_capabilities dictionary
        raise HTTPException(status_code=403, detail="The user doesn't have enough privileges")
    return dependency
