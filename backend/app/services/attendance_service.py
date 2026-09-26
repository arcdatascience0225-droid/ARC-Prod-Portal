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
        from app.models.attendance import AttendanceNote
        results = []
        for entry in payload.entries:
            record = self.repo.upsert_entry(
                batch_id=payload.batchId, student_id=entry.studentId,
                entry_date=payload.date, status=entry.status,
                marked_by=marked_by, method=payload.method, mode=payload.mode,
            )
            note = self.db.query(AttendanceNote).filter(AttendanceNote.attendance_id == record.id).first()
            if entry.reason or entry.photoUrl:
                if note:
                    note.reason = entry.reason
                    note.photo_url = entry.photoUrl
                else:
                    note = AttendanceNote(attendance_id=record.id, reason=entry.reason, photo_url=entry.photoUrl)
                    self.db.add(note)
                self.db.commit()
            elif note and entry.status == "present":
                self.db.delete(note)
                self.db.commit()
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
        from app.models.attendance import AttendanceNote
        note = self.db.query(AttendanceNote).filter(AttendanceNote.attendance_id == record.id).first()
        return AttendanceOut(
            id=record.id, batchId=record.batch_id, studentId=record.student_id,
            date=record.date, status=record.status, method=record.method, mode=record.mode,
            markedBy=record.marked_by, createdAt=record.created_at,
            reason=note.reason if note else None, photoUrl=note.photo_url if note else None,
        )

    # ---------- Holidays ----------
    def list_holidays(self, batch_id: UUID | None = None) -> list[dict]:
        from app.models.attendance import Holiday
        q = self.db.query(Holiday)
        if batch_id:
            q = q.filter((Holiday.batch_id == batch_id) | (Holiday.batch_id.is_(None)))
        rows = q.order_by(Holiday.date.desc()).all()
        return [{"id": h.id, "date": h.date, "label": h.label, "batchId": h.batch_id} for h in rows]

    def add_holiday(self, entry_date: date, label: str, batch_id: UUID | None, created_by: UUID) -> dict:
        from app.models.attendance import Holiday
        h = Holiday(date=entry_date, label=label, batch_id=batch_id, created_by=created_by)
        self.db.add(h)
        self.db.commit()
        self.db.refresh(h)
        return {"id": h.id, "date": h.date, "label": h.label, "batchId": h.batch_id}

    def remove_holiday(self, holiday_id: UUID) -> None:
        from app.models.attendance import Holiday
        h = self.db.query(Holiday).filter(Holiday.id == holiday_id).first()
        if h:
            self.db.delete(h)
            self.db.commit()

    # ---------- Month grid ----------
    def month_grid(self, batch_id: UUID, year: int, month: int) -> dict:
        """Every student in the batch x every date in the month that has at
        least one mark - the spreadsheet-style Month view."""
        from calendar import monthrange
        from app.models.attendance import Attendance
        from app.models.user import User
        from app.models.course import BatchStudent

        start = date(year, month, 1)
        end = date(year, month, monthrange(year, month)[1])
        records = self.db.query(Attendance).filter(
            Attendance.batch_id == batch_id, Attendance.date >= start, Attendance.date <= end,
        ).all()
        dates = sorted({r.date for r in records})

        student_ids = [r[0] for r in self.db.query(BatchStudent.user_id).filter(BatchStudent.batch_id == batch_id).all()]
        students = self.db.query(User).filter(User.id.in_(student_ids)).order_by(User.name).all()

        by_student_date = {(r.student_id, r.date): r.status for r in records}
        rows = []
        for s in students:
            cells = [by_student_date.get((s.id, d), "-") for d in dates]
            present_count = sum(1 for c in cells if c in ("present", "late"))
            marked_count = sum(1 for c in cells if c != "-")
            pct = round(present_count / marked_count * 100, 1) if marked_count else None
            rows.append({"studentId": str(s.id), "studentName": s.name, "cells": cells, "percent": pct})

        present_total = sum(1 for r in records if r.status in ("present", "late"))
        class_pct = round(present_total / len(records) * 100, 1) if records else None

        return {
            "dates": [d.isoformat() for d in dates],
            "rows": rows,
            "classPercent": class_pct,
            "absences": sum(1 for r in records if r.status == "absent"),
            "lates": sum(1 for r in records if r.status == "late"),
        }

    # ---------- Enhanced student detail: month-by-month + full absence list ----------
    def student_attendance_breakdown(self, student_id: UUID, batch_id: UUID | None = None) -> dict:
        from app.models.attendance import Attendance, AttendanceNote

        q = self.db.query(Attendance).filter(Attendance.student_id == student_id)
        if batch_id:
            q = q.filter(Attendance.batch_id == batch_id)
        records = q.order_by(Attendance.date.desc()).all()

        by_month: dict = {}
        for r in records:
            key = r.date.strftime("%Y-%m")
            by_month.setdefault(key, {"present": 0, "absent": 0, "late": 0})
            by_month[key][r.status] += 1
        months = [
            {"month": k, **v, "total": v["present"] + v["absent"] + v["late"],
             "percent": round((v["present"] + v["late"]) / (v["present"] + v["absent"] + v["late"]) * 100, 1)
             if (v["present"] + v["absent"] + v["late"]) else None}
            for k, v in sorted(by_month.items(), reverse=True)
        ]

        absences = []
        for r in records:
            if r.status == "present":
                continue
            note = self.db.query(AttendanceNote).filter(AttendanceNote.attendance_id == r.id).first()
            absences.append({
                "date": r.date.isoformat(), "status": r.status,
                "reason": note.reason if note else None,
                "photoUrl": note.photo_url if note else None,
            })

        present = sum(1 for r in records if r.status == "present")
        absent = sum(1 for r in records if r.status == "absent")
        late = sum(1 for r in records if r.status == "late")
        total = len(records)
        pct = round((present + late) / total * 100, 1) if total else None

        return {
            "present": present, "absent": absent, "late": late, "total": total, "percent": pct,
            "months": months, "absences": absences,
        }

    # ---------- Date-wise lookup ----------
    def student_on_date(self, student_id: UUID, on_date: date) -> dict:
        from app.models.attendance import Attendance, AttendanceNote
        r = self.db.query(Attendance).filter(Attendance.student_id == student_id, Attendance.date == on_date).first()
        if not r:
            return {"status": "not_marked", "reason": None, "photoUrl": None}
        note = self.db.query(AttendanceNote).filter(AttendanceNote.attendance_id == r.id).first()
        return {"status": r.status, "reason": note.reason if note else None, "photoUrl": note.photo_url if note else None}

    def staff_on_date(self, staff_id: UUID, on_date: date) -> dict:
        from app.models.staff_attendance import StaffAttendance, StaffAttendanceNote
        r = self.db.query(StaffAttendance).filter(StaffAttendance.staff_id == staff_id, StaffAttendance.date == on_date).first()
        if not r:
            return {"status": "not_marked", "reason": None}
        note = self.db.query(StaffAttendanceNote).filter(StaffAttendanceNote.staff_attendance_id == r.id).first()
        return {"status": r.status, "reason": note.reason if note else None}

    # ---------- Staff breakdown (mirrors student_attendance_breakdown) ----------
    def staff_attendance_breakdown(self, staff_id: UUID) -> dict:
        from app.models.staff_attendance import StaffAttendance, StaffAttendanceNote

        records = self.db.query(StaffAttendance).filter(StaffAttendance.staff_id == staff_id).order_by(StaffAttendance.date.desc()).all()

        by_month: dict = {}
        for r in records:
            key = r.date.strftime("%Y-%m")
            by_month.setdefault(key, {"present": 0, "absent": 0, "late": 0})
            by_month[key][r.status] += 1
        months = [
            {"month": k, **v, "total": v["present"] + v["absent"] + v["late"],
             "percent": round((v["present"] + v["late"]) / (v["present"] + v["absent"] + v["late"]) * 100, 1)
             if (v["present"] + v["absent"] + v["late"]) else None}
            for k, v in sorted(by_month.items(), reverse=True)
        ]

        absences = []
        for r in records:
            if r.status == "present":
                continue
            note = self.db.query(StaffAttendanceNote).filter(StaffAttendanceNote.staff_attendance_id == r.id).first()
            absences.append({"date": r.date.isoformat(), "status": r.status, "reason": note.reason if note else None})

        present = sum(1 for r in records if r.status == "present")
        absent = sum(1 for r in records if r.status == "absent")
        late = sum(1 for r in records if r.status == "late")
        total = len(records)
        pct = round((present + late) / total * 100, 1) if total else None

        return {
            "present": present, "absent": absent, "late": late, "total": total, "percent": pct,
            "months": months, "absences": absences,
        }

    # ---------- Analytics: bar / pie / line ----------
    def analytics(self, batch_id: UUID | None = None, days: int = 30) -> dict:
        """Data for the three dashboard charts:
        - bar: attendance % by batch (or empty if a single batch is already picked)
        - pie: overall Present / Absent / Late split
        - line: daily attendance % trend over the last `days` days
        """
        from datetime import timedelta
        from app.models.attendance import Attendance
        from app.models.course import Batch

        cutoff = date.today() - timedelta(days=days)
        q = self.db.query(Attendance).filter(Attendance.date >= cutoff)
        if batch_id:
            q = q.filter(Attendance.batch_id == batch_id)
        records = q.all()

        present_n = sum(1 for r in records if r.status == "present")
        absent_n = sum(1 for r in records if r.status == "absent")
        late_n = sum(1 for r in records if r.status == "late")

        bar = []
        if not batch_id:
            batches = self.db.query(Batch).all()
            for b in batches:
                b_records = [r for r in records if r.batch_id == b.id]
                if not b_records:
                    continue
                b_present = sum(1 for r in b_records if r.status in ("present", "late"))
                bar.append({"label": b.name, "percent": round(b_present / len(b_records) * 100, 1)})

        by_day: dict = {}
        for r in records:
            by_day.setdefault(r.date, {"present": 0, "total": 0})
            by_day[r.date]["total"] += 1
            if r.status in ("present", "late"):
                by_day[r.date]["present"] += 1
        line = [
            {"date": d.isoformat(), "percent": round(v["present"] / v["total"] * 100, 1) if v["total"] else None}
            for d, v in sorted(by_day.items())
        ]

        return {
            "pie": {"present": present_n, "absent": absent_n, "late": late_n},
            "bar": bar,
            "line": line,
        }
