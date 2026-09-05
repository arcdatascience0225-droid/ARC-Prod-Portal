import enum


class RoleEnum(str, enum.Enum):
    SUPER_ADMIN = "super_admin"
    ADMIN = "admin"
    FACULTY = "faculty"
    TRAINER = "trainer"
    HR = "hr"
    PLACEMENT_COORDINATOR = "placement_coordinator"
    COUNSELLOR = "counsellor"
    MANAGER = "manager"
    STUDENT = "student"
    GUEST = "guest"


class RegistrationSourceEnum(str, enum.Enum):
    STAFF = "staff"
    SELF_INVITE = "self_invite"
    BULK_UPLOAD = "bulk_upload"


class InviteStatusEnum(str, enum.Enum):
    PENDING = "pending"
    USED = "used"
    EXPIRED = "expired"
    REVOKED = "revoked"


class BulkJobStatusEnum(str, enum.Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class DocumentTypeEnum(str, enum.Enum):
    PHOTO = "photo"
    ID_PROOF = "id_proof"
    MARKSHEET = "marksheet"
    CERTIFICATE = "certificate"
    OTHER = "other"
