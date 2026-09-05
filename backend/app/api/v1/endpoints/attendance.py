from datetime import date
from uuid import UUID
from typing import List

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import faculty_or_trainer, require_roles, CurrentUser
from app.db.session import get_db
from app.schemas.attendance import AttendanceMarkRequest, AttendanceOut, AttendanceFaceRecognitionHook
from app.services.attendance_service import AttendanceService

router = APIRouter(prefix="/attendance", tags=["Attendance"])


@router.post("", response_model=List[AttendanceOut], summary="Mark/update attendance for a batch (FAC-002)")
def mark_attendance(
    payload: AttendanceMarkRequest,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(faculty_or_trainer),
):
    return AttendanceService(db).mark_attendance(payload, marked_by=current_user.id)


@router.get("/batch/{batch_id}", response_model=List[AttendanceOut],
            summary="Review attendance for a batch on a date (FAC-002)")
def get_batch_attendance(
    batch_id: UUID,
    for_date: date,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(faculty_or_trainer),
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
    current_user: CurrentUser = Depends(faculty_or_trainer),
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
    payload: dict,  # {"staffId": str, "date": "YYYY-MM-DD", "status": "present"|"absent"|"late"}
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(require_roles(*STAFF_ATTENDANCE_ROLES)),
):
    from datetime import date as date_cls
    from app.models.staff_attendance import StaffAttendance

    staff_id = payload.get("staffId")
    entry_date = date_cls.fromisoformat(payload.get("date"))
    status = payload.get("status", "present")

    existing = db.query(StaffAttendance).filter(
        StaffAttendance.staff_id == staff_id, StaffAttendance.date == entry_date,
    ).first()
    if existing:
        existing.status = status
        existing.marked_by = current_user.id
    else:
        db.add(StaffAttendance(staff_id=staff_id, date=entry_date, status=status, marked_by=current_user.id))
    db.commit()
    return {"status": "ok"}


@router.get("/staff", summary="Manager: view faculty/trainer attendance for a date")
def get_staff_attendance(
    for_date: date,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(require_roles(*STAFF_ATTENDANCE_ROLES)),
):
    from app.models.staff_attendance import StaffAttendance
    from app.models.user import User
    rows = (
        db.query(StaffAttendance, User)
        .join(User, User.id == StaffAttendance.staff_id)
        .filter(StaffAttendance.date == for_date)
        .all()
    )
    return [{"staffId": str(sa.staff_id), "name": u.name, "status": sa.status} for sa, u in rows]


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
