"""Canonical auth/RBAC dependencies used by every phase's endpoints.

Design notes (integration decisions):
- `role` values on `User` are canonical lowercase snake_case, matching
  `app.models.enums.RoleEnum` (super_admin, admin, faculty, trainer, hr,
  placement_coordinator, student, guest). Any phase code that previously
  compared against "Super Admin", "Faculty", "super admin" etc. has been
  normalized to these canonical values.
- `require_roles()` accepts BOTH call conventions used across the phases:
    require_roles(RoleEnum.ADMIN, RoleEnum.SUPER_ADMIN)   # phase1/phase5 style (variadic)
    require_roles(["hr", "admin"])                         # phase3/phase4 style (single list)
    require_roles(*STAFF_ROLES)                             # phase5 style (unpacked)
  so no call sites needed to change.
- `get_current_user` returns the real ORM `User` (phase1/phase5 style).
  `CurrentUser` is aliased to `User` so `from app.core.deps import CurrentUser`
  (phase3/phase4 style type hints) keeps working.
"""
from typing import Iterable
import uuid

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import decode_token
from app.core.redis_client import is_token_blacklisted
from app.models.user import User
from app.models.enums import RoleEnum

bearer_scheme = HTTPBearer()

# Alias so `from app.core.deps import CurrentUser` (phase3/phase4 style) still works.
CurrentUser = User


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    token = credentials.credentials
    try:
        payload = decode_token(token)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")

    if payload.get("type") not in (None, "access"):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token type")

    if payload.get("jti") and is_token_blacklisted(payload["jti"]):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token has been revoked")

    user_id = payload.get("sub")
    try:
        user = db.query(User).filter(User.id == uuid.UUID(str(user_id))).first()
    except (ValueError, TypeError):
        user = None

    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found or inactive")

    return user


def require_roles(*allowed_roles):
    """RBAC dependency factory. Accepts roles as separate args, a single
    list/tuple/set, RoleEnum members, or plain strings - in any combination."""
    flattened = []
    for r in allowed_roles:
        if isinstance(r, (list, tuple, set)):
            flattened.extend(r)
        else:
            flattened.append(r)
    allowed = {r.value if isinstance(r, RoleEnum) else str(r).lower().replace(" ", "_") for r in flattened}

    def checker(current_user: User = Depends(get_current_user)) -> User:
        role_value = current_user.role.value if isinstance(current_user.role, RoleEnum) else str(current_user.role)
        if role_value.lower().replace(" ", "_") not in allowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to perform this action",
            )
        return current_user

    return checker


# Role hierarchy, low -> high (used by require_min_role, phase5-style)
ROLE_HIERARCHY = [
    RoleEnum.GUEST.value,
    RoleEnum.STUDENT.value,
    RoleEnum.PLACEMENT_COORDINATOR.value,
    RoleEnum.HR.value,
    RoleEnum.TRAINER.value,
    RoleEnum.FACULTY.value,
    RoleEnum.ADMIN.value,
    RoleEnum.SUPER_ADMIN.value,
]


def require_min_role(min_role: str):
    def checker(current_user: User = Depends(get_current_user)) -> User:
        role_value = current_user.role.value if isinstance(current_user.role, RoleEnum) else str(current_user.role)
        try:
            if ROLE_HIERARCHY.index(role_value) < ROLE_HIERARCHY.index(min_role):
                raise ValueError
        except ValueError:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient role level")
        return current_user

    return checker


# Convenience role groups (canonical - reuse across all phases instead of
# redefining roles locally)
ADMIN_ROLES = (RoleEnum.SUPER_ADMIN, RoleEnum.ADMIN)
STAFF_ROLES = (
    RoleEnum.SUPER_ADMIN,
    RoleEnum.ADMIN,
    RoleEnum.FACULTY,
    RoleEnum.TRAINER,
    RoleEnum.HR,
    RoleEnum.PLACEMENT_COORDINATOR,
)
HR_ROLES = (RoleEnum.HR, RoleEnum.PLACEMENT_COORDINATOR, RoleEnum.ADMIN, RoleEnum.SUPER_ADMIN)
FACULTY_OR_TRAINER = (RoleEnum.FACULTY, RoleEnum.TRAINER, RoleEnum.ADMIN, RoleEnum.SUPER_ADMIN)
STUDENT_ONLY = (RoleEnum.STUDENT,)

# phase3-style pre-built dependency callables
faculty_or_trainer = require_roles(*FACULTY_OR_TRAINER)
student_only = require_roles(*STUDENT_ONLY)
