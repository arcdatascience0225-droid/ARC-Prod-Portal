import json
import logging
from typing import Any, Optional

import google.generativeai as genai

from app.core.config import settings

logger = logging.getLogger(__name__)

if settings.GEMINI_API_KEY:
    genai.configure(api_key=settings.GEMINI_API_KEY)


class GeminiNotConfiguredError(RuntimeError):
    """Raised when a Gemini-backed feature is used but no API key is set."""


class GeminiClient:
    """Thin wrapper around the Gemini API used across the faculty portal
    (AI question generation + mock interview analysis)."""

    def __init__(self, model_name: Optional[str] = None):
        self.model_name = model_name or settings.GEMINI_MODEL
        self._model = None
        if settings.GEMINI_API_KEY:
            self._model = genai.GenerativeModel(self.model_name)

    def generate_json(self, prompt: str) -> tuple[Any, int]:
        """Calls Gemini and parses a JSON response. Returns (parsed_json, tokens_used)."""
        if not self._model:
            raise GeminiNotConfiguredError(
                "AI generation is unavailable: GEMINI_API_KEY is not set in the backend .env file. "
                "Get a free key at https://aistudio.google.com/apikey and set GEMINI_API_KEY, then restart the server."
            )
        response = self._model.generate_content(
            prompt,
            generation_config=genai.types.GenerationConfig(
                response_mime_type="application/json",
                temperature=0.7,
            ),
        )
        text = response.text.strip()
        try:
            parsed = json.loads(text)
        except json.JSONDecodeError:
            cleaned = text.strip("`")
            if cleaned.startswith("json"):
                cleaned = cleaned[4:]
            parsed = json.loads(cleaned)

        tokens_used = 0
        usage = getattr(response, "usage_metadata", None)
        if usage:
            tokens_used = getattr(usage, "total_token_count", 0)
        return parsed, tokens_used
