"""
Business / Service Layer. Orchestrates repository calls, AI calls (Gemini),
code execution (Judge0), and applies business rules. No direct SQL here.
"""
from datetime import datetime, timezone
from typing import Optional
from fastapi import HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.repositories.student_repository import StudentRepository
from app.services.ai_provider import get_ai_client
from app.utils.judge0_client import judge0_client
from app.schemas import student_schemas as sc

GEMINI_COST_PER_1K_TOKENS = 0.0005  # illustrative; move to config if needed


def _assessment_dict_is_currently_active(assessment: dict) -> bool:
    """Same logic as Assessment.is_currently_active(), but for the plain
    dict that StudentRepository.get_assessment() returns (raw SQL row),
    since that dict has no model methods."""
    if not assessment.get("is_active"):
        return False
    now = datetime.utcnow()
    active_from = assessment.get("active_from")
    active_until = assessment.get("active_until")
    if active_from and now < active_from.replace(tzinfo=None):
        return False
    if active_until and now > active_until.replace(tzinfo=None):
        return False
    return True


# --------------------------------------------------------------------------
# MCQ option handling
#
# The `data` blob has been written by several producers (AI generation, the
# faculty question form, seed data) using different key casings, so read every
# variant rather than assuming one. Crucially, `_visible_options` returns ONLY
# the choices: the previous code passed the whole `data` blob to the student,
# which shipped `correctOption` to the browser where anyone could read it in
# DevTools.
# --------------------------------------------------------------------------
_CHOICE_KEYS = ("choices", "options")
_ANSWER_KEYS = ("correctOption", "correct_option", "answer", "correctAnswer", "correct_answer")


def _question_data(q: dict) -> dict:
    data = q.get("data") or q.get("options")
    return data if isinstance(data, dict) else {}


def _visible_options(q: dict):
    """The choice list to render, with the correct answer stripped out."""
    if str(q.get("type")) != "mcq":
        return None
    data = _question_data(q)
    for key in _CHOICE_KEYS:
        choices = data.get(key)
        if isinstance(choices, list) and choices:
            return [str(c) for c in choices]
    return None


def _correct_option(q: dict):
    data = _question_data(q)
    for key in _ANSWER_KEYS:
        if data.get(key) not in (None, ""):
            return data[key]
    return None


