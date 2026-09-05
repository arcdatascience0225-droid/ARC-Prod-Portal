"""Compatibility shim so phase3-style
`from app.models.shared_refs import User, Question, Assessment, ...`
imports keep working against the canonical model definitions."""
from app.models.user import User  # noqa: F401
from app.models.assessment import (  # noqa: F401
    Question,
    Assessment,
    Result,
    CodingQuestion,
    TestCase,
    AIUsage,
    ChatHistory,
)
