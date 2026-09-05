import io
from uuid import UUID

from openpyxl import Workbook
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet
from sqlalchemy.orm import Session

from app.services.performance_service import PerformanceService


class ReportService:
    def __init__(self, db: Session):
        self.db = db
        self.performance_service = PerformanceService(db)

    def batch_report_excel(self, batch_id: UUID) -> bytes:
        rows = self.performance_service.student_rows_for_batch(batch_id)
        wb = Workbook()
        ws = wb.active
        ws.title = "Batch Performance"
        ws.append(["Student Name", "Assessments Taken", "Average Score", "Highest Score", "Lowest Score"])
        for r in rows:
            ws.append([r.studentName, r.assessmentsTaken, r.averageScore, r.highestScore, r.lowestScore])

        buffer = io.BytesIO()
        wb.save(buffer)
        return buffer.getvalue()

    def batch_report_pdf(self, batch_id: UUID) -> bytes:
        analytics = self.performance_service.batch_analytics(batch_id)
        rows = self.performance_service.student_rows_for_batch(batch_id)

        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=A4)
        styles = getSampleStyleSheet()
        elements = [
            Paragraph(f"Batch Report: {analytics.batchName}", styles["Title"]),
            Spacer(1, 12),
            Paragraph(f"Total Students: {analytics.totalStudents} | Average Score: {analytics.averageScore}", styles["Normal"]),
            Spacer(1, 16),
        ]

        table_data = [["Student", "Assessments", "Avg Score", "Highest", "Lowest"]]
        for r in rows:
            table_data.append([r.studentName, r.assessmentsTaken, r.averageScore, r.highestScore, r.lowestScore])

        table = Table(table_data, hAlign="LEFT")
        table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1f2937")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
            ("FONTSIZE", (0, 0), (-1, -1), 9),
        ]))
        elements.append(table)
        doc.build(elements)
        return buffer.getvalue()
