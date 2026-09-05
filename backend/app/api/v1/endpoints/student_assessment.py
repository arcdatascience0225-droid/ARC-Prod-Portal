import os
from fastapi import APIRouter, Depends, UploadFile, File, Form
from sqlalchemy.orm import Session

from app.database import get_db
from app.utils.auth import require_student, CurrentUser
from app.services.student_service import StudentService
from app.schemas import student_schemas as sc
from app.models.assessment import ProctorSnapshot, Result, CodingQuestion, TestCase, Question
from pydantic import BaseModel
from typing import Optional
from uuid import UUID

router = APIRouter(prefix="/api/v1/student/assessments", tags=["Student Assessment"])


@router.post("/{assessment_id}/start", response_model=sc.AssessmentAttemptOut)
async def start_assessment(
    assessment_id: str,
    current_user: CurrentUser = Depends(require_student),
    db: Session = Depends(get_db),
):
    return await StudentService(db).start_assessment(current_user.id, assessment_id)


@router.post("/{assessment_id}/answer", status_code=204)
async def save_answer(
    assessment_id: str,
    payload: sc.AnswerSubmit,
    current_user: CurrentUser = Depends(require_student),
    db: Session = Depends(get_db),
):
    StudentService(db).repo.upsert_student_answer(
        assessment_id, current_user.id,
        str(payload.question_id), payload.answer_text, payload.selected_option,
    )


@router.post("/submit", response_model=sc.AssessmentResultOut)
async def submit_assessment(
    payload: sc.AssessmentSubmit,
    current_user: CurrentUser = Depends(require_student),
    db: Session = Depends(get_db),
):
    return await StudentService(db).submit_assessment(current_user.id, payload)


@router.get("/available", response_model=list[sc.AvailableAssessmentOut])
async def available_assessments(
    current_user: CurrentUser = Depends(require_student),
    db: Session = Depends(get_db),
):
    """Assessments assigned to the student's batch, not yet submitted."""
    return StudentService(db).list_available_assessments(current_user.id)


@router.get("/history", response_model=list[sc.AssessmentHistoryItem])
def get_history(current_user: CurrentUser = Depends(require_student), db: Session = Depends(get_db)):
    return StudentService(db).get_assessment_history(current_user.id)


@router.get("/history/batches")
def get_history_batches(current_user: CurrentUser = Depends(require_student), db: Session = Depends(get_db)):
    """Batches the student is enrolled in — used by the Assessment History
    dashboard to show which batch(es) their results belong to."""
    return StudentService(db).get_batch_summary(current_user.id)


SNAPSHOT_DIR = os.environ.get("SNAPSHOT_DIR", "snapshots")


@router.post("/snapshot", status_code=204)
async def upload_snapshot(
    result_id: str = Form(...),
    image: UploadFile = File(...),
    violation_count: int = Form(0),
    current_user: CurrentUser = Depends(require_student),
    db: Session = Depends(get_db),
):
    """Receive a webcam frame from the exam page and persist it for review."""
    os.makedirs(SNAPSHOT_DIR, exist_ok=True)
    fname = f"{result_id}_{current_user.id}_{int(__import__('time').time())}.jpg"
    path = os.path.join(SNAPSHOT_DIR, fname)
    data = await image.read()
    with open(path, "wb") as f:
        f.write(data)

    result = db.query(Result).filter(Result.id == result_id).first()
    if result:
        result.violation_count = violation_count
        if violation_count >= 2:
            result.is_flagged = True
        # Lazy-import to avoid circular imports
        from app.models.assessment import Assessment
        assessment_id = result.assessment_id
        db.add(ProctorSnapshot(
            result_id=result_id, user_id=current_user.id,
            assessment_id=assessment_id, image_path=path,
            violation_count=violation_count,
        ))
        db.commit()


class TerminateRequest(BaseModel):
    result_id: str
    reason: str = "max_violations"

class HelpRequest(BaseModel):
    result_id: str
    message: str = ""


