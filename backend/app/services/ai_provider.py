"""Returns the configured AI provider (Gemini or Groq). Both expose the
same interface: generate(prompt, system) -> (text, tokens) and
generate_json(prompt, system) -> (dict, tokens). Switch providers by
setting AI_PROVIDER=groq (or gemini) in backend/.env - no other code
needs to change.
"""
from app.core.config import settings


def get_ai_client():
    if settings.AI_PROVIDER.lower() == "groq":
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
