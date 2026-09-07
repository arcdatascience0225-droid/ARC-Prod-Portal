"""Returns the configured AI provider (Gemini or Groq). Both expose the
same interface: generate(prompt, system) -> (text, tokens) and
generate_json(prompt, system) -> (dict, tokens). Switch providers by
setting AI_PROVIDER=groq (or gemini) in backend/.env - no other code
needs to change.
"""
from app.core.config import settings


def get_ai_client(force_provider: str | None = None):
    """force_provider overrides the global AI_PROVIDER setting for a
    specific call site — used to keep all STUDENT-facing AI features
    (auto-grading, career assistant, resume builder, mock interview
    feedback) on Groq (free) regardless of what faculty-facing features
    (Question Bank generation) are configured to use. This is a real-money
    cost control, not a quality preference — never remove it just because
    AI_PROVIDER is set to "gemini" for faculty."""
    provider = (force_provider or settings.AI_PROVIDER).lower()
    if provider == "groq":
        from app.services.groq_service import GroqService
        return GroqService()
    from app.services.gemini_service import GeminiService
    return GeminiService()


def estimate_cost(tokens: int) -> float:
    if settings.AI_PROVIDER.lower() == "groq":
        from app.services.groq_service import estimate_cost as _cost
    else:
        from app.services.gemini_service import estimate_cost as _cost
    return _cost(tokens)
