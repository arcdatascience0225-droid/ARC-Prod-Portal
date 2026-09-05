import csv
import io
from typing import List, Dict
from uuid import UUID

from sqlalchemy.orm import Session

from app.models.placement import Application
from app.models.user import User


def export_applications_csv(applications: List[Application], db: Session) -> str:
    student_ids = {app.student_id for app in applications}
    students: Dict[UUID, User] = {
        u.id: u for u in db.query(User).filter(User.id.in_(student_ids)).all()
    } if student_ids else {}

    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(
        [
            "Application ID",
            "Student Name",
            "Student Email",
            "Job Title",
            "Company",
            "Match Score",
            "Status",
            "Applied At",
        ]
    )
    for app in applications:
        student = students.get(app.student_id)
        writer.writerow(
            [
                str(app.id),
                student.name if student else "",
                student.email if student else "",
                app.job.title if app.job else "",
                app.job.company.name if app.job and app.job.company else "",
                app.match_score or "",
                app.status,
                app.applied_at.isoformat() if app.applied_at else "",
            ]
        )
    return buffer.getvalue()
