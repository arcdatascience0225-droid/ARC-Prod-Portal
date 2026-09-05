"""Compatibility shim: phase2 (Student Portal) originally had its own
lightweight JWT decode + RBAC helper here. Routed through the canonical
app.core.deps implementation so there is a single source of truth for
authentication (with token-blacklist + is_active checks) across the whole
platform."""
from app.core.deps import get_current_user, require_roles, CurrentUser  # noqa: F401
from app.models.enums import RoleEnum

require_student = require_roles(RoleEnum.STUDENT)
require_student_or_admin = require_roles(
    RoleEnum.STUDENT, RoleEnum.ADMIN, RoleEnum.SUPER_ADMIN, RoleEnum.FACULTY, RoleEnum.TRAINER
)