@router.post("/terminate", status_code=200)
def terminate_assessment(
    payload: TerminateRequest,
    current_user: CurrentUser = Depends(require_student),
    db: Session = Depends(get_db),
):
    """Called when MAX_VIOLATIONS is reached. Marks the result as terminated
    so the student cannot resume even on page reload."""
    result = db.query(Result).filter(
        Result.id == payload.result_id,
        Result.user_id == current_user.id,
    ).first()
    if not result:
        from fastapi import HTTPException
        raise HTTPException(404, "Result not found")
    result.is_terminated = True
    result.is_flagged = True
    result.termination_reason = payload.reason
    result.status = "terminated"
    db.commit()
    return {"status": "terminated"}


@router.post("/request-help", status_code=200)
def request_help(
    payload: HelpRequest,
    current_user: CurrentUser = Depends(require_student),
    db: Session = Depends(get_db),
):
    """Student on the terminated screen can send a help request to faculty/admin."""
    result = db.query(Result).filter(
        Result.id == payload.result_id,
        Result.user_id == current_user.id,
    ).first()
    if not result:
        from fastapi import HTTPException
        raise HTTPException(404, "Result not found")
    result.help_requested = True
    result.help_message = payload.message
    db.commit()
    return {"status": "help_requested"}


@router.get("/status/{result_id}")
def get_attempt_status(
    result_id: str,
    current_user: CurrentUser = Depends(require_student),
    db: Session = Depends(get_db),
):
    """Called on page load to check if this attempt is already terminated."""
    result = db.query(Result).filter(
        Result.id == result_id,
        Result.user_id == current_user.id,
    ).first()
    if not result:
        return {"status": "not_found"}
    return {
        "status": result.status,
        "isTerminated": bool(result.is_terminated),
        "isFlagged": bool(result.is_flagged),
        "violationCount": result.violation_count,
        "helpRequested": bool(result.help_requested),
    }


@router.get("/help-requests")
def list_help_requests(
    current_user: CurrentUser = Depends(require_student),
    db: Session = Depends(get_db),
):
    """Student's own pending help requests."""
    from app.models.user import User
    from app.models.assessment import Assessment
    rows = (
        db.query(Result)
        .filter(Result.user_id == current_user.id, Result.help_requested == True)
        .all()
    )
    return [
        {
            "resultId": str(r.id),
            "assessmentId": str(r.assessment_id),
            "status": r.status,
            "helpMessage": r.help_message,
            "violationCount": r.violation_count,
        }
        for r in rows
    ]


class CodeRunRequest(BaseModel):
    code: str
    language: str = "python"
    stdin: str = ""
    questionId: Optional[UUID] = None


# Piston API language aliases (only used as a fallback for non-Python languages)
PISTON_LANGUAGES = {
    "python": "python", "python3": "python",
    "javascript": "javascript", "js": "javascript",
    "java": "java",
    "cpp": "c++", "c++": "c++",
    "c": "c",
    "sql": "sqlite3",
    "typescript": "typescript",
    "go": "go",
    "rust": "rust",
    "ruby": "ruby",
}


