"""Compatibility shim so phase3-style `from app.api.deps import ...`
imports keep working against the canonical app.core.deps module."""
from app.core.deps import (  # noqa: F401
    get_current_user,
    require_roles,
    CurrentUser,
    faculty_or_trainer,
    student_only,
)
