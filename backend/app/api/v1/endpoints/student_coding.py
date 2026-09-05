from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.utils.auth import require_student, CurrentUser
from app.services.student_service import StudentService
from app.schemas import student_schemas as sc

router = APIRouter(prefix="/api/v1/student/coding", tags=["Student Coding Lab"])


@router.get("", response_model=list[sc.CodingQuestionListItem])
def list_coding_questions(
    current_user: CurrentUser = Depends(require_student),
    db: Session = Depends(get_db),
):
    """Coding questions available to browse/practice — the Coding Lab
    landing page (no specific question ID in the URL) shows this list so
    students can pick one, instead of the page getting stuck on 'Loading'
    forever with nothing to fetch."""
    return StudentService(db).list_coding_questions()


@router.get("/{coding_question_id}", response_model=sc.CodingQuestionOut)
def get_coding_question(
    coding_question_id: str,
    current_user: CurrentUser = Depends(require_student),
    db: Session = Depends(get_db),
):
    """STU-AS-005: Fetch coding question + starter code + visible sample test cases."""
    return StudentService(db).get_coding_question_out(coding_question_id)


@router.post("/run", response_model=sc.CodeRunResult)
async def run_code(
    payload: sc.CodeRunRequest,
    current_user: CurrentUser = Depends(require_student),
    db: Session = Depends(get_db),
):
    """STU-AS-005: Run code against custom/sample input via Judge0 (no scoring, quick feedback loop)."""
    return await StudentService(db).run_code(current_user.id, payload)


@router.post("/submit", response_model=sc.CodeSubmitResult)
async def submit_code(
    payload: sc.CodeSubmitRequest,
    current_user: CurrentUser = Depends(require_student),
    db: Session = Depends(get_db),
):
    """STU-AS-005: Submit code -> run against all (incl. hidden) test cases -> score + AI review."""
    return await StudentService(db).submit_code(current_user.id, payload)
