from uuid import UUID
from typing import List

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.repositories.batch_repository import BatchRepository
from app.models.shared_refs import User
from app.models.course import Course
from app.schemas.batch import BatchCreate, BatchOut, StudentInBatch


class BatchService:
    def __init__(self, db: Session):
        self.db = db
        self.repo = BatchRepository(db)

    def _resolve_course_id(self, course_name):
        if not course_name:
            return None
        course = (
            self.db.query(Course)
            .filter((Course.name == course_name) | (Course.code == course_name))
            .first()
        )
        return course.id if course else None

    def create_batch(self, payload: BatchCreate) -> BatchOut:
        # batches.course_id is NOT NULL. An unresolvable course name used to
        # pass None straight through and surface as an IntegrityError 500.
        course_id = self._resolve_course_id(payload.course)
        if course_id is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(f"Unknown course '{payload.course}'" if payload.course
                        else "A course is required to create a batch"),
            )
        batch = self.repo.create(
            name=payload.name, course_id=course_id,
            faculty_id=payload.facultyId, trainer_id=payload.trainerId,
            start_date=payload.startDate, end_date=payload.endDate,
            batch_time=payload.batchTime,
        )
        return self._to_out(batch)

    def list_my_batches(self, faculty_id: UUID, is_admin: bool = False) -> List[BatchOut]:
        batches = self.repo.list_for_faculty(faculty_id, is_admin=is_admin)
        return [self._to_out(b) for b in batches]

    def add_students(self, batch_id: UUID, student_ids: List[UUID]) -> None:
        self.repo.add_students(batch_id, student_ids)

    def list_students(self, batch_id: UUID) -> List[StudentInBatch]:
        student_ids = self.repo.list_students(batch_id)
        if not student_ids:
            return []
        users = self.db.query(User).filter(User.id.in_(student_ids)).all()
        return [StudentInBatch(id=u.id, name=u.name, email=u.email, phone=u.phone) for u in users]

    def _batch_syllabus_percent(self, student_ids: List[UUID], course_id=None) -> float:
        """Average syllabus completion % across this batch's students,
        scoped to the batch's course when syllabus items are tagged with a
        course_id (falls back to all syllabus items otherwise)."""
        from app.models.student_extras import Syllabus, SyllabusProgress
        q = self.db.query(Syllabus)
        if course_id:
            q = q.filter(Syllabus.course_id == course_id)
        total_items = q.count()
        if total_items == 0 or not student_ids:
            return 0.0
        item_ids = [s.id for s in q.all()] if course_id else None
        percents = []
        for sid in student_ids:
            pq = self.db.query(SyllabusProgress).filter(
                SyllabusProgress.user_id == sid, SyllabusProgress.status == "completed",
            )
            if item_ids is not None:
                pq = pq.filter(SyllabusProgress.syllabus_item_id.in_(item_ids))
            percents.append(pq.count() / total_items * 100)
        return round(sum(percents) / len(percents), 1) if percents else 0.0

    def faculty_summary(self, faculty_id: UUID) -> dict:
        """Faculty's own activity summary: lectures taken (split
        online/offline via distinct batch+date attendance sessions they
        marked), assessments created, mock interviews scheduled."""
        from app.models.attendance import Attendance
        from app.models.assessment import Assessment
        from app.models.mock_interview import MockInterview
        from sqlalchemy import distinct, tuple_

        sessions = (
            self.db.query(Attendance.batch_id, Attendance.date, Attendance.mode)
            .filter(Attendance.marked_by == faculty_id)
            .distinct()
            .all()
        )
        online = sum(1 for s in sessions if s.mode == "online")
        offline = sum(1 for s in sessions if s.mode != "online")

        assessments_count = self.db.query(Assessment).filter(Assessment.created_by == faculty_id).count()
        mocks_count = self.db.query(MockInterview).filter(MockInterview.scheduled_by == faculty_id).count()

        return {
            "lecturesTaken": len(sessions),
            "onlineClasses": online,
            "offlineClasses": offline,
            "assessmentsCreated": assessments_count,
            "mocksScheduled": mocks_count,
        }

    def faculty_directory(self) -> list[dict]:
        """Every faculty/trainer with the batches assigned to them — used by
        the Admin 'Faculty' directory page (Faculty name -> their batches ->
        click a batch to see its students)."""
        from app.models.user import User
        from app.models.course import Batch

        all_batches = self.db.query(Batch).all()
        by_faculty: dict = {}
        for b in all_batches:
            faculty_id = b.faculty_id or b.trainer_id
            if not faculty_id:
                continue
            by_faculty.setdefault(faculty_id, []).append(b)

        rows = []
        for faculty_id, batches in by_faculty.items():
            faculty = self.db.query(User).filter(User.id == faculty_id).first()
            if not faculty:
                continue
            rows.append({
                "facultyId": str(faculty_id),
                "facultyName": faculty.name,
                "facultyEmail": faculty.email,
                "batches": [
                    {"batchId": str(b.id), "batchName": b.name, "course": b.course.name if b.course else None,
                     "studentCount": self.repo.student_count(b.id)}
                    for b in batches
                ],
            })
        rows.sort(key=lambda r: r["facultyName"])
        return rows

    def batches_summary(self, requester_id: UUID, is_admin: bool = False) -> List[dict]:
        """Row data for the Faculty Dashboard batches table: dates, delay,
        syllabus %, batch time, and assessment/mock counts given to each
        batch."""
        from datetime import date as date_cls
        from app.models.assessment import Assessment, Result
        from app.models.mock_interview import MockInterview

        batches = self.repo.list_for_faculty(requester_id, is_admin=is_admin)
        today = date_cls.today()
        rows = []
        for b in batches:
            student_ids = self.repo.list_students(b.id)
            delayed_by = (today - b.end_date).days if b.end_date and today > b.end_date else 0

            assessments_count = self.db.query(Assessment).filter(
                Assessment.batch_ids.isnot(None)
            ).all()
            assessments_for_batch = [
                a for a in assessments_count if a.batch_ids and str(b.id) in [str(x) for x in a.batch_ids]
            ]
            mocks_count = (
                self.db.query(MockInterview).filter(MockInterview.student_id.in_(student_ids)).count()
                if student_ids else 0
            )

            rows.append({
                "batchId": str(b.id),
                "batchName": b.name,
                "course": b.course.name if b.course else None,
                "startDate": b.start_date,
                "endDate": b.end_date,
                "delayedByDays": delayed_by,
                "syllabusPercent": self._batch_syllabus_percent(student_ids, b.course_id),
                "batchTime": getattr(b, "batch_time", None),
                "studentsCount": len(student_ids),
                "assessmentsGiven": len(assessments_for_batch),
                "mocksGiven": mocks_count,
            })
        return rows

    def batch_detail(self, batch_id: UUID) -> dict:
        """Deep detail for the batch-detail full page: dates, delay,
        syllabus %, batch time, assessments given, online/offline lecture
        counts, and the full student roster with active/inactive split."""
        from datetime import date as date_cls
        from app.models.assessment import Assessment, Result
        from app.models.attendance import Attendance
        from app.models.user import User

        b = self.repo.get(batch_id)
        if not b:
            raise HTTPException(status_code=404, detail="Batch not found")

        student_ids = self.repo.list_students(batch_id)
        today = date_cls.today()
        delayed_by = (today - b.end_date).days if b.end_date and today > b.end_date else 0

        all_assessments = self.db.query(Assessment).filter(Assessment.batch_ids.isnot(None)).all()
        assessments_for_batch = [
            a for a in all_assessments if a.batch_ids and str(batch_id) in [str(x) for x in a.batch_ids]
        ]

        active_ids = set()
        results_by_student: dict = {}
        if student_ids:
            all_results = self.db.query(Result).filter(Result.user_id.in_(student_ids)).all()
            active_ids = {r.user_id for r in all_results}
            for r in all_results:
                results_by_student.setdefault(r.user_id, []).append(r)

        # Lecture sessions for this batch, split online/offline (distinct
        # batch+date sessions, not one row per student, since attendance
        # marks one row per student per session).
        sessions = (
            self.db.query(Attendance.date, Attendance.mode)
            .filter(Attendance.batch_id == batch_id)
            .distinct()
            .all()
        )
        online_lectures = sum(1 for s in sessions if s.mode == "online")
        offline_lectures = sum(1 for s in sessions if s.mode != "online")

        students = []
        if student_ids:
            users = self.db.query(User).filter(User.id.in_(student_ids)).all()
            for u in users:
                u_results = results_by_student.get(u.id, [])
                scores = [r.score for r in u_results if r.score is not None]
                students.append({
                    "id": str(u.id), "name": u.name, "email": u.email, "phone": u.phone,
                    "isActive": u.id in active_ids,
                    "averageScore": round(sum(scores) / len(scores), 1) if scores else None,
                })
            students.sort(key=lambda s: s["name"])

        return {
            "batchId": str(batch_id),
            "batchName": b.name,
            "course": b.course.name if b.course else None,
            "startDate": b.start_date,
            "endDate": b.end_date,
            "delayedByDays": delayed_by,
            "syllabusPercent": self._batch_syllabus_percent(student_ids, b.course_id),
            "batchTime": getattr(b, "batch_time", None),
            "assessmentsGiven": len(assessments_for_batch),
            "studentsCount": len(student_ids),
            "activeStudents": len(active_ids),
            "inactiveStudents": len(student_ids) - len(active_ids),
            "onlineLectures": online_lectures,
            "offlineLectures": offline_lectures,
            "students": students,
        }

    def assignments_progress(self, batch_id: UUID) -> dict:
        """Every assignment on the platform, with completion counted against
        THIS batch's roster specifically (assignments aren't batch-scoped in
        the schema, so 'completed by this batch' is computed by
        cross-referencing submissions against this batch's student list)."""
        from app.models.student_extras import Assignment, AssignmentSubmission

        student_ids = self.repo.list_students(batch_id)
        assignments = self.db.query(Assignment).order_by(Assignment.due_date.desc().nullslast()).all()

        rows = []
        for a in assignments:
            submitted_user_ids = set()
            if student_ids:
                subs = self.db.query(AssignmentSubmission).filter(
                    AssignmentSubmission.assignment_id == a.id,
                    AssignmentSubmission.user_id.in_(student_ids),
                ).all()
                submitted_user_ids = {s.user_id for s in subs}
            rows.append({
                "assignmentId": str(a.id),
                "title": a.title,
                "dueDate": a.due_date,
                "maxMarks": a.max_marks,
                "totalStudents": len(student_ids),
                "submittedCount": len(submitted_user_ids),
            })
        return {"batchId": str(batch_id), "assignments": rows}

    def _to_out(self, batch) -> BatchOut:
        course_name = batch.course.name if batch.course else None
        return BatchOut(
            id=batch.id, name=batch.name, course=course_name,
            facultyId=batch.faculty_id, trainerId=batch.trainer_id,
            startDate=batch.start_date, endDate=batch.end_date,
            batchTime=getattr(batch, "batch_time", None),
            createdAt=batch.created_at, studentCount=self.repo.student_count(batch.id),
        )
