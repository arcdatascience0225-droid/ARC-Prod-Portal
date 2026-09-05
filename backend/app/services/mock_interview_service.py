from uuid import UUID
from typing import List, Optional

from sqlalchemy.orm import Session

from app.repositories.mock_interview_repository import MockInterviewRepository
from app.schemas.mock_interview import (
    MockInterviewSchedule, MockInterviewOut, MockInterviewSubmit,
    MockInterviewEvaluationOut,
)
from app.services.ai_interview_analysis_service import AIInterviewAnalysisService


class MockInterviewService:
    def __init__(self, db: Session):
        self.db = db
        self.repo = MockInterviewRepository(db)
        self.ai_service = AIInterviewAnalysisService(db)

    def schedule(self, payload: MockInterviewSchedule, scheduled_by: UUID) -> MockInterviewOut:
        mi = self.repo.create(
            student_id=payload.studentId, scheduled_by=scheduled_by,
            batch_id=payload.batchId, scheduled_at=payload.scheduledAt, mode=payload.mode,
        )
        return self._to_out(mi)

    def list_for_student(self, student_id: UUID) -> List[MockInterviewOut]:
        return [self._to_out(m) for m in self.repo.list_for_student(student_id)]

    def list_scheduled_by(self, faculty_id: UUID) -> List[MockInterviewOut]:
        return [self._to_out(m) for m in self.repo.list_scheduled_by(faculty_id)]

    def submit(self, mock_interview_id: UUID, payload: MockInterviewSubmit) -> MockInterviewEvaluationOut:
        responses = [r.model_dump() for r in payload.responses]
        self.repo.save_responses(mock_interview_id, responses, payload.recordingUrl)
        evaluation = self.ai_service.analyze(mock_interview_id, responses)
        return self._eval_to_out(evaluation)

    def get_evaluation(self, mock_interview_id: UUID) -> Optional[MockInterviewEvaluationOut]:
        ev = self.repo.get_evaluation(mock_interview_id)
        return self._eval_to_out(ev) if ev else None

    def _to_out(self, mi) -> MockInterviewOut:
        return MockInterviewOut(
            id=mi.id, studentId=mi.student_id, scheduledBy=mi.scheduled_by,
            batchId=mi.batch_id, scheduledAt=mi.scheduled_at, mode=mi.mode,
            status=mi.status, recordingUrl=mi.recording_url,
        )

    def _eval_to_out(self, ev) -> MockInterviewEvaluationOut:
        return MockInterviewEvaluationOut(
            id=ev.id, mockInterviewId=ev.mock_interview_id,
            confidenceScore=ev.confidence_score, communicationScore=ev.communication_score,
            technicalScore=ev.technical_score, overallScore=ev.overall_score,
            feedbackText=ev.feedback_text, improvementSuggestions=ev.improvement_suggestions,
        )
