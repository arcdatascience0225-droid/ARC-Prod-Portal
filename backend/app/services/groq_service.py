"""Groq (GroqCloud) AI provider - a drop-in alternative to GeminiService.

Not to be confused with "Grok" (xAI) - a different company. Groq's API has
a genuinely free, no-credit-card developer tier (rate-limited, not
token-limited) running open-source models like Llama on custom LPU
hardware. Exposes the same interface as GeminiService
(generate / generate_json -> (text_or_dict, tokens)) so services can swap
providers without any other code changes.
"""
import json
from groq import Groq
from app.core.config import settings
from app.services.gemini_client import GeminiNotConfiguredError

_client = Groq(api_key=settings.GROQ_API_KEY) if settings.GROQ_API_KEY else None


class GroqService:
    def __init__(self, model_name: str | None = None):
        if _client is None:
            raise GeminiNotConfiguredError(
                "GROQ_API_KEY is not set. Get a free key (no credit card) at "
                "https://console.groq.com/keys and add it to backend/.env"
            )
        self.client = _client
        self.model = model_name or settings.GROQ_MODEL

    def generate(self, prompt: str, system_instruction: str | None = None) -> tuple[str, int]:
        messages = []
        if system_instruction:
            messages.append({"role": "system", "content": system_instruction})
        messages.append({"role": "user", "content": prompt})

        completion = self.client.chat.completions.create(
            model=self.model,
            messages=messages,
        )
        text = completion.choices[0].message.content or ""
        try:
            tokens = completion.usage.total_tokens
        except Exception:
            tokens = max(1, len(prompt.split()) + len(text.split()))
        return text, tokens

    def generate_json(self, prompt: str, system_instruction: str | None = None) -> tuple[dict, int]:
        full_prompt = prompt + "\n\nRespond ONLY with valid JSON, no markdown fences, no commentary."
        text, tokens = self.generate(full_prompt, system_instruction)
        cleaned = text.strip().strip("```").replace("json\n", "", 1).strip()
        try:
            return json.loads(cleaned), tokens
        except json.JSONDecodeError:
            pass
        obj_start, obj_end = cleaned.find("{"), cleaned.rfind("}")
        arr_start, arr_end = cleaned.find("["), cleaned.rfind("]")
        candidates = []
        if obj_start != -1 and obj_end != -1:
            candidates.append((obj_start, cleaned[obj_start:obj_end + 1]))
        if arr_start != -1 and arr_end != -1:
            candidates.append((arr_start, cleaned[arr_start:arr_end + 1]))
        candidates.sort(key=lambda c: c[0])
        for _, snippet in candidates:
            try:
                return json.loads(snippet), tokens
            except json.JSONDecodeError:
                continue
        return {"raw": text}, tokens


# Groq's free-tier open-source models cost $0 - kept for interface parity
# with gemini_service.estimate_cost.
    async def evaluate_answer(
        self, question_text: str, question_type: str, correct_answer,
        student_answer: str, max_marks: float,
    ) -> tuple:
        """Returns (score, feedback, tokens_used) - same interface as GeminiClient."""
        import json
        prompt = f"""You are an expert examiner. Evaluate the student answer.
Question Type: {question_type}
Question: {question_text}
Reference Answer: {correct_answer or "N/A"}
Max Marks: {max_marks}
Student Answer: {student_answer}

Respond ONLY with valid JSON (no markdown):
{{"score": <0 to {max_marks}>, "feedback": "<2-3 sentence feedback>"}}"""
        text, tokens = self.generate(prompt)
        try:
            cleaned = text.strip().strip("```json").strip("```").strip()
            parsed = json.loads(cleaned)
            score = float(parsed.get("score", 0))
            feedback = str(parsed.get("feedback", ""))
        except Exception:
            score, feedback = 0.0, "Could not parse AI evaluation."
        return max(0.0, min(score, max_marks)), feedback, tokens

    async def review_code(
        self, question_text: str, language: str, code: str, test_summary: str
    ) -> tuple:
        """Returns (feedback, tokens_used)"""
        prompt = f"""You are a senior software engineer reviewing student code.
Problem: {question_text}
Language: {language}
Tests: {test_summary}
Code:
{code}
Give concise feedback (max 100 words): correctness, quality, one improvement. Plain text only."""
        text, tokens = self.generate(prompt)
        return text, tokens


def estimate_cost(tokens: int) -> float:
    return 0.0