class StudentService:
    def __init__(self, db: Session):
        self.db = db
        self.repo = StudentRepository(db)

    # ---------- Dashboard ----------
    def get_dashboard(self, user_id: str) -> sc.DashboardResponse:
        user = self.repo.get_user(user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        progress = self.repo.get_progress_percent(user_id)
        attendance = self.repo.get_attendance_percent(user_id)
        upcoming = self.repo.get_upcoming_assessments(user_id)
        notifications = self.repo.get_recent_notifications(user_id)

        return sc.DashboardResponse(
            welcome_name=user["name"],
            progress_percent=progress,
            attendance_percent=attendance,
            upcoming_assessments=[
                sc.UpcomingAssessment(id=u["id"], title=u["title"], type=u["type"], duration=u["duration"])
                for u in upcoming
            ],
            recent_notifications=[sc.NotificationOut.model_validate(n) for n in notifications],
        )

    # ---------- Profile ----------
    def get_profile(self, user_id: str) -> sc.StudentProfileOut:
        out = sc.StudentProfileOut.model_validate(self.repo.get_or_create_profile(user_id))

        from app.models.course import BatchStudent, Batch, Course
        from app.models.user import User

        link = self.db.query(BatchStudent).filter(BatchStudent.user_id == user_id).first()
        if link:
            batch = self.db.query(Batch).filter(Batch.id == link.batch_id).first()
            if batch:
                out.batch_name = batch.name
                if batch.course_id:
                    course = self.db.query(Course).filter(Course.id == batch.course_id).first()
                    out.course_name = course.name if course else None
                faculty_id = batch.faculty_id or batch.trainer_id
                if faculty_id:
                    faculty = self.db.query(User).filter(User.id == faculty_id).first()
                    out.faculty_name = faculty.name if faculty else None

        out.course_progress = self.repo.get_progress_percent(user_id)

        history = self.get_assessment_history(user_id)
        percentiles = [h.percentile for h in history if h.percentile is not None]
        out.average_percentile = round(sum(percentiles) / len(percentiles), 1) if percentiles else None

        return out

    def update_profile(self, user_id: str, payload: sc.StudentProfileUpdate) -> sc.StudentProfileOut:
        data = payload.model_dump(exclude_unset=True, by_alias=False)
        updated = self.repo.update_profile(user_id, data)
        return sc.StudentProfileOut.model_validate(updated)

    def list_certificates(self, user_id: str) -> list[sc.CertificateOut]:
        return [sc.CertificateOut.model_validate(c) for c in self.repo.list_certificates(user_id)]

    def add_certificate(self, user_id: str, payload: sc.CertificateCreate) -> sc.CertificateOut:
        cert = self.repo.add_certificate(user_id, payload.model_dump(by_alias=False))
        return sc.CertificateOut.model_validate(cert)

    def update_certificate(self, user_id: str, cert_id: str, payload: sc.CertificateCreate) -> sc.CertificateOut:
        cert = self.repo.update_certificate(cert_id, user_id, payload.model_dump(by_alias=False, exclude_unset=True))
        if not cert:
            raise HTTPException(status_code=404, detail="Certificate not found")
        return sc.CertificateOut.model_validate(cert)

    def delete_certificate(self, user_id: str, cert_id: str) -> None:
        ok = self.repo.delete_certificate(cert_id, user_id)
        if not ok:
            raise HTTPException(status_code=404, detail="Certificate not found")

    # ---------- Learning ----------
    def get_syllabus(self, user_id: str) -> list[sc.SyllabusItemOut]:
        return [sc.SyllabusItemOut.model_validate(i) for i in self.repo.list_syllabus_with_progress(user_id)]

    def update_syllabus_progress(self, user_id: str, syllabus_item_id: str, status: str) -> sc.SyllabusItemOut:
        if status not in ("pending", "in_progress", "completed"):
            raise HTTPException(status_code=400, detail="Invalid status")
        prog = self.repo.mark_syllabus_status(user_id, syllabus_item_id, status)
        return sc.SyllabusItemOut(
            id=syllabus_item_id, title="", description=None, module=None, order_index=0, status=prog.status,
        )

    def list_lectures(self, syllabus_item_id: Optional[str]) -> list[sc.LectureOut]:
        return [sc.LectureOut.model_validate(l) for l in self.repo.list_lectures(syllabus_item_id)]

    def list_assignments(self, user_id: str) -> list[sc.AssignmentOut]:
        return [sc.AssignmentOut.model_validate(a) for a in self.repo.list_assignments_for_student(user_id)]

    def submit_assignment(self, user_id: str, payload: sc.AssignmentSubmissionCreate) -> sc.AssignmentSubmissionOut:
        if payload.submission_type == "repo_link" and not payload.repo_link:
            raise HTTPException(status_code=400, detail="repo_link is required for submission_type=repo_link")
        if payload.submission_type in ("document", "archive", "notebook") and not payload.file_url:
            raise HTTPException(status_code=400, detail="file_url is required for this submission_type")

        data = payload.model_dump(exclude={"assignment_id"}, by_alias=False)
        sub = self.repo.create_submission(user_id, {**data, "assignment_id": payload.assignment_id})
        return sc.AssignmentSubmissionOut.model_validate(sub)

    def list_practice_questions(self, topic: Optional[str], difficulty: Optional[str]) -> list[sc.PracticeQuestionOut]:
        return [sc.PracticeQuestionOut.model_validate(q) for q in self.repo.list_practice_questions(topic, difficulty)]

    def get_daily_challenge(self, user_id: str) -> sc.DailyChallengeOut:
        today = datetime.now(timezone.utc)
        challenge = self.repo.get_today_challenge(today)
        if not challenge:
            raise HTTPException(status_code=404, detail="No daily challenge configured for today")
        from app.models.student_extras import PracticeQuestion
        pq_obj = self.db.query(PracticeQuestion).get(challenge.practice_question_id)
        attempt = self.repo.get_challenge_attempt(user_id, str(challenge.id))
        return sc.DailyChallengeOut(
            id=challenge.id,
            challenge_date=challenge.challenge_date,
            question=sc.PracticeQuestionOut.model_validate(pq_obj),
            already_attempted=attempt is not None,
        )

    def submit_daily_challenge(self, user_id: str, challenge_id: str, answer_text: str) -> dict:
        from app.models.student_extras import DailyChallenge, PracticeQuestion
        challenge = self.db.query(DailyChallenge).get(challenge_id)
        if not challenge:
            raise HTTPException(status_code=404, detail="Challenge not found")
        if self.repo.get_challenge_attempt(user_id, challenge_id):
            raise HTTPException(status_code=409, detail="Already attempted today's challenge")

        pq = self.db.query(PracticeQuestion).get(challenge.practice_question_id)
        correct_answer = (pq.data or {}).get("correct_answer") if pq.data else None
        is_correct = (
            correct_answer is not None
            and answer_text.strip().lower() == str(correct_answer).strip().lower()
        )
        self.repo.create_challenge_attempt(user_id, challenge_id, answer_text, is_correct)
        return {"is_correct": is_correct}

    # ---------- Assessment ----------
    async def start_assessment(self, user_id: str, assessment_id: str) -> sc.AssessmentAttemptOut:
        assessment = self.repo.get_assessment(assessment_id)
        if not assessment:
            raise HTTPException(status_code=404, detail="Assessment not found")

        existing = self.repo.get_existing_in_progress_result(assessment_id, user_id)
        if not existing and not _assessment_dict_is_currently_active(assessment):
            raise HTTPException(
                status_code=403,
                detail="This assessment is not currently active. Contact your faculty.",
            )

        # Security: check if student already has a terminated/completed result
        # They cannot restart — even on reload, back button, or new tab
        from app.models.assessment import Result as ResultModel
        blocked = self.db.query(ResultModel).filter(
            ResultModel.assessment_id == assessment_id,
            ResultModel.user_id == user_id,
            ResultModel.status.in_(["terminated", "completed"]),
        ).first()
        if blocked:
            status = str(blocked.status)
            from fastapi import HTTPException
            raise HTTPException(
                status_code=403,
                detail={
                    "code": status,
                    "is_terminated": bool(blocked.is_terminated),
                    "result_id": str(blocked.id),
                    "message": (
                        "This assessment has been terminated due to security violations."
                        if status == "terminated"
                        else "You have already submitted this assessment."
                    ),
                },
            )
        result = existing or self.repo.create_result(assessment_id, user_id)

        questions = self.repo.get_questions_for_assessment(assessment_id)

        # For coding/SQL questions, fetch the visible (non-hidden) test
        # cases so the student can see the exact I/O contract (or, for SQL,
        # the schema + expected result) before writing their answer.
        sample_tests_by_qid: dict = {}
        code_or_sql_qids = [q["id"] for q in questions if q["type"] in ("coding", "sql")]
        if code_or_sql_qids:
            from app.models.assessment import CodingQuestion, TestCase
            cqs = self.db.query(CodingQuestion).filter(CodingQuestion.question_id.in_(code_or_sql_qids)).all()
            cq_by_question_id = {str(cq.question_id): cq.id for cq in cqs}
            if cq_by_question_id:
                tests = self.db.query(TestCase).filter(
                    TestCase.coding_question_id.in_(cq_by_question_id.values()),
                    TestCase.is_hidden.is_(False),
                ).all()
                cq_id_to_question_id = {v: k for k, v in cq_by_question_id.items()}
                for t in tests:
                    qid = cq_id_to_question_id.get(t.coding_question_id)
                    if qid:
                        sample_tests_by_qid.setdefault(qid, []).append(
                            sc.TestCaseOut(id=t.id, input=t.input, expected_output=t.expected_output, is_hidden=t.is_hidden)
                        )

        return sc.AssessmentAttemptOut(
            result_id=result["id"],
            assessment_id=assessment_id,
            title=assessment["title"],
            duration=assessment["duration"],
            started_at=result["started_at"],
            questions=[
                sc.QuestionForAttempt(
                    id=q["id"], question_text=q["question_text"], type=q["type"],
                    options=_visible_options(q), marks=q["marks"],
                    sample_test_cases=sample_tests_by_qid.get(str(q["id"])) or None,
                )
                for q in questions
            ],
        )

    def save_answer(self, user_id: str, assessment_id: str, answer: sc.AnswerSubmit):
        self.repo.upsert_student_answer(
            assessment_id, user_id, str(answer.question_id), answer.answer_text, answer.selected_option,
        )

    async def submit_assessment(self, user_id: str, payload: sc.AssessmentSubmit) -> sc.AssessmentResultOut:
        result = self.repo.get_result(str(payload.result_id))
        if not result or str(result["user_id"]) != str(user_id):
            raise HTTPException(status_code=404, detail="Result not found")
        if result["status"] == "completed":
            raise HTTPException(status_code=409, detail="Assessment already submitted")

        assessment_id = str(result["assessment_id"])

        # persist any final answers not yet saved (auto-submit safety net)
        for ans in payload.answers:
            self.repo.upsert_student_answer(
                assessment_id, user_id, str(ans.question_id), ans.answer_text, ans.selected_option,
            )

        questions = {q["id"]: q for q in self.repo.get_questions_for_assessment(assessment_id)}
        student_answers = self.repo.get_student_answers(assessment_id, user_id)

        total_score = 0.0
        max_score = sum(float(q["marks"]) for q in questions.values())
        feedback_parts = []
        total_tokens = 0

        for ans in student_answers:
            q = questions.get(ans["question_id"])
            if not q:
                continue
            if q["type"] == "mcq":
                correct = _correct_option(q)
                given = (ans.get("selected_option") or "").strip()
                score = float(q["marks"]) if correct and given == str(correct).strip() else 0.0
                total_score += score
            else:
                # subjective / coding / sql / stats / ml / nlp -> AI evaluation
                correct_ref = (q.get("data") or {}).get("reference_answer")
                try:
                    ai_client = get_ai_client()
                    score, feedback, tokens = await ai_client.evaluate_answer(
                        question_text=q["question_text"],
                        question_type=q["type"],
                        correct_answer=correct_ref,
                        student_answer=ans.get("answer_text") or "",
                        max_marks=float(q["marks"]),
                    )
                except Exception as _ai_err:
                    # AI evaluation failed - award 0, keep going.
                    score, feedback, tokens = 0.0, f"Auto-evaluation unavailable ({type(_ai_err).__name__})", 0
                total_score += score
                total_tokens += tokens
                if feedback:
                    feedback_parts.append(f"Q: {q['question_text'][:60]}... -> {feedback}")

        if total_tokens:
            self.repo.save_ai_usage(
                user_id, "assessment_evaluation", total_tokens,
                round(total_tokens / 1000 * GEMINI_COST_PER_1K_TOKENS, 6),
            )

        self.repo.finalize_result(str(payload.result_id), total_score, "completed")
        rank, percentile = self.repo.compute_rank_and_percentile(assessment_id, user_id, total_score)

        return sc.AssessmentResultOut(
            result_id=payload.result_id,
            assessment_id=assessment_id,
            score=total_score,
            max_score=max_score,
            status="completed",
            percentile=percentile,
            rank=rank,
            ai_feedback=" | ".join(feedback_parts) if feedback_parts else None,
            submitted_at=datetime.utcnow(),
        )


    def list_available_assessments(self, user_id: str) -> list:
        from app.repositories.batch_repository import BatchRepository
        from app.repositories.assessment_repository import AssessmentRepository
        batch_ids = BatchRepository(self.db).batch_ids_for_student(user_id)
        all_a = AssessmentRepository(self.db).list_for_student(batch_ids)
        # Exclude both completed AND terminated assessments from the available list
        completed_ids = {
            str(r["assessment_id"])
            for r in self.repo.list_assessment_history(user_id)
            if r["status"] in ("completed", "terminated")
        }
        out = []
        for a in all_a:
            if str(a.id) in completed_ids:
                continue
            if not a.is_currently_active():
                continue
            qids = a.question_ids if isinstance(a.question_ids, list) else []
            out.append({
                "id": a.id, "title": a.title, "description": a.description,
                "type": a.type, "duration": a.duration,
                "question_count": len(qids), "batch_name": None,
            })
        return out

    def get_assessment_history(self, user_id: str) -> list[sc.AssessmentHistoryItem]:
        rows = self.repo.list_assessment_history(user_id)
        from app.models.assessment import Question, Assessment as AssessmentModel
        out = []
        for r in rows:
            rank, percentile = (None, None)
            if r["status"] == "completed":
                rank, percentile = self.repo.compute_rank_and_percentile(str(r["assessment_id"]), user_id, r["score"])

            max_score = None
            try:
                assessment = self.db.query(AssessmentModel).filter(AssessmentModel.id == r["assessment_id"]).first()
                if assessment:
                    inline_qs = self.db.query(Question).filter(Question.assessment_id == r["assessment_id"]).all()
                    bank_ids = [qid for qid in (assessment.question_ids or []) if str(qid) not in {str(q.id) for q in inline_qs}]
                    bank_qs = self.db.query(Question).filter(Question.id.in_(bank_ids)).all() if bank_ids else []
                    all_qs = inline_qs + bank_qs
                    if all_qs:
                        max_score = sum(q.marks for q in all_qs)
            except Exception:
                pass

            out.append(sc.AssessmentHistoryItem(
                result_id=r["result_id"], assessment_title=r["assessment_title"], type=r["type"],
                score=r["score"], max_score=max_score, status=r["status"], percentile=percentile, rank=rank,
                submitted_at=r["submitted_at"],
            ))
        return out

    def get_batch_summary(self, user_id: str) -> list[dict]:
        """Batches the student is enrolled in — shown on the Assessment
        History dashboard alongside overall stats."""
        from app.models.course import BatchStudent, Batch
        rows = (
            self.db.query(Batch)
            .join(BatchStudent, BatchStudent.batch_id == Batch.id)
            .filter(BatchStudent.user_id == user_id)
            .all()
        )
        return [{"id": str(b.id), "name": b.name} for b in rows]

    # ---------- Coding Lab ----------
    async def run_code(self, user_id: str, payload: sc.CodeRunRequest) -> sc.CodeRunResult:
        cq = self.repo.get_coding_question(str(payload.coding_question_id))
        if not cq:
            raise HTTPException(status_code=404, detail="Coding question not found")

        stdin = payload.custom_input or ""
        result = await judge0_client.run_submission(payload.code, payload.language, stdin=stdin)
        return sc.CodeRunResult(
            stdout=result["stdout"], stderr=result["stderr"] or result["compile_output"],
            status=result["status"], time=result["time"], memory=result["memory"],
        )

    async def submit_code(self, user_id: str, payload: sc.CodeSubmitRequest) -> sc.CodeSubmitResult:
        cq = self.repo.get_coding_question(str(payload.coding_question_id))
        if not cq:
            raise HTTPException(status_code=404, detail="Coding question not found")

        test_cases = self.repo.get_test_cases(str(payload.coding_question_id), include_hidden=True)
        if not test_cases:
            raise HTTPException(status_code=400, detail="No test cases configured for this question")

        results = await judge0_client.run_batch(payload.code, payload.language, test_cases)
        passed = sum(1 for r in results if r["passed"])
        total = len(results)
        score = round((passed / total) * float(cq["marks"]), 2) if total else 0.0
        status = "accepted" if passed == total else ("partial" if passed > 0 else "failed")

        submission = self.repo.create_coding_submission(
            user_id=user_id,
            coding_question_id=str(payload.coding_question_id),
            code=payload.code,
            language=payload.language,
            output=f"{passed}/{total} test cases passed",
            status=status,
            score=score,
        )

        test_summary = f"{passed}/{total} test cases passed, status={status}"
        ai_review, tokens = await gemini_client.review_code(
            question_text=cq["question_text"], language=payload.language,
            code=payload.code, test_summary=test_summary,
        )
        if tokens:
            self.repo.save_ai_usage(
                user_id, "code_review", tokens, round(tokens / 1000 * GEMINI_COST_PER_1K_TOKENS, 6),
            )
        self.repo.save_code_review(submission["id"], ai_review)

        return sc.CodeSubmitResult(
            submission_id=submission["id"], status=status, score=score,
            total_test_cases=total, passed_test_cases=passed,
            test_case_results=[
                sc.TestCaseResult(
                    test_case_id=r["test_case_id"], passed=r["passed"], is_hidden=r["is_hidden"],
                    actual_output=r["actual_output"], expected_output=r["expected_output"],
                )
                for r in results
            ],
            ai_review=ai_review,
        )

    def list_coding_questions(self) -> list[sc.CodingQuestionListItem]:
        rows = self.db.execute(text(
            """SELECT cq.id, q.question_text, cq.language, q.marks
               FROM coding_questions cq JOIN questions q ON q.id = cq.question_id
               ORDER BY cq.created_at DESC"""
        )).mappings().all()
        return [sc.CodingQuestionListItem.model_validate(dict(r)) for r in rows]

    def get_coding_question_out(self, coding_question_id: str) -> sc.CodingQuestionOut:
        cq = self.repo.get_coding_question(coding_question_id)
        if not cq:
            raise HTTPException(status_code=404, detail="Coding question not found")
        visible_tests = self.repo.get_test_cases(coding_question_id, include_hidden=False)
        return sc.CodingQuestionOut(
            id=cq["id"], question_id=cq["question_id"], question_text=cq["question_text"],
            starter_code=cq["starter_code"], language=cq["language"], marks=cq["marks"],
            sample_test_cases=[sc.TestCaseOut.model_validate(t) for t in visible_tests],
        )
