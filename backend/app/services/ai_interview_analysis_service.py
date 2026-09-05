from uuid import UUID

from sqlalchemy.orm import Session

from app.models.shared_refs import AIUsage
from app.repositories.mock_interview_repository import MockInterviewRepository
from app.services.ai_provider import get_ai_client
from app.services.gemini_client import GeminiNotConfiguredError

PROMPT_TEMPLATE = """You are an expert technical interview evaluator.
Below is a transcript of a student's mock interview (question/answer pairs).

Transcript:
{transcript}

Evaluate the student and return STRICT JSON, no extra text, in this exact shape:
{{
  "confidenceScore": <0-100 number>,
  "communicationScore": <0-100 number>,
  "technicalScore": <0-100 number>,
  "overallScore": <0-100 number>,
  "feedbackText": "2-4 sentence overall feedback",
  "improvementSuggestions": "3-5 concrete, actionable bullet points as a single string separated by newlines"
}}
"""


class AIInterviewAnalysisService:
    def __init__(self, db: Session):
        self.db = db
        self.repo = MockInterviewRepository(db)
        self.client = get_ai_client()

    def analyze(self, mock_interview_id: UUID, responses: list[dict]):
        transcript = "\n".join(
            f"Q: {r['questionText']}\nA: {r.get('answerText') or '(no answer given)'}"
            for r in responses
        )
        prompt = PROMPT_TEMPLATE.format(transcript=transcript)
        tokens_used = 0
        try:
            result, tokens_used = self.client.generate_json(prompt)
        except GeminiNotConfiguredError:
            result = {
                "confidenceScore": 0, "communicationScore": 0, "technicalScore": 0, "overallScore": 0,
                "feedbackText": "AI evaluation is unavailable right now: the platform admin needs to set GEMINI_API_KEY.",
                "improvementSuggestions": "Contact your platform admin to enable AI-powered interview feedback.",
            }

        mi = self.repo.get(mock_interview_id)
        evaluation = self.repo.save_evaluation(
            mock_interview_id=mock_interview_id,
            confidence=result["confidenceScore"], communication=result["communicationScore"],
            technical=result["technicalScore"], overall=result["overallScore"],
            feedback=result["feedbackText"], suggestions=result["improvementSuggestions"],
        )

        if mi:
            self.db.add(AIUsage(
                user_id=mi.student_id, module="mock_interview_analysis",
                tokens_used=tokens_used, cost=0,
            ))
            self.db.commit()

        return evaluation
