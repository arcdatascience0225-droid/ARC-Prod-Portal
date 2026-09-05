from uuid import UUID
from datetime import datetime
from typing import List, Optional

from sqlalchemy.orm import Session

from app.models.mock_interview import MockInterview, MockInterviewQnA, MockInterviewEvaluation


class MockInterviewRepository:
    def __init__(self, db: Session):
        self.db = db

    def create(self, student_id: UUID, scheduled_by: UUID, batch_id: Optional[UUID],
               scheduled_at: datetime, mode: str) -> MockInterview:
        mi = MockInterview(
            student_id=student_id, scheduled_by=scheduled_by, batch_id=batch_id,
            scheduled_at=scheduled_at, mode=mode, status="scheduled",
        )
        self.db.add(mi)
        self.db.commit()
        self.db.refresh(mi)
        return mi

    def get(self, mock_interview_id: UUID) -> Optional[MockInterview]:
        return self.db.query(MockInterview).filter(MockInterview.id == mock_interview_id).first()

    def list_for_student(self, student_id: UUID) -> List[MockInterview]:
        return self.db.query(MockInterview).filter(MockInterview.student_id == student_id).all()

    def list_scheduled_by(self, faculty_id: UUID) -> List[MockInterview]:
        return self.db.query(MockInterview).filter(MockInterview.scheduled_by == faculty_id).all()

    def save_responses(self, mock_interview_id: UUID, responses: list, recording_url: Optional[str]) -> None:
        for r in responses:
            self.db.add(MockInterviewQnA(
                mock_interview_id=mock_interview_id,
                question_text=r["questionText"],
                answer_text=r.get("answerText"),
                sequence=r.get("sequence", "1"),
            ))
        mi = self.get(mock_interview_id)
        if mi:
            mi.status = "completed"
            if recording_url:
                mi.recording_url = recording_url
        self.db.commit()

    def get_responses(self, mock_interview_id: UUID) -> List[MockInterviewQnA]:
        return self.db.query(MockInterviewQnA).filter(
            MockInterviewQnA.mock_interview_id == mock_interview_id
        ).order_by(MockInterviewQnA.sequence).all()

    def save_evaluation(self, mock_interview_id: UUID, confidence: float, communication: float,
                         technical: float, overall: float, feedback: str,
                         suggestions: str) -> MockInterviewEvaluation:
        existing = self.db.query(MockInterviewEvaluation).filter(
            MockInterviewEvaluation.mock_interview_id == mock_interview_id
        ).first()
        if existing:
            existing.confidence_score = confidence
            existing.communication_score = communication
            existing.technical_score = technical
            existing.overall_score = overall
            existing.feedback_text = feedback
            existing.improvement_suggestions = suggestions
            self.db.commit()
            self.db.refresh(existing)
            return existing

        evaluation = MockInterviewEvaluation(
            mock_interview_id=mock_interview_id, confidence_score=confidence,
            communication_score=communication, technical_score=technical,
            overall_score=overall, feedback_text=feedback, improvement_suggestions=suggestions,
        )
        self.db.add(evaluation)
        self.db.commit()
        self.db.refresh(evaluation)
        return evaluation

    def get_evaluation(self, mock_interview_id: UUID) -> Optional[MockInterviewEvaluation]:
        return self.db.query(MockInterviewEvaluation).filter(
            MockInterviewEvaluation.mock_interview_id == mock_interview_id
        ).first()
