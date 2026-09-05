"""Import every model module so `Base.metadata` (used by `create_tables.py`
and Alembic autogenerate) knows about every table in the platform, and so
that string-based `relationship()` references resolve correctly."""
from app.models.user import User  # noqa: F401
from app.models.course import Course, Batch, BatchStudent, BatchFaculty  # noqa: F401
from app.models.registration import (  # noqa: F401
    StudentProfile,
    Document,
    RegistrationInvite,
    BulkUploadJob,
    SignInLog,
)
from app.models.assessment import (  # noqa: F401
    Question,
    Assessment,
    Result,
    StudentAnswer,
    CodingQuestion,
    TestCase,
    CodingSubmission,
    AIUsage,
    ChatHistory,
)
from app.models.student_extras import (  # noqa: F401
    StudentCertificate,
    Syllabus,
    SyllabusProgress,
    Lecture,
    Assignment,
    AssignmentSubmission,
    PracticeQuestion,
    DailyChallenge,
    DailyChallengeAttempt,
    CodeReview,
)
from app.models.attendance import Attendance  # noqa: F401
from app.models.staff_attendance import StaffAttendance  # noqa: F401
from app.models.announcement import Announcement, AnnouncementBatch  # noqa: F401
from app.models.assignment_feedback import AssignmentFeedback  # noqa: F401
from app.models.mock_interview import (  # noqa: F401
    MockInterview,
    MockInterviewQnA,
    MockInterviewEvaluation,
)
from app.models.placement import Company, Job, Application, Interview, Offer  # noqa: F401
from app.models.lead import Lead  # noqa: F401
from app.models.fee_structure import FeeStructure, FeeInstallment  # noqa: F401
from app.models.admin_platform import (  # noqa: F401
    AuditLog,
    Notification,
    NotificationRecipient,
    Payment,
    PlatformSetting,
    CareerReadinessScore,
    Resume,
    StudyPlan,
)
