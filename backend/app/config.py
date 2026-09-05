"""Compatibility shim so phase2-style `from app.config import settings`
imports keep working against the canonical app.core.config module."""
from app.core.config import settings, Settings, get_settings  # noqa: F401
