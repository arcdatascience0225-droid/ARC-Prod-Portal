"""
Repository / Data Access Layer.
Raw-ish SQLAlchemy Core/ORM queries only. No business logic here.
Existing shared tables (users, assessments, questions, student_answers, results,
coding_questions, test_cases, coding_submissions, ai_usage, chat_history) are
accessed via `db.execute(text(...))` since their ORM models live in the shared
core module owned by another phase; this keeps Phase 2 decoupled from how
Phase 1 defines those models while still respecting the fixed schema.
"""
import uuid
import json
from datetime import datetime
from typing import Optional, Any
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.models.student_extras import (
    StudentProfile, StudentCertificate, Syllabus, SyllabusProgress, Lecture,
    Assignment, AssignmentSubmission, PracticeQuestion, DailyChallenge,
    DailyChallengeAttempt, Attendance, Notification, CodeReview,
)
from app.models.admin_platform import NotificationRecipient


class StudentRepository:
    def __init__(self, db: Session):
        self.db = db

    # ---------- Dashboard ----------
    def get_user(self, user_id: str) -> Optional[dict]:
        row = self.db.execute(
            text("SELECT id, name, email, role FROM users WHERE id = :uid"), {"uid": user_id}
        ).mappings().first()
        return dict(row) if row else None

    def get_progress_percent(self, user_id: str) -> float:
        total = self.db.query(Syllabus).count()
        if total == 0:
            return 0.0
        completed = (
            self.db.query(SyllabusProgress)
            .filter(SyllabusProgress.user_id == user_id, SyllabusProgress.status == "completed")
            .count()
        )
        return round((completed / total) * 100, 2)

    def get_attendance_percent(self, user_id: str) -> float:
        total = self.db.query(Attendance).filter(Attendance.student_id == user_id).count()
        if total == 0:
            return 0.0
        present = (
            self.db.query(Attendance)
            .filter(Attendance.student_id == user_id, Attendance.status == "present")
            .count()
        )
        return round((present / total) * 100, 2)

    def get_upcoming_assessments(self, user_id: str, limit: int = 5) -> list[dict]:
        my_batches = {
            str(row[0])
            for row in self.db.execute(
                text("SELECT batch_id FROM batch_students WHERE user_id = :uid"), {"uid": user_id}
            ).all()
        }
        rows = self.db.execute(
            text("""
                SELECT a.id, a.title, a.type, a.duration, a.batch_ids
                FROM assessments a
                WHERE NOT EXISTS (
                    SELECT 1 FROM results r WHERE r.assessment_id = a.id AND r.user_id = :uid
                    AND r.status = 'completed'
                )
                ORDER BY a.created_at DESC
            """),
            {"uid": user_id},
        ).mappings().all()

        visible = []
        for r in rows:
            raw = r["batch_ids"]
            if isinstance(raw, str):
                try:
                    batch_ids = json.loads(raw) if raw else []
                except (TypeError, ValueError):
                    batch_ids = []
            else:
                batch_ids = raw or []
            # No batch set on the assessment -> treat as unrestricted (legacy/global).
            # Otherwise the student must belong to one of the targeted batches.
            if not batch_ids or my_batches.intersection(str(b) for b in batch_ids):
                visible.append({k: v for k, v in dict(r).items() if k != "batch_ids"})
            if len(visible) >= limit:
                break
        return visible

    def get_recent_notifications(self, user_id: str, limit: int = 10) -> list[dict]:
        """Returns plain dicts, not Notification ORM rows.

        `is_read` lives on NotificationRecipient, not Notification, and the
        dashboard schema requires it - returning bare Notification objects
        made `NotificationOut.model_validate(...)` raise a ValidationError as
        soon as any notification existed for the student (the endpoint only
        appeared to work while the table was empty). `recipientId` is included
        so the UI can call PUT /notifications/mine/{recipientId}/read.
        """
        rows = (
            self.db.query(NotificationRecipient, Notification)
            .join(Notification, Notification.id == NotificationRecipient.notification_id)
            .filter(NotificationRecipient.user_id == user_id)
            .order_by(Notification.created_at.desc())
            .limit(limit)
            .all()
        )
        return [
            {
                "id": n.id,
                "recipient_id": rec.id,
                "title": n.title,
                "message": n.message,
                "type": n.type,
                "is_read": bool(rec.is_read),
                "link": None,
                "created_at": n.created_at,
            }
            for rec, n in rows
        ]

    # ---------- Profile ----------
    def get_or_create_profile(self, user_id: str) -> StudentProfile:
        profile = self.db.query(StudentProfile).filter(StudentProfile.user_id == user_id).first()
        if not profile:
            profile = StudentProfile(user_id=user_id)
            self.db.add(profile)
            self.db.commit()
            self.db.refresh(profile)
        return profile

    def update_profile(self, user_id: str, data: dict) -> StudentProfile:
        profile = self.get_or_create_profile(user_id)
        for k, v in data.items():
            if v is not None:
                setattr(profile, k, v)
        self.db.commit()
        self.db.refresh(profile)
        return profile

    def list_certificates(self, user_id: str) -> list[StudentCertificate]:
        return (
            self.db.query(StudentCertificate)
            .filter(StudentCertificate.user_id == user_id)
            .order_by(StudentCertificate.issue_date.desc().nullslast())
            .all()
        )

    def add_certificate(self, user_id: str, data: dict) -> StudentCertificate:
        cert = StudentCertificate(user_id=user_id, **data)
        self.db.add(cert)
        self.db.commit()
        self.db.refresh(cert)
        return cert

    def get_certificate(self, cert_id: str, user_id: str) -> StudentCertificate | None:
        return self.db.query(StudentCertificate).filter(
            StudentCertificate.id == cert_id, StudentCertificate.user_id == user_id,
        ).first()

    def update_certificate(self, cert_id: str, user_id: str, data: dict) -> StudentCertificate | None:
        cert = self.get_certificate(cert_id, user_id)
        if not cert:
            return None
        for k, v in data.items():
            setattr(cert, k, v)
        self.db.commit()
        self.db.refresh(cert)
        return cert

    def delete_certificate(self, cert_id: str, user_id: str) -> bool:
        cert = self.get_certificate(cert_id, user_id)
        if not cert:
            return False
        self.db.delete(cert)
        self.db.commit()
        return True

    # ---------- Learning ----------
    def list_syllabus_with_progress(self, user_id: str) -> list[dict]:
        items = self.db.query(Syllabus).order_by(Syllabus.order_index).all()
        progress = {
            p.syllabus_item_id: p.status
            for p in self.db.query(SyllabusProgress).filter(SyllabusProgress.user_id == user_id)
        }
        return [
            {
                "id": i.id, "title": i.title, "description": i.description,
                "module": i.module, "order_index": i.order_index,
                "status": progress.get(i.id, "pending"),
            }
            for i in items
        ]

    def mark_syllabus_status(self, user_id: str, syllabus_item_id: str, status: str) -> SyllabusProgress:
        prog = (
            self.db.query(SyllabusProgress)
            .filter(SyllabusProgress.user_id == user_id, SyllabusProgress.syllabus_item_id == syllabus_item_id)
            .first()
        )
        if not prog:
            prog = SyllabusProgress(user_id=user_id, syllabus_item_id=syllabus_item_id)
            self.db.add(prog)
        prog.status = status
        if status == "completed":
            prog.completed_at = datetime.utcnow()
        self.db.commit()
        self.db.refresh(prog)
        return prog

    def list_lectures(self, syllabus_item_id: Optional[str] = None) -> list[Lecture]:
        q = self.db.query(Lecture)
        if syllabus_item_id:
            q = q.filter(Lecture.syllabus_item_id == syllabus_item_id)
        return q.all()

    def list_assignments_for_student(self, user_id: str) -> list[dict]:
        assignments = self.db.query(Assignment).order_by(Assignment.due_date).all()
        subs = {
            s.assignment_id: s.status
            for s in self.db.query(AssignmentSubmission).filter(AssignmentSubmission.user_id == user_id)
        }
        return [
            {
                "id": a.id, "title": a.title, "description": a.description,
                "due_date": a.due_date, "max_marks": a.max_marks,
                "my_submission_status": subs.get(a.id),
            }
            for a in assignments
        ]

    def create_submission(self, user_id: str, data: dict) -> AssignmentSubmission:
        sub = AssignmentSubmission(user_id=user_id, **data)
        self.db.add(sub)
        self.db.commit()
        self.db.refresh(sub)
        return sub

    def list_practice_questions(self, topic: Optional[str] = None, difficulty: Optional[str] = None) -> list[PracticeQuestion]:
        q = self.db.query(PracticeQuestion)
        if topic:
            q = q.filter(PracticeQuestion.topic == topic)
        if difficulty:
            q = q.filter(PracticeQuestion.difficulty == difficulty)
        return q.limit(50).all()

    def get_today_challenge(self, today: datetime) -> Optional[DailyChallenge]:
        return (
            self.db.query(DailyChallenge)
            .filter(text("DATE(challenge_date) = DATE(:today)"))
            .params(today=today)
            .first()
        )

    def get_challenge_attempt(self, user_id: str, challenge_id: str) -> Optional[DailyChallengeAttempt]:
        return (
            self.db.query(DailyChallengeAttempt)
            .filter(
                DailyChallengeAttempt.user_id == user_id,
                DailyChallengeAttempt.daily_challenge_id == challenge_id,
            )
            .first()
        )

    def create_challenge_attempt(self, user_id: str, challenge_id: str, answer_text: str, is_correct: bool) -> DailyChallengeAttempt:
        attempt = DailyChallengeAttempt(
            user_id=user_id, daily_challenge_id=challenge_id,
            answer_text=answer_text, is_correct=is_correct,
        )
        self.db.add(attempt)
        self.db.commit()
        self.db.refresh(attempt)
        return attempt

    # ---------- Assessment (shared tables via raw SQL) ----------
    def get_assessment(self, assessment_id: str) -> Optional[dict]:
        row = self.db.execute(
            text("SELECT * FROM assessments WHERE id = :id"), {"id": assessment_id}
        ).mappings().first()
        return dict(row) if row else None

    @staticmethod
    def _decode_question(row) -> dict:
        """Rows fetched with raw `text()` SQL bypass SQLAlchemy's JSON type
        decoding, so `data` and `tags` come back as raw JSON *strings* on
        SQLite. Every caller expects dicts/lists - `(q.get("data") or {}).get(...)`
        raised AttributeError on a str - so decode them here, once."""
        q = dict(row)
        for col in ("data", "tags"):
            raw = q.get(col)
            if isinstance(raw, (str, bytes)):
                try:
                    q[col] = json.loads(raw)
                except (ValueError, TypeError):
                    q[col] = None
        return q

    def get_questions_for_assessment(self, assessment_id: str) -> list[dict]:
        """Questions belonging to an assessment.

        `questions.assessment_id` is only set for questions authored inline;
        assessments built from the question bank carry their selection in
        `assessments.question_ids`, so both sources are unioned here - building
        an assessment from the bank previously produced an attempt with zero
        questions.
        """
        rows = self.db.execute(
            text("SELECT * FROM questions WHERE assessment_id = :aid"), {"aid": assessment_id}
        ).mappings().all()
        questions = [self._decode_question(r) for r in rows]
        seen = {str(q["id"]) for q in questions}

        arow = self.db.execute(
            text("SELECT question_ids FROM assessments WHERE id = :aid"), {"aid": assessment_id}
        ).mappings().first()
        if arow:
            raw = arow.get("question_ids")
            if isinstance(raw, (str, bytes)):
                try:
                    raw = json.loads(raw)
                except (ValueError, TypeError):
                    raw = []
            ordered = [str(q) for q in (raw or []) if str(q) not in seen]
            for qid in ordered:
                qrow = self.db.execute(
                    text("SELECT * FROM questions WHERE id = :id"), {"id": qid}
                ).mappings().first()
                if qrow:
                    questions.append(self._decode_question(qrow))
        return questions

    def get_question(self, question_id: str) -> Optional[dict]:
        row = self.db.execute(
            text("SELECT * FROM questions WHERE id = :id"), {"id": question_id}
        ).mappings().first()
        return self._decode_question(row) if row else None

    def get_existing_in_progress_result(self, assessment_id: str, user_id: str) -> Optional[dict]:
        row = self.db.execute(
            text("""SELECT * FROM results WHERE assessment_id=:aid AND user_id=:uid
                     AND status = 'in_progress'"""),
            {"aid": assessment_id, "uid": user_id},
        ).mappings().first()
        return dict(row) if row else None

    def get_blocking_result(self, assessment_id: str, user_id: str) -> Optional[dict]:
        """Any prior result for this assessment+user that should PREVENT starting a new
        attempt: terminated (banned due to violations) or completed (already submitted)."""
        row = self.db.execute(
            text("""SELECT * FROM results WHERE assessment_id=:aid AND user_id=:uid
                     AND (status = 'terminated' OR status = 'completed' OR is_terminated = TRUE)
                     ORDER BY started_at DESC LIMIT 1"""),
            {"aid": assessment_id, "uid": user_id},
        ).mappings().first()
        return dict(row) if row else None

    def create_result(self, assessment_id: str, user_id: str) -> dict:
        new_id = str(uuid.uuid4())
        self.db.execute(
            text("""INSERT INTO results (id, assessment_id, user_id, score, status, violation_count, is_flagged, is_terminated, help_requested, started_at)
                     VALUES (:id, :aid, :uid, 0, 'in_progress', 0, FALSE, FALSE, FALSE, CURRENT_TIMESTAMP)"""),
            {"id": new_id, "aid": assessment_id, "uid": user_id},
        )
        self.db.commit()
        return self.get_result(new_id)

    def get_result(self, result_id: str) -> Optional[dict]:
        row = self.db.execute(
            text("SELECT * FROM results WHERE id = :id"), {"id": result_id}
        ).mappings().first()
        return dict(row) if row else None

    def upsert_student_answer(self, assessment_id: str, user_id: str, question_id: str, answer_text, selected_option):
        """Saves an answer using the model's canonical columns: result_id + question_id + answer_data (JSON).
        assessment_id/user_id are used only to resolve the result_id FK."""
        import json as _j
        result_row = self.db.execute(
            text("SELECT id FROM results WHERE assessment_id=:aid AND user_id=:uid AND status='in_progress' LIMIT 1"),
            {"aid": str(assessment_id), "uid": str(user_id)},
        ).mappings().first()
        if not result_row:
            return  # no active attempt, skip silently

        result_id = str(result_row["id"])
        qid = str(question_id)
        answer_data = _j.dumps({"answer_text": answer_text, "selected_option": selected_option})

        existing = self.db.execute(
            text("SELECT id FROM student_answers WHERE result_id=:rid AND question_id=:qid"),
            {"rid": result_id, "qid": qid},
        ).mappings().first()

        if existing:
            self.db.execute(
                text("UPDATE student_answers SET answer_data=:ad WHERE id=:id"),
                {"ad": answer_data, "id": str(existing["id"])},
            )
        else:
            self.db.execute(
                text("""INSERT INTO student_answers (id, result_id, question_id, answer_data, created_at)
                        VALUES (:id, :rid, :qid, :ad, CURRENT_TIMESTAMP)"""),
                {"id": str(uuid.uuid4()), "rid": result_id, "qid": qid, "ad": answer_data},
            )
        self.db.commit()

    def get_student_answers(self, assessment_id: str, user_id: str) -> list[dict]:
        """Get answers via result_id (the actual FK in the model)."""
        import json as _j
        result_row = self.db.execute(
            text("SELECT id FROM results WHERE assessment_id=:aid AND user_id=:uid LIMIT 1"),
            {"aid": str(assessment_id), "uid": str(user_id)},
        ).mappings().first()
        if not result_row:
            return []
        rows = self.db.execute(
            text("SELECT * FROM student_answers WHERE result_id=:rid"),
            {"rid": str(result_row["id"])},
        ).mappings().all()
        result = []
        for r in rows:
            d = dict(r)
            ad = d.get("answer_data")
            if ad:
                try:
                    parsed = _j.loads(ad) if isinstance(ad, str) else ad
                    d["answer_text"] = parsed.get("answer_text")
                    d["selected_option"] = parsed.get("selected_option")
                except Exception:
                    d["answer_text"] = None
                    d["selected_option"] = None
            result.append(d)
        return result

    def finalize_result(self, result_id: str, score: float, status: str):
        self.db.execute(
            text("""UPDATE results SET score=:score, status=:status, submitted_at=CURRENT_TIMESTAMP
                     WHERE id=:id"""),
            {"score": score, "status": status, "id": result_id},
        )
        self.db.commit()

    def compute_rank_and_percentile(self, assessment_id: str, user_id: str, score: float) -> tuple[Optional[int], Optional[float]]:
        rows = self.db.execute(
            text("""SELECT user_id, score FROM results
                     WHERE assessment_id=:aid AND status='completed'
                     ORDER BY score DESC"""),
            {"aid": assessment_id},
        ).mappings().all()
        if not rows:
            return None, None
        scores = [r["score"] for r in rows]
        n = len(scores)
        rank = next((i + 1 for i, r in enumerate(rows) if str(r["user_id"]) == str(user_id)), None)
        below = sum(1 for s in scores if s < score)
        percentile = round((below / n) * 100, 2) if n > 0 else None
        return rank, percentile

    def list_assessment_history(self, user_id: str) -> list[dict]:
        rows = self.db.execute(
            text("""
                SELECT r.id as result_id, a.title as assessment_title, a.type as type,
                       r.score, r.status, r.submitted_at, r.assessment_id
                FROM results r
                JOIN assessments a ON a.id = r.assessment_id
                WHERE r.user_id = :uid
                ORDER BY r.started_at DESC
            """),
            {"uid": user_id},
        ).mappings().all()
        return [dict(r) for r in rows]

    def save_ai_usage(self, user_id: str, module: str, tokens_used: int, cost: float):
        self.db.execute(
            text("""INSERT INTO ai_usage (id, user_id, module, tokens_used, cost, created_at)
                     VALUES (:id, :uid, :module, :tokens, :cost, CURRENT_TIMESTAMP)"""),
            {"id": str(uuid.uuid4()), "uid": user_id, "module": module, "tokens": tokens_used, "cost": cost},
        )
        self.db.commit()

    # ---------- Coding Lab ----------
    def get_coding_question(self, coding_question_id: str) -> Optional[dict]:
        row = self.db.execute(
            text("""SELECT cq.*, q.question_text, q.marks FROM coding_questions cq
                     JOIN questions q ON q.id = cq.question_id
                     WHERE cq.id = :id"""),
            {"id": coding_question_id},
        ).mappings().first()
        return dict(row) if row else None

    def get_test_cases(self, coding_question_id: str, include_hidden: bool = True) -> list[dict]:
        query = "SELECT * FROM test_cases WHERE coding_question_id = :id"
        if not include_hidden:
            query += " AND is_hidden = false"
        rows = self.db.execute(text(query), {"id": coding_question_id}).mappings().all()
        return [dict(r) for r in rows]

    def create_coding_submission(self, user_id: str, coding_question_id: str, code: str, language: str, output: str, status: str, score: float) -> dict:
        new_id = str(uuid.uuid4())
        self.db.execute(
            text("""INSERT INTO coding_submissions
                     (id, user_id, coding_question_id, code, language, output, status, score, created_at)
                     VALUES (:id, :uid, :cqid, :code, :lang, :output, :status, :score, CURRENT_TIMESTAMP)"""),
            {
                "id": new_id, "uid": user_id, "cqid": coding_question_id, "code": code,
                "lang": language, "output": output, "status": status, "score": score,
            },
        )
        self.db.commit()
        row = self.db.execute(
            text("SELECT * FROM coding_submissions WHERE id = :id"), {"id": new_id}
        ).mappings().first()
        return dict(row)

    def save_code_review(self, coding_submission_id: str, review_text: str, quality_score: Optional[float] = None) -> CodeReview:
        review = CodeReview(
            coding_submission_id=coding_submission_id, review_text=review_text, quality_score=quality_score,
        )
        self.db.add(review)
        self.db.commit()
        self.db.refresh(review)
        return review