@router.post("/run-code")
async def run_code(
    payload: CodeRunRequest,
    current_user: CurrentUser = Depends(require_student),
    db: Session = Depends(get_db),
):
    """Execute code. Python runs locally (free, no rate limits). If a
    questionId is given and it has stored test cases, all test cases are
    run and returned alongside the plain stdin run so the student can see
    pass/fail immediately."""
    lang = payload.language.lower()

    if lang == "sql":
        from app.utils.local_sql_runner import run_sql, run_sql_test_cases
        from starlette.concurrency import run_in_threadpool

        schema_sql = ""
        cq = None
        if payload.questionId:
            cq = db.query(CodingQuestion).filter(CodingQuestion.question_id == payload.questionId).first()
            if cq:
                question = db.query(Question).filter(Question.id == payload.questionId).first()
                if question and question.data:
                    schema_sql = question.data.get("schemaSql") or ""

        r = await run_in_threadpool(run_sql, schema_sql, payload.code)
        result = {
            "status": "Time Limit Exceeded" if r.timed_out else ("Accepted" if not r.error else "Runtime Error"),
            "stdout": r.as_text(), "stderr": r.error or "",
            "compile_output": "", "exit_code": 0 if not r.error else 1,
        }

        if cq:
            test_cases = db.query(TestCase).filter(TestCase.coding_question_id == cq.id).all()
            if test_cases:
                tc_payload = [
                    {"id": str(tc.id), "input": tc.input, "expected_output": tc.expected_output,
                     "is_hidden": tc.is_hidden}
                    for tc in test_cases
                ]
                tc_results = await run_in_threadpool(run_sql_test_cases, schema_sql, payload.code, tc_payload)
                result["testResults"] = tc_results
                result["testsPassed"] = sum(1 for t in tc_results if t["passed"])
                result["testsTotal"] = len(tc_results)

        return result

    if lang in ("python", "python3"):
        from app.utils.local_python_runner import run_python, run_test_cases
        from starlette.concurrency import run_in_threadpool

        # run_python/run_test_cases block on subprocess.run(), which would
        # otherwise freeze the whole event loop (and every other student's
        # requests, since Render's free tier runs a single worker) for the
        # full duration of one student's code execution.
        r = await run_in_threadpool(run_python, payload.code, payload.stdin or "")
        status = "Time Limit Exceeded" if r.timed_out else (
            "Accepted" if r.exit_code == 0 and not r.stderr else "Runtime Error"
        )
        result = {
            "status": status, "stdout": r.stdout, "stderr": r.stderr,
            "compile_output": "", "exit_code": r.exit_code,
        }

        if payload.questionId:
            cq = db.query(CodingQuestion).filter(CodingQuestion.question_id == payload.questionId).first()
            if cq:
                test_cases = db.query(TestCase).filter(TestCase.coding_question_id == cq.id).all()
                if test_cases:
                    tc_payload = [
                        {"id": str(tc.id), "input": tc.input, "expected_output": tc.expected_output,
                         "is_hidden": tc.is_hidden}
                        for tc in test_cases
                    ]
                    tc_results = await run_in_threadpool(run_test_cases, payload.code, tc_payload)
                    result["testResults"] = tc_results
                    result["testsPassed"] = sum(1 for t in tc_results if t["passed"])
                    result["testsTotal"] = len(tc_results)

        return result

    # Non-Python: fall back to the free public Piston API
    import httpx
    piston_lang = PISTON_LANGUAGES.get(lang, lang)

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                "https://emkc.org/api/v2/piston/execute",
                json={
                    "language": piston_lang,
                    "version": "*",
                    "files": [{"content": payload.code}],
                    "stdin": payload.stdin or "",
                },
            )
            resp.raise_for_status()
            data = resp.json()

        run = data.get("run", {})
        compile_info = data.get("compile", {})

        stdout = run.get("stdout") or ""
        stderr = run.get("stderr") or ""
        compile_out = compile_info.get("stderr") or compile_info.get("stdout") or ""
        exit_code = run.get("code", 0)

        if exit_code == 0 and not stderr:
            status = "Accepted"
        elif compile_out:
            status = "Compilation Error"
        else:
            status = "Runtime Error" if stderr else "Accepted"

        return {
            "status": status,
            "stdout": stdout,
            "stderr": stderr,
            "compile_output": compile_out,
            "time": run.get("cpu_time"),
            "memory": run.get("memory"),
            "exit_code": exit_code,
        }

    except httpx.TimeoutException:
        return {"status": "Time Limit Exceeded", "stdout": "", "stderr": "Code took too long to execute (30s limit).", "compile_output": ""}
    except httpx.HTTPStatusError as e:
        if e.response.status_code in (401, 429):
            return {
                "status": "error", "stdout": "", "compile_output": "",
                "stderr": "The code execution service is temporarily rate-limited. Please wait a minute and try again.",
            }
        return {"status": "error", "stdout": "", "stderr": f"Execution service error: {str(e)}", "compile_output": ""}
    except Exception as e:
        return {"status": "error", "stdout": "", "stderr": f"Execution service error: {str(e)}", "compile_output": ""}
