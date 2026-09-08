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

    def create_assignment(self, faculty_id: UUID, title: str, description: str | None,
                           due_date, max_marks: float, file_url: str | None = None) -> dict:
        """Faculty-facing: create a new assignment for students to see and
        submit against. Previously there was no way to do this at all —
        only evaluation of existing submissions existed."""
        from app.models.student_extras import Assignment
        assignment = Assignment(
            title=title, description=description, due_date=due_date,
            max_marks=max_marks, created_by=faculty_id,
        )
        if file_url:
            # Attachment URL is appended to the description so it survives
            # without needing a schema migration for a dedicated column.
            attachment_note = f"\n\n📎 Attachment: {file_url}"
            assignment.description = (assignment.description or "") + attachment_note
        self.db.add(assignment)
        self.db.commit()
        self.db.refresh(assignment)
        return {
            "id": assignment.id, "title": assignment.title, "description": assignment.description,
            "dueDate": assignment.due_date, "maxMarks": assignment.max_marks,
        }

    def list_my_assignments(self, faculty_id: UUID) -> list[dict]:
        from app.models.student_extras import Assignment
        rows = (
            self.db.query(Assignment)
            .filter(Assignment.created_by == faculty_id)
            .order_by(Assignment.created_at.desc())
            .all()
        )
        return [
            {"id": a.id, "title": a.title, "description": a.description,
             "dueDate": a.due_date, "maxMarks": a.max_marks}
            for a in rows
        ]

    def list_submissions(self, assignment_id: UUID) -> list[dict]:
        """Faculty-facing: every student's submission for one assignment,
        including the AI pre-check text, so faculty can review and grade."""
        from app.models.student_extras import AssignmentSubmission
        from app.models.shared_refs import User
        rows = (
            self.db.query(AssignmentSubmission, User)
            .join(User, User.id == AssignmentSubmission.user_id)
            .filter(AssignmentSubmission.assignment_id == assignment_id)
            .order_by(AssignmentSubmission.submitted_at.desc())
            .all()
        )
        return [
            {
                "id": sub.id, "studentName": user.name, "studentEmail": user.email,
                "submissionType": sub.submission_type, "fileUrl": sub.file_url,
                "repoLink": sub.repo_link, "status": sub.status,
                "facultyFeedback": sub.faculty_feedback, "marksObtained": sub.marks_obtained,
                "submittedAt": sub.submitted_at,
            }
            for sub, user in rows
        ]

    def grade_submission(self, submission_id: UUID, marks: float, feedback: str | None) -> dict:
        from app.models.student_extras import AssignmentSubmission
        from datetime import datetime, timezone
        from fastapi import HTTPException
        sub = self.db.query(AssignmentSubmission).filter(AssignmentSubmission.id == submission_id).first()
        if not sub:
            raise HTTPException(status_code=404, detail="Submission not found")
        sub.marks_obtained = marks
        sub.faculty_feedback = feedback
        sub.status = "reviewed"
        sub.reviewed_at = datetime.now(timezone.utc)
        self.db.commit()
        return {"id": sub.id, "status": sub.status, "marksObtained": sub.marks_obtained}

    async def ai_check_submission(self, submission_id: UUID) -> dict:
        """Runs an automated AI pre-check on a student's assignment
        submission as soon as they submit it — separate from (and prior
        to) the faculty's own manual review/feedback. Student-facing
        volume, so always Groq, never Gemini."""
        from app.models.student_extras import AssignmentSubmission, Assignment
        from app.services.ai_provider import get_ai_client

        sub = self.db.query(AssignmentSubmission).filter(AssignmentSubmission.id == submission_id).first()
        if not sub:
            return {"error": "Submission not found"}
        assignment = self.db.query(Assignment).filter(Assignment.id == sub.assignment_id).first()

        content_summary = sub.repo_link or sub.file_url or "(no content link provided)"
        prompt = (
            f"Assignment: {assignment.title if assignment else 'Unknown'}\n"
            f"Description: {assignment.description if assignment else ''}\n"
            f"Student submitted a {sub.submission_type}: {content_summary}\n\n"
            "Give a short (2-3 sentence) preliminary AI check: does this look like a "
            "genuine, complete submission for this assignment? Note anything that "
            "looks obviously incomplete or off-topic. This is a pre-check only — "
            "the faculty will still review and grade it themselves."
        )
        client = get_ai_client(force_provider="groq")
        text, tokens = client.generate(prompt, "You are an assignment pre-check assistant. Be brief and factual.")

        sub.status = "ai_checked"
        sub.faculty_feedback = f"🤖 AI Pre-check: {text}"
        self.db.commit()
        return {"submissionId": str(submission_id), "aiPreCheck": text}

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
