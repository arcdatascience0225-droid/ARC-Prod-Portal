"""Compatibility shim so phase5-style
`from app.models.core import Assessment, CodingQuestion, Result, CodingSubmission, AiUsage, ChatHistory, Placement`
imports keep working against the canonical model definitions."""
from app.models.assessment import (  # noqa: F401
    Assessment,
    CodingQuestion,
    Result,
    CodingSubmission,
    AIUsage,
    AiUsage,
    ChatHistory,
)
from app.models.placement import Application as Placement  # noqa: F401
