"""Compatibility shim so phase3-style `from app.db.session import Base, get_db` imports
keep working against the single canonical database module."""
from app.core.database import Base, get_db, SessionLocal, engine  # noqa: F401
