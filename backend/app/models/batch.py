"""Compatibility shim so phase3-style
`from app.models.batch import Batch, BatchStudent, BatchFaculty`
imports keep working against the canonical model definitions.
NOTE: BatchStudent uses `user_id` (not `student_id`) as the FK column name."""
from app.models.course import Batch, BatchStudent, BatchFaculty  # noqa: F401
