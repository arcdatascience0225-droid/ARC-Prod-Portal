"""Foundation module's user-management endpoints. `list_users` (ADM-001) and
`change_role` (ADM-005) overlap with the Admin Portal module's endpoints
(app.api.v1.endpoints.admin_platform, which owns GET/POST /admin/users and
PUT /admin/users/{id}/role) - that module's versions are canonical and are
mounted at /api/v1/admin. Only the two endpoints unique to this module
(revoke/restore access, sign-in log viewer) are kept here, mounted at
/api/v1/admin to extend the same namespace without path collisions.
"""
import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import require_roles, ADMIN_ROLES
from app.models.user import User
from app.services.admin_users_service import AdminService
from app.schemas.admin_users import UserListItem, RevokeAccessRequest, SignInLogOut

router = APIRouter(prefix="/api/v1/admin", tags=["Admin - Access & Sign-in Logs"])


@router.patch("/users/{user_id}/access", response_model=UserListItem)  # ADM-005 (revoke/restore access)
def set_access(
    user_id: uuid.UUID,
    payload: RevokeAccessRequest,
    current_user: User = Depends(require_roles(*ADMIN_ROLES)),
    db: Session = Depends(get_db),
):
    user = AdminService(db).set_active_status(user_id, payload.isActive)
    return UserListItem(id=str(user.id), name=user.name, email=user.email, role=user.role, isActive=user.is_active, createdAt=user.created_at)


@router.get("/permissions-catalog", summary="Full nav-item catalog for the Super Admin's permission checkbox picker")
def permissions_catalog(current_user: User = Depends(require_roles("super_admin"))):
    from app.core.permissions_catalog import PERMISSIONS_CATALOG
    return PERMISSIONS_CATALOG


@router.get("/users/{user_id}/permissions", summary="Get a user's effective permissions (custom override or role default)")
def get_user_permissions(
    user_id: uuid.UUID,
    current_user: User = Depends(require_roles("super_admin")),
    db: Session = Depends(get_db),
):
    from app.core.permissions_catalog import default_permissions_for_role
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="User not found")
    return {
        "userId": str(user.id),
        "isCustom": user.permissions is not None,
        "permissions": user.permissions if user.permissions is not None else default_permissions_for_role(user.role),
    }


@router.put("/users/{user_id}/permissions", summary="Set a custom permission list for a user, or clear it back to role defaults")
def set_user_permissions(
    user_id: uuid.UUID,
    payload: dict,  # {"permissions": list[str] | None}  — None clears the override, reverting to role defaults
    current_user: User = Depends(require_roles("super_admin")),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="User not found")
    user.permissions = payload.get("permissions")
    db.commit()
    return {"userId": str(user.id), "permissions": user.permissions}


@router.get("/sign-in-logs")  # ADM-007
def sign_in_logs(
    skip: int = 0,
    limit: int = 50,
    user_id: uuid.UUID | None = Query(None),
    current_user: User = Depends(require_roles(*ADMIN_ROLES)),
    db: Session = Depends(get_db),
):
    items, total = AdminService(db).get_sign_in_logs(skip, limit, user_id)
    return {
        "total": total,
        "items": [
            SignInLogOut(
                id=str(l.id),
                userId=str(l.user_id),
                ipAddress=l.ip_address,
                userAgent=l.user_agent,
                status=l.status,
                createdAt=l.created_at,
            )
            for l in items
        ],
    }
