"""Compatibility shim so phase5-style
`from app.models.phase5_models import Notification, NotificationRecipient, Batch, BatchStudent, Course, CareerReadinessScore, ...`
imports keep working against the canonical model definitions."""
from app.models.admin_platform import (  # noqa: F401
    AuditLog,
    Notification,
    NotificationRecipient,
    Course,
    Batch,
    BatchStudent,
    Payment,
    PlatformSetting,
    CareerReadinessScore,
    Resume,
    StudyPlan,
)
from app.models.course import BatchFaculty  # noqa: F401
