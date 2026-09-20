from datetime import date
from uuid import UUID
from typing import List

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import faculty_or_trainer, attendance_marker, require_roles, CurrentUser
from app.utils.auth import require_student, CurrentUser as StudentCurrentUser
from app.db.session import get_db
from app.schemas.attendance import AttendanceMarkRequest, AttendanceOut, AttendanceFaceRecognitionHook
from app.services.attendance_service import AttendanceService

router = APIRouter(prefix="/attendance", tags=["Attendance"])


@router.get("/me", response_model=List[AttendanceOut], summary="My own attendance history (student)")
def get_my_attendance(
    current_user: StudentCurrentUser = Depends(require_student),
    db: Session = Depends(get_db),
):
    return AttendanceService(db).get_student_history(current_user.id)


@router.post("", response_model=List[AttendanceOut], summary="Mark/update attendance for a batch (FAC-002)")
def mark_attendance(
    payload: AttendanceMarkRequest,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(attendance_marker),
):
    return AttendanceService(db).mark_attendance(payload, marked_by=current_user.id)


@router.get("/batch/{batch_id}", response_model=List[AttendanceOut],
            summary="Review attendance for a batch on a date (FAC-002)")
def get_batch_attendance(
    batch_id: UUID,
    for_date: date,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(attendance_marker),
):
    return AttendanceService(db).get_batch_attendance(batch_id, for_date)


@router.get("/student/{student_id}", response_model=List[AttendanceOut],
            summary="Attendance history for a student (FAC-002)")
def get_student_attendance(
    student_id: UUID,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(faculty_or_trainer),
):
    return AttendanceService(db).get_student_history(student_id)


@router.get("/report", summary="Attendance report table: batch/date-range/name filters")
def attendance_report(
    batch_id: UUID | None = None,
    start_date: date | None = None,
    end_date: date | None = None,
    student_name: str | None = None,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(attendance_marker),
):
    return AttendanceService(db).attendance_report(batch_id, start_date, end_date, student_name)


@router.get("/student/{student_id}/full-detail", summary="Full student detail for the Attendance drill-down")
def student_full_detail(
    student_id: UUID,
    batch_id: UUID | None = None,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(faculty_or_trainer),
):
    return AttendanceService(db).student_full_detail(student_id, batch_id)


STAFF_ATTENDANCE_ROLES = ("manager", "super_admin")


@router.get("/staff-list", summary="Faculty/trainer list for the staff-attendance picker")
def staff_list(
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(require_roles(*STAFF_ATTENDANCE_ROLES)),
):
    from app.models.user import User
    users = db.query(User).filter(User.role.in_(["faculty", "trainer"])).order_by(User.name).all()
    return [{"id": str(u.id), "name": u.name, "email": u.email} for u in users]


@router.post("/staff", summary="Manager: mark a faculty/trainer's attendance for a date")
def mark_staff_attendance(
    payload: dict,  # {"staffId": str, "date": "YYYY-MM-DD", "status": "present"|"absent"|"late", "reason": str | null}
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(require_roles(*STAFF_ATTENDANCE_ROLES)),
):
    from datetime import date as date_cls
    from app.models.staff_attendance import StaffAttendance, StaffAttendanceNote

    staff_id = payload.get("staffId")
    entry_date = date_cls.fromisoformat(payload.get("date"))
    status = payload.get("status", "present")
    reason = payload.get("reason")

    existing = db.query(StaffAttendance).filter(
        StaffAttendance.staff_id == staff_id, StaffAttendance.date == entry_date,
    ).first()
    if existing:
        existing.status = status
        existing.marked_by = current_user.id
        record = existing
    else:
        record = StaffAttendance(staff_id=staff_id, date=entry_date, status=status, marked_by=current_user.id)
        db.add(record)
    db.commit()
    db.refresh(record)

    note = db.query(StaffAttendanceNote).filter(StaffAttendanceNote.staff_attendance_id == record.id).first()
    if reason:
        if note:
            note.reason = reason
        else:
            db.add(StaffAttendanceNote(staff_attendance_id=record.id, reason=reason))
        db.commit()
    elif note and status == "present":
        db.delete(note)
        db.commit()
    return {"status": "ok"}


