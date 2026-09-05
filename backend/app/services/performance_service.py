from collections import defaultdict
from uuid import UUID
from typing import List

from sqlalchemy.orm import Session

from app.repositories.performance_repository import PerformanceRepository
from app.repositories.batch_repository import BatchRepository
from app.schemas.performance import (
    StudentPerformanceRow, LeaderboardEntry, BatchAnalytics,
    AssignmentFeedbackCreate, AssignmentFeedbackOut,
)


class PerformanceService:
    def __init__(self, db: Session):
        self.db = db
        self.repo = PerformanceRepository(db)
        self.batch_repo = BatchRepository(db)

    def batch_analytics(self, batch_id: UUID) -> BatchAnalytics:
        batch = self.batch_repo.get(batch_id)
        student_ids = self.repo.batch_student_ids(batch_id)
        results = self.repo.results_for_students(student_ids)

        totals: dict[UUID, list[float]] = defaultdict(list)
        for r in results:
            if r.score is not None:
                totals[r.user_id].append(float(r.score))

        # Build a row for EVERY enrolled student, not just those with results.
        # Scoring only students who had attempts meant a student with zero
        # attempts - arguably the weakest in the batch - never appeared in
        # `weakStudents` at all.
        rows: List[LeaderboardEntry] = []
        for sid in student_ids:
            scores = totals.get(sid, [])
            rows.append(LeaderboardEntry(
                rank=0, studentId=sid, studentName=self.repo.student_name(sid),
                totalScore=(sum(scores) / len(scores)) if scores else 0.0,
            ))
        rows.sort(key=lambda r: r.totalScore, reverse=True)
        for i, r in enumerate(rows, start=1):
            r.rank = i

        # Average over students who actually attempted something, so one
        # unattempted enrolment doesn't drag the batch average to zero.
        attempted = [r for r in rows if totals.get(r.studentId)]
        avg_score = (sum(r.totalScore for r in attempted) / len(attempted)) if attempted else 0.0

        # Don't let the same student appear in both lists in small batches.
        top_n = min(5, len(rows) // 2) if len(rows) < 10 else 5
        return BatchAnalytics(
            batchId=batch_id, batchName=batch.name if batch else "",
            totalStudents=len(student_ids), averageScore=round(avg_score, 2),
            topPerformers=rows[:top_n],
            weakStudents=list(reversed(rows))[:top_n],
            leaderboard=rows,
        )

    def student_rows_for_batch(self, batch_id: UUID) -> List[StudentPerformanceRow]:
        student_ids = self.repo.batch_student_ids(batch_id)
        results = self.repo.results_for_students(student_ids)
        by_student: dict[UUID, list[float]] = defaultdict(list)
        for r in results:
            if r.score is not None:
                by_student[r.user_id].append(float(r.score))

        rows = []
        for sid in student_ids:
            scores = by_student.get(sid, [])
            rows.append(StudentPerformanceRow(
                studentId=sid, studentName=self.repo.student_name(sid),
                assessmentsTaken=len(scores),
                averageScore=round(sum(scores) / len(scores), 2) if scores else 0.0,
                highestScore=max(scores) if scores else 0.0,
                lowestScore=min(scores) if scores else 0.0,
            ))
        return rows

    def add_feedback(self, payload: AssignmentFeedbackCreate, faculty_id: UUID) -> AssignmentFeedbackOut:
        fb = self.repo.create_feedback(
            result_id=payload.resultId, faculty_id=faculty_id,
            feedback_text=payload.feedbackText, score_override=payload.scoreOverride,
        )
        return AssignmentFeedbackOut(
            id=fb.id, resultId=fb.result_id, facultyId=fb.faculty_id,
            feedbackText=fb.feedback_text, scoreOverride=fb.score_override,
        )
