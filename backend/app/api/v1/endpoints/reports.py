from uuid import UUID

from fastapi import APIRouter, Depends
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.api.deps import faculty_or_trainer, CurrentUser
from app.db.session import get_db
from app.services.report_service import ReportService

router = APIRouter(prefix="/reports", tags=["Reports"])


@router.get("/batch/{batch_id}/excel", summary="Export batch performance report as Excel (FAC-009)")
def export_excel(
    batch_id: UUID,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(faculty_or_trainer),
):
    content = ReportService(db).batch_report_excel(batch_id)
    return Response(
        content=content,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename=batch_{batch_id}_report.xlsx"},
    )


@router.get("/batch/{batch_id}/pdf", summary="Export batch performance report as PDF (FAC-009)")
def export_pdf(
    batch_id: UUID,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(faculty_or_trainer),
):
    content = ReportService(db).batch_report_pdf(batch_id)
    return Response(
        content=content,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=batch_{batch_id}_report.pdf"},
    )
