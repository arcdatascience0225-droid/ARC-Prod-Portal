"""Cross-database column types.

The models were originally written against PostgreSQL-only types
(dialects.postgresql.UUID / JSONB / ARRAY). Those don't compile on SQLite,
which is useful for quick local dev without a Postgres server. This module
provides drop-in replacements that behave correctly on both:

- GUID: stores a native UUID on Postgres, a dashed 36-char string on
  SQLite/other backends - either way, Python code always sees a
  `uuid.UUID`. The dashed format (not compact 32-char hex) matters here:
  a couple of repositories (e.g. student_repository.py) run raw SQL that
  writes UUIDs as plain `str(uuid.uuid4())` (dashed) into foreign-key
  columns referencing ORM-managed tables like `users`/`assessments`. Under
  SQLite (plain TEXT storage, no native UUID normalization like Postgres
  has), the ORM-managed and raw-SQL-managed columns MUST use the same
  string format or foreign-key lookups/joins between them will silently
  return zero rows.
- JSONType: Postgres JSONB features (indexing/operators) aren't used
  anywhere in this codebase, so plain `sqlalchemy.JSON` is a safe drop-in
  that works identically on both backends for our read/write-a-dict usage.
- StringArray: stores a Python list of strings as JSON on both backends
  (Postgres ARRAY has no SQLite equivalent; nothing here uses PG's
  array-specific SQL operators, only Python-level list values).
"""
import uuid

from sqlalchemy.types import CHAR, JSON, TypeDecorator, TypeEngine
from sqlalchemy.dialects.postgresql import UUID as PG_UUID


class GUID(TypeDecorator):
    """Platform-independent UUID column.

    Uses PostgreSQL's native UUID type when the target dialect is
    'postgresql', otherwise stores as a dashed CHAR(36) string (standard
    `str(uuid.UUID(...))` format) - matches what raw SQL elsewhere in this
    codebase writes via plain `str(uuid.uuid4())`, so ORM tables and
    raw-SQL tables stay joinable under SQLite.
    """

    impl = CHAR
    cache_ok = True

    def load_dialect_impl(self, dialect):
        if dialect.name == "postgresql":
            return dialect.type_descriptor(PG_UUID(as_uuid=True))
        return dialect.type_descriptor(CHAR(36))

    def process_bind_param(self, value, dialect):
        if value is None:
            return value
        if dialect.name == "postgresql":
            return str(value)
        if not isinstance(value, uuid.UUID):
            value = uuid.UUID(str(value))
        return str(value)

    def process_result_value(self, value, dialect):
        if value is None:
            return value
        if isinstance(value, uuid.UUID):
            return value
        return uuid.UUID(value)


def UUID(as_uuid: bool = True) -> TypeEngine:  # noqa: N802 - matches postgresql.UUID's call signature
    """Drop-in replacement for `sqlalchemy.dialects.postgresql.UUID(as_uuid=True)`
    so model files didn't need a call-site rewrite, only an import-site swap."""
    return GUID()


# JSONB -> plain JSON (works identically on Postgres + SQLite for our usage)
JSONB = JSON

# ARRAY(String) -> JSON-backed list (works on both backends)
def ARRAY(item_type=None) -> TypeEngine:  # noqa: N802 - matches postgresql.ARRAY's call signature
    return JSON()
