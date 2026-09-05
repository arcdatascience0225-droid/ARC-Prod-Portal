from fastapi import HTTPException
from sqlalchemy.orm import Session
from app.repositories.analytics_repo import AnalyticsRepo


class AnalyticsService:
    def __init__(self, db: Session):
        self.db = db
        self.repo = AnalyticsRepo(db)

    def dashboard_summary(self, requester_id, is_admin: bool = False) -> dict:
        """Overview cards + per-batch progress bars for the non-student
        dashboard landing page. Admin sees every batch; faculty/trainer see
        only batches they're assigned to (faculty_id or trainer_id)."""
        from app.models.course import Batch, BatchStudent
        from app.models.assessment import Result

        query = self.db.query(Batch)
        if not is_admin:
            query = query.filter((Batch.faculty_id == requester_id) | (Batch.trainer_id == requester_id))
        batches = query.all()

        batch_rows = []
        all_scores = []
        total_students = 0
        for b in batches:
            student_ids = [
                row.user_id for row in self.db.query(BatchStudent).filter(BatchStudent.batch_id == b.id).all()
            ]
            total_students += len(student_ids)
            results = (
                self.db.query(Result).filter(Result.user_id.in_(student_ids)).all()
                if student_ids else []
            )
            scores = [r.score for r in results if r.score is not None]
            all_scores.extend(scores)
            completed = len({r.user_id for r in results if r.status == "completed"})
            completion_rate = round((completed / len(student_ids) * 100), 1) if student_ids else 0.0
            batch_rows.append({
                "batchId": str(b.id),
                "batchName": b.name,
                "studentsCount": len(student_ids),
                "averageScore": round(sum(scores) / len(scores), 1) if scores else None,
                "completionRate": completion_rate,
            })

        return {
            "totalBatches": len(batches),
            "totalStudents": total_students,
            "overallAverageScore": round(sum(all_scores) / len(all_scores), 1) if all_scores else None,
            "batches": batch_rows,
        }
        results = self.repo.student_results(user_id)
        submissions = self.repo.student_coding_submissions(user_id)
        scores = [r.score for r in results if r.score is not None]
        avg_score = sum(scores) / len(scores) if scores else 0.0
        passed = [s for s in submissions if getattr(s, "status", "") == "passed"]
        success_rate = (len(passed) / len(submissions) * 100) if submissions else 0.0
        career = self.repo.latest_career_score(user_id)
        trend = [
            {"date": r.submitted_at.isoformat() if r.submitted_at else None, "score": r.score}
            for r in sorted(results, key=lambda x: x.submitted_at or x.started_at)
        ]
        strengths, weaknesses = [], []
        if avg_score >= 75:
            strengths.append("Strong assessment performance")
        elif avg_score:
            weaknesses.append("Assessment scores need improvement")
        if success_rate >= 70:
            strengths.append("Good coding problem-solving")
        elif submissions:
            weaknesses.append("Coding accuracy needs work")
        return {
            "userId": user_id,
            "assessmentsTaken": len(results),
            "averageScore": round(avg_score, 2),
            "codingSubmissions": len(submissions),
            "codingSuccessRate": round(success_rate, 2),
            "careerReadinessScore": career.score if career else 0.0,
            "strengths": strengths,
            "weaknesses": weaknesses,
            "trend": trend,
        }

    def batch_analytics(self, batch_id):
        student_links = self.repo.batch_students(batch_id)
        user_ids = [s.user_id for s in student_links]
        results = self.repo.results_for_users(user_ids)
        scores = [r.score for r in results if r.score is not None]
        avg_score = sum(scores) / len(scores) if scores else 0.0
        return {
            "batchId": batch_id,
            "studentsCount": len(user_ids),
            "averageScore": round(avg_score, 2),
            "attendanceRate": 0.0,  # populate once attendance module tables are merged
            "completionRate": round((len(results) / len(user_ids) * 100), 2) if user_ids else 0.0,
        }

    def faculty_analytics(self, faculty_id):
        batches = self.repo.faculty_batches(faculty_id)
        all_students = []
        for b in batches:
            all_students += [s.user_id for s in self.repo.batch_students(b.id)]
        results = self.repo.results_for_users(all_students)
        scores = [r.score for r in results if r.score is not None]
        return {
            "facultyId": faculty_id,
            "batchesHandled": len(batches),
            "avgStudentScore": round(sum(scores) / len(scores), 2) if scores else 0.0,
        }

    def placement_analytics(self):
        stats = self.repo.placement_stats()
        if stats is None:
            return {
                "totalStudents": 0, "placedStudents": 0, "placementRate": 0.0,
                "avgOffersPerStudent": 0.0, "topHiringCompanies": [],
            }
        rate = (stats["placed"] / stats["total"] * 100) if stats["total"] else 0.0
        avg_offers = (stats["offers"] / stats["total"]) if stats["total"] else 0.0
        return {
            "totalStudents": stats["total"],
            "placedStudents": stats["placed"],
            "placementRate": round(rate, 2),
            "avgOffersPerStudent": round(avg_offers, 2),
            "topHiringCompanies": [{"company": c, "hires": h} for c, h in stats["top_companies"]],
        }

    def course_attendance_analytics(self):
        courses = self.repo.all_courses()
        batches = self.repo.all_batches()
        out = []
        for c in courses:
            c_batches = [b for b in batches if b.course_id == c.id]
            out.append({
                "courseId": c.id, "courseName": c.name,
                "avgAttendanceRate": 0.0, "avgAssessmentScore": 0.0,
                "totalBatches": len(c_batches),
            })
        return out

    def ai_revenue_analytics(self):
        rows = self.repo.ai_usage_summary()
        total_cost = sum(float(r.cost or 0) for r in rows)
        total_tokens = sum(int(r.tokens or 0) for r in rows)
        return {
            "totalAiCost": round(total_cost, 4),
            "totalTokens": total_tokens,
            "totalRevenue": 0.0,  # populate from payments once billing rules finalized
            "byModule": [{"module": r.module, "tokens": int(r.tokens or 0), "cost": float(r.cost or 0)} for r in rows],
        }

    def compute_career_readiness(self, user_id):
        analytics = self.student_analytics(user_id)
        score = round(
            (analytics["averageScore"] * 0.5) + (analytics["codingSuccessRate"] * 0.5), 2
        )
        breakdown = {
            "assessmentComponent": analytics["averageScore"],
            "codingComponent": analytics["codingSuccessRate"],
        }
        rec = self.repo.save_career_score(user_id, score, breakdown)
        return {"userId": user_id, "score": rec.score, "breakdown": rec.breakdown}
