from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.utils.auth import require_student, CurrentUser
from app.services.student_service import StudentService
from app.schemas import student_schemas as sc

router = APIRouter(prefix="/api/v1/student/profile", tags=["Student Profile"])


@router.get("", response_model=sc.StudentProfileOut)
def get_profile(current_user: CurrentUser = Depends(require_student), db: Session = Depends(get_db)):
    """STU-PR-001: Get personal info/skills/links."""
    return StudentService(db).get_profile(current_user.id)


@router.put("", response_model=sc.StudentProfileOut)
def update_profile(
    payload: sc.StudentProfileUpdate,
    current_user: CurrentUser = Depends(require_student),
    db: Session = Depends(get_db),
):
    """STU-PR-002: Update personal info/skills/resume/portfolio links."""
    return StudentService(db).update_profile(current_user.id, payload)


@router.get("/certificates", response_model=list[sc.CertificateOut])
def list_certificates(current_user: CurrentUser = Depends(require_student), db: Session = Depends(get_db)):
    """STU-PR-003: List certificates."""
    return StudentService(db).list_certificates(current_user.id)


@router.post("/certificates", response_model=sc.CertificateOut, status_code=201)
def add_certificate(
    payload: sc.CertificateCreate,
    current_user: CurrentUser = Depends(require_student),
    db: Session = Depends(get_db),
):
    """STU-PR-004: Add a certificate (upload flow handled client-side via Azure Blob, URL stored here)."""
    return StudentService(db).add_certificate(current_user.id, payload)


@router.put("/certificates/{cert_id}", response_model=sc.CertificateOut)
def update_certificate(
    cert_id: str,
    payload: sc.CertificateCreate,
    current_user: CurrentUser = Depends(require_student),
    db: Session = Depends(get_db),
):
    """Edit an existing certificate (title/issuer/date/URL)."""
    return StudentService(db).update_certificate(current_user.id, cert_id, payload)


@router.delete("/certificates/{cert_id}", status_code=204)
def delete_certificate(
    cert_id: str,
    current_user: CurrentUser = Depends(require_student),
    db: Session = Depends(get_db),
):
    StudentService(db).delete_certificate(current_user.id, cert_id)