@router.get("/staff", summary="Manager: view faculty/trainer attendance for a date")
def get_staff_attendance(
    for_date: date,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(require_roles(*STAFF_ATTENDANCE_ROLES)),
):
    from app.models.staff_attendance import StaffAttendance, StaffAttendanceNote
    from app.models.user import User
    rows = (
        db.query(StaffAttendance, User)
        .join(User, User.id == StaffAttendance.staff_id)
        .filter(StaffAttendance.date == for_date)
        .all()
    )
    out = []
    for sa, u in rows:
        note = db.query(StaffAttendanceNote).filter(StaffAttendanceNote.staff_attendance_id == sa.id).first()
        out.append({"staffId": str(sa.staff_id), "name": u.name, "status": sa.status, "reason": note.reason if note else None})
    return out


@router.post("/face-recognition-hook", summary="Placeholder hook to trigger face-recognition attendance (FAC-002)")
async def face_recognition_hook(
    payload: AttendanceFaceRecognitionHook,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(faculty_or_trainer),
):
    """
    Forwards to the separately-built face recognition service (see AIRA
    project) and returns whatever it detects. Actual face-matching model is
    NOT implemented in this phase - this is a structural placeholder only.
    """
    return await AttendanceService(db).trigger_face_recognition(payload)


@router.get("/holidays", summary="List holidays (optionally scoped to one batch)")
def list_holidays(
    batch_id: UUID | None = None,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(attendance_marker),
):
    return AttendanceService(db).list_holidays(batch_id)


@router.post("/holidays", summary="Mark a day as a holiday")
def add_holiday(
    payload: dict,  # {"date": "YYYY-MM-DD", "label": "...", "batchId": str | null}
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(attendance_marker),
):
    from fastapi import HTTPException
    label = (payload.get("label") or "").strip()
    if not label or not payload.get("date"):
        raise HTTPException(status_code=400, detail="date and label are required")
    return AttendanceService(db).add_holiday(
        date.fromisoformat(payload["date"]), label, payload.get("batchId"), current_user.id,
    )


@router.delete("/holidays/{holiday_id}", status_code=204, summary="Remove a holiday")
def remove_holiday(
    holiday_id: UUID,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(attendance_marker),
):
    AttendanceService(db).remove_holiday(holiday_id)


@router.get("/month-grid", summary="Spreadsheet-style month view: every student x every marked date")
def month_grid(
    batch_id: UUID,
    year: int,
    month: int,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(attendance_marker),
):
    return AttendanceService(db).month_grid(batch_id, year, month)


@router.get("/student/{student_id}/breakdown", summary="Month-by-month breakdown + full absence list for a student")
def student_breakdown(
    student_id: UUID,
    batch_id: UUID | None = None,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(attendance_marker),
):
    return AttendanceService(db).student_attendance_breakdown(student_id, batch_id)


@router.get("/student/{student_id}/on-date", summary="Was this student present/absent/late on a specific date?")
def student_on_date(
    student_id: UUID,
    on_date: date,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(attendance_marker),
):
    return AttendanceService(db).student_on_date(student_id, on_date)


@router.get("/staff/{staff_id}/on-date", summary="Was this faculty/trainer present/absent/late on a specific date?")
def staff_on_date(
    staff_id: UUID,
    on_date: date,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(require_roles(*STAFF_ATTENDANCE_ROLES)),
):
    return AttendanceService(db).staff_on_date(staff_id, on_date)


@router.get("/staff/{staff_id}/breakdown", summary="Month-by-month breakdown + full absence list for a faculty/trainer")
def staff_breakdown(
    staff_id: UUID,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(require_roles(*STAFF_ATTENDANCE_ROLES)),
):
    return AttendanceService(db).staff_attendance_breakdown(staff_id)


@router.get("/analytics", summary="Attendance analytics for dashboard charts (bar/pie/line)")
def attendance_analytics(
    batch_id: UUID | None = None,
    days: int = 30,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(attendance_marker),
):
    return AttendanceService(db).analytics(batch_id, days)
