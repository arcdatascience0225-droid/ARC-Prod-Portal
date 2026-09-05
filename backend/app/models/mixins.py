"""Compatibility shim so phase3-style `from app.models.mixins import BaseModelMixin`
imports keep working against the single canonical models/base.py."""
from app.models.base import BaseModelMixin  # noqa: F401
