import json
import google.generativeai as genai
from app.core.config import settings
from app.services.gemini_client import GeminiNotConfiguredError

if settings.GEMINI_API_KEY:
    genai.configure(api_key=settings.GEMINI_API_KEY)


class GeminiService:
    def __init__(self, model_name: str | None = None):
        self.model_name = model_name or settings.GEMINI_MODEL
        self.model = genai.GenerativeModel(self.model_name) if settings.GEMINI_API_KEY else None

    def generate(self, prompt: str, system_instruction: str | None = None) -> tuple[str, int]:
        if not settings.GEMINI_API_KEY:
            raise GeminiNotConfiguredError(
                "AI generation is unavailable: GEMINI_API_KEY is not set in the backend .env file. "
                "Get a free key at https://aistudio.google.com/apikey and set GEMINI_API_KEY, then restart the server."
            )
        model = self.model
        if system_instruction:
            model = genai.GenerativeModel(settings.GEMINI_MODEL, system_instruction=system_instruction)
        result = model.generate_content(prompt)
        text = result.text or ""
        tokens = 0
        try:
            tokens = result.usage_metadata.total_token_count
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
        # Fallback: extract the first top-level JSON value (object OR array) -
        # the caller may be expecting either shape.
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

    async def evaluate_answer(
        self, question_text: str, question_type: str, correct_answer,
        student_answer: str, max_marks: float,
    ) -> tuple:
        import json
        prompt = (
            f"Evaluate this student answer.\n"
            f"Type: {question_type}\nQ: {question_text}\n"
            f"Expected: {correct_answer or 'N/A'}\nMax: {max_marks}\n"
            f"Student: {student_answer}\n"
            f"Reply ONLY JSON: {{\"score\": <0-{max_marks}>, \"feedback\": \"...\"}}"
        )
        text, tokens = self.generate(prompt)
        try:
            c = text.strip().lstrip("```json").lstrip("```").rstrip("```").strip()
            parsed = json.loads(c)
            score = max(0.0, min(float(parsed.get("score", 0)), max_marks))
            feedback = str(parsed.get("feedback", ""))
        except Exception:
            score, feedback = 0.0, "AI evaluation unavailable."
        return score, feedback, tokens

    async def review_code(self, question_text: str, language: str, code: str, test_summary: str) -> tuple:
        prompt = f"Review this {language} code for: {question_text}\nTests: {test_summary}\nCode:\n{code}\nBrief feedback (100 words)."
        text, tokens = self.generate(prompt)
        return text, tokens



GEMINI_COST_PER_1K_TOKENS = 0.00015


def estimate_cost(tokens: int) -> float:
    return round((tokens / 1000) * GEMINI_COST_PER_1K_TOKENS, 6)
