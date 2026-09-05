"""Compatibility shim so phase2-style `from app.database import Base, get_db, SessionLocal, engine`
imports keep working against the single canonical database module."""
from app.core.database import Base, get_db, SessionLocal, engine  # noqa: F401
