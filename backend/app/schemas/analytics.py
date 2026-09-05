from typing import Optional, Any
from uuid import UUID
from pydantic import BaseModel


class StudentAnalyticsOut(BaseModel):
    userId: UUID
    assessmentsTaken: int
    averageScore: float
    codingSubmissions: int
    codingSuccessRate: float
    careerReadinessScore: float
    strengths: list[str]
    weaknesses: list[str]
    trend: list[dict[str, Any]]


class BatchAnalyticsOut(BaseModel):
    batchId: UUID
    batchName: str
    studentsCount: int
    averageScore: float
    attendanceRate: float
    completionRate: float


class FacultyAnalyticsOut(BaseModel):
    facultyId: UUID
    facultyName: str
    batchesHandled: int
    avgStudentScore: float


class PlacementAnalyticsOut(BaseModel):
    totalStudents: int
    placedStudents: int
    placementRate: float
    avgOffersPerStudent: float
    topHiringCompanies: list[dict[str, Any]]


class CourseAttendanceAnalyticsOut(BaseModel):
    courseId: UUID
    courseName: str
    avgAttendanceRate: float
    avgAssessmentScore: float
    totalBatches: int


class AIRevenueAnalyticsOut(BaseModel):
    totalAiCost: float
    totalTokens: int
    totalRevenue: float
    byModule: list[dict[str, Any]]
