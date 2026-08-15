from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
from ..models import database, schemas
from ..services import auth_service

router = APIRouter(prefix="/api/permissions", tags=["Permissions"])

class PermissionOverrideRequest(BaseModel):
    role: Optional[str] = None
    user_id: Optional[int] = None
    permission_id: int
    is_granted: bool

@router.get("/", summary="List all available permissions")
def list_permissions(db: Session = Depends(database.get_db), 
                     current_user: schemas.User = Depends(auth_service.check_admin)):
    return db.query(schemas.Permission).all()

@router.post("/override", summary="Grant or revoke a capability for a role or user")
def override_permission(req: PermissionOverrideRequest, 
                        db: Session = Depends(database.get_db),
                        # Only Admin can Assign Permissions (Non-Delegable)
                        current_user: schemas.User = Depends(auth_service.check_admin)):
    
    if not req.role and not req.user_id:
        raise HTTPException(status_code=400, detail="Must specify role or user_id")
        
    perm = db.query(schemas.Permission).filter(schemas.Permission.id == req.permission_id).first()
    if not perm:
        raise HTTPException(status_code=404, detail="Permission not found")
        
    # Check existing
    query = db.query(schemas.RolePermissionOverride).filter(
        schemas.RolePermissionOverride.permission_id == req.permission_id
    )
    if req.role:
        query = query.filter(schemas.RolePermissionOverride.role == req.role)
    else:
        query = query.filter(schemas.RolePermissionOverride.user_id == req.user_id)
        
    override = query.first()
    if not override:
        override = schemas.RolePermissionOverride(
            role=req.role,
            user_id=req.user_id,
            permission_id=req.permission_id,
            is_granted=req.is_granted
        )
        db.add(override)
    else:
        override.is_granted = req.is_granted
        
    db.commit()
    
    # Audit log entry for permission assignment
    audit = schemas.UnifiedAuditLog(
        actor_id=current_user.id,
        actor_role=current_user.role,
        action="assign_permission",
        target_type="Role" if req.role else "User",
        target_id=req.role if req.role else str(req.user_id),
        new_value=f"Permission {perm.name} -> {'Granted' if req.is_granted else 'Revoked'}"
    )
    db.add(audit)
    db.commit()
    
    return {"message": "Permission override saved"}
