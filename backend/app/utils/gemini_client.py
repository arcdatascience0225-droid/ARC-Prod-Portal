"""
Thin wrapper around Google Gemini API for:
 - AI auto-evaluation of subjective/coding-adjacent answers
 - AI code review feedback
Every call is logged into ai_usage table by the calling service.
"""
import json
import httpx
from typing import Optional
from app.config import settings

GEMINI_ENDPOINT = (
    "https://generativelanguage.googleapis.com/v1beta/models/"
    "{model}:generateContent?key={key}"
)


class GeminiClient:
    def __init__(self):
        self.model = settings.GEMINI_MODEL
        self.api_key = settings.GEMINI_API_KEY

    async def _generate(self, prompt: str, timeout: float = 30.0) -> tuple[str, int]:
        """Returns (text_response, approx_tokens_used)"""
        if not self.api_key:
            # Fail-soft in dev/test environments without a key configured
            return ("[AI evaluation unavailable: GEMINI_API_KEY not configured]", 0)

        url = GEMINI_ENDPOINT.format(model=self.model, key=self.api_key)
        payload = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {"temperature": 0.3, "maxOutputTokens": 1024},
        }
        async with httpx.AsyncClient(timeout=timeout) as client:
            resp = await client.post(url, json=payload)
            resp.raise_for_status()
            data = resp.json()

        try:
            text = data["candidates"][0]["content"]["parts"][0]["text"]
        except (KeyError, IndexError):
            text = ""
        usage = data.get("usageMetadata", {})
        tokens = usage.get("totalTokenCount", len(prompt) // 4)
        return text, tokens

    async def evaluate_answer(
        self, question_text: str, question_type: str, correct_answer: Optional[str],
        student_answer: str, max_marks: float,
    ) -> tuple[float, str, int]:
        """Returns (score, feedback, tokens_used)"""
        prompt = f"""You are an expert examiner. Evaluate the student's answer strictly and fairly.

Question Type: {question_type}
Question: {question_text}
Reference/Expected Answer (may be blank for subjective): {correct_answer or "N/A"}
Max Marks: {max_marks}
Student Answer: {student_answer}

Respond ONLY with valid JSON (no markdown fences) in this exact shape:
{{"score": <number between 0 and {max_marks}>, "feedback": "<2-4 sentence constructive feedback>"}}
"""
        text, tokens = await self._generate(prompt)
        try:
            cleaned = text.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
            parsed = json.loads(cleaned)
            score = float(parsed.get("score", 0))
            feedback = str(parsed.get("feedback", ""))
        except Exception:
            score, feedback = 0.0, "AI evaluation could not be parsed; please contact faculty for manual review."
        score = max(0.0, min(score, max_marks))
        return score, feedback, tokens

    async def review_code(
        self, question_text: str, language: str, code: str, test_summary: str
    ) -> tuple[str, int]:
        prompt = f"""You are a senior software engineer doing a code review for a student submission.

Problem: {question_text}
Language: {language}
Test Result Summary: {test_summary}

Code:
```{language}
{code}
```

Give concise, constructive feedback (max 150 words) covering: correctness issues (if any),
code quality/readability, time-space complexity, and one specific improvement suggestion.
Do not restate the whole problem. Respond in plain text, no markdown headers.
"""
        text, tokens = await self._generate(prompt)
        return text.strip(), tokens


gemini_client = GeminiClient()
