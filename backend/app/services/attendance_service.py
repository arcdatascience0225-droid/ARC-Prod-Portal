from datetime import date
from typing import List
from uuid import UUID

import httpx
from sqlalchemy.orm import Session

from app.core.config import settings
from app.repositories.attendance_repository import AttendanceRepository
from app.schemas.attendance import AttendanceMarkRequest, AttendanceOut, AttendanceFaceRecognitionHook


class AttendanceService:
    def __init__(self, db: Session):
        self.db = db
        self.repo = AttendanceRepository(db)

    def mark_attendance(self, payload: AttendanceMarkRequest, marked_by: UUID) -> List[AttendanceOut]:
        results = []
        for entry in payload.entries:
            record = self.repo.upsert_entry(
                batch_id=payload.batchId, student_id=entry.studentId,
                entry_date=payload.date, status=entry.status,
                marked_by=marked_by, method=payload.method,
            )
            results.append(self._to_out(record))
        return results

    def get_batch_attendance(self, batch_id: UUID, entry_date: date) -> List[AttendanceOut]:
        records = self.repo.list_for_batch_date(batch_id, entry_date)
        return [self._to_out(r) for r in records]

    def get_student_history(self, student_id: UUID) -> List[AttendanceOut]:
        records = self.repo.list_for_student(student_id)
        return [self._to_out(r) for r in records]

    def attendance_report(self, batch_id: UUID | None, start_date: date | None, end_date: date | None, student_name: str | None) -> list[dict]:
        """Table rows for the Attendance page: per-student lecture counts,
        optionally filtered by batch, date range, and name."""
        from app.models.attendance import Attendance
        from app.models.user import User
        from app.models.course import BatchStudent

        student_ids = None
        if batch_id:
            student_ids = [r.user_id for r in self.db.query(BatchStudent).filter(BatchStudent.batch_id == batch_id).all()]
            if not student_ids:
                return []

        q = self.db.query(Attendance)
        if student_ids is not None:
            q = q.filter(Attendance.student_id.in_(student_ids))
        if start_date:
            q = q.filter(Attendance.date >= start_date)
        if end_date:
            q = q.filter(Attendance.date <= end_date)
        records = q.all()

        by_student: dict = {}
        for r in records:
            by_student.setdefault(r.student_id, []).append(r)

        rows = []
        for sid, recs in by_student.items():
            user = self.db.query(User).filter(User.id == sid).first()
            if not user:
                continue
            if student_name and student_name.lower() not in user.name.lower():
                continue
            total = len(recs)
            missed = sum(1 for r in recs if r.status == "absent")
            online = sum(1 for r in recs if r.mode == "online")
            offline = sum(1 for r in recs if r.mode != "online")
            rows.append({
                "studentId": str(sid), "studentName": user.name, "studentEmail": user.email,
                "totalLectures": total, "missedLectures": missed,
                "onlineLectures": online, "offlineLectures": offline,
            })
        rows.sort(key=lambda r: r["studentName"])
        return rows

    def student_full_detail(self, student_id: UUID, batch_id: UUID | None = None) -> dict:
        """Full per-student detail for the Attendance page row-click modal:
        lectures, assignments, mocks, rank/score, enrollment context, and
        placement outcomes."""
        from app.models.attendance import Attendance
        from app.models.user import User
        from app.models.course import BatchStudent, Batch
        from app.models.student_extras import AssignmentSubmission
        from app.models.mock_interview import MockInterview, MockInterviewEvaluation
        from app.models.assessment import Result
        from app.models.placement import Application

        user = self.db.query(User).filter(User.id == student_id).first()
        if not user:
            return {}

        att_q = self.db.query(Attendance).filter(Attendance.student_id == student_id)
        if batch_id:
            att_q = att_q.filter(Attendance.batch_id == batch_id)
        att_recs = att_q.all()
        total_lectures = len(att_recs)
        online_lectures = sum(1 for r in att_recs if r.mode == "online")
        offline_lectures = sum(1 for r in att_recs if r.mode != "online")

        assignments_submitted = self.db.query(AssignmentSubmission).filter(
            AssignmentSubmission.user_id == student_id
        ).count()
        assignment_scores = [
            s.marks_obtained for s in self.db.query(AssignmentSubmission).filter(
                AssignmentSubmission.user_id == student_id, AssignmentSubmission.marks_obtained.isnot(None)
            ).all()
        ]
        avg_assignment_score = round(sum(assignment_scores) / len(assignment_scores), 1) if assignment_scores else None

        mocks_given = self.db.query(MockInterview).filter(MockInterview.student_id == student_id).count()
        mock_evals = (
            self.db.query(MockInterviewEvaluation)
            .join(MockInterview, MockInterview.id == MockInterviewEvaluation.mock_interview_id)
            .filter(MockInterview.student_id == student_id)
            .all()
        )
        mock_scores = [e.overall_score for e in mock_evals if e.overall_score is not None]
        avg_mock_score = round(sum(mock_scores) / len(mock_scores), 1) if mock_scores else None

        results = self.db.query(Result).filter(Result.user_id == student_id, Result.score.isnot(None)).all()
        avg_score = round(sum(r.score for r in results) / len(results), 1) if results else None

        rank = None
        link = self.db.query(BatchStudent).filter(BatchStudent.user_id == student_id).first()
        batch_name = faculty_name = None
        if link:
            batch = self.db.query(Batch).filter(Batch.id == link.batch_id).first()
            if batch:
                batch_name = batch.name
                faculty_id = batch.faculty_id or batch.trainer_id
                if faculty_id:
                    faculty = self.db.query(User).filter(User.id == faculty_id).first()
                    faculty_name = faculty.name if faculty else None
                # Rank within batch by average score
                batchmate_ids = [r.user_id for r in self.db.query(BatchStudent).filter(BatchStudent.batch_id == link.batch_id).all()]
                batchmate_scores = []
                for bid in batchmate_ids:
                    br = self.db.query(Result).filter(Result.user_id == bid, Result.score.isnot(None)).all()
                    if br:
                        batchmate_scores.append((bid, sum(r.score for r in br) / len(br)))
                batchmate_scores.sort(key=lambda x: x[1], reverse=True)
                for i, (bid, _s) in enumerate(batchmate_scores):
                    if bid == student_id:
                        rank = i + 1
                        break

        applications = self.db.query(Application).filter(Application.student_id == student_id).all()
        jobs_applied = len(applications)
        jobs_rejected = sum(1 for a in applications if a.status == "rejected")
        placed = any(a.status == "placed" for a in applications)

        return {
            "studentId": str(student_id),
            "studentName": user.name,
            "studentEmail": user.email,
            "totalLectures": total_lectures,
            "onlineLectures": online_lectures,
            "offlineLectures": offline_lectures,
            "assignmentsSubmitted": assignments_submitted,
            "mocksGiven": mocks_given,
            "rank": rank,
            "score": avg_score,
            "assignmentsScore": avg_assignment_score,
            "mockScore": avg_mock_score,
            "batchName": batch_name,
            "facultyName": faculty_name,
            "jobsApplied": jobs_applied,
            "jobsRejected": jobs_rejected,
            "placed": placed,
        }

    async def trigger_face_recognition(self, payload: AttendanceFaceRecognitionHook) -> dict:
        """
        Placeholder hook only. The actual face-recognition model/service is
        being built in a separate phase (AIRA). This just forwards the
        request and expects back a list of {studentId, status} entries which
        the caller can then pass into mark_attendance().
        """
        if not settings.FACE_RECOGNITION_SERVICE_URL:
            return {"status": "not_configured", "detected": []}

        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(
                f"{settings.FACE_RECOGNITION_SERVICE_URL}/detect-attendance",
                json={
                    "batchId": str(payload.batchId),
                    "date": payload.date.isoformat(),
                    "imageUrl": payload.imageUrl,
                },
            )
            resp.raise_for_status()
            return resp.json()

    def _to_out(self, record) -> AttendanceOut:
        return AttendanceOut(
            id=record.id, batchId=record.batch_id, studentId=record.student_id,
            date=record.date, status=record.status, method=record.method,
            markedBy=record.marked_by, createdAt=record.created_at,
        )
