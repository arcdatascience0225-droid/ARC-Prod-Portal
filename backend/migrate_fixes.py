"""One-off, idempotent migration for the bug-fix round.

Run once against an EXISTING database:

    python migrate_fixes.py

A brand-new database created by `python create_tables.py` already has
everything below and does not need this script (running it anyway is a
harmless no-op).

What it does
------------
1. Adds `chat_history.faculty_id` and `chat_history.student_id`.
   The faculty<->student thread used to be identified by `user_id` alone,
   which mixed different students' threads together AND pulled in both
   parties' private AI-assistant history (the same table backs both).
   Pre-existing rows are left with NULL thread columns, i.e. treated as
   AI-assistant history, because there is no reliable way to work out which
   student an old faculty message was addressed to.

2. Backfills `batch_students` from `student_profiles.batch_id`.
   Registration only ever wrote `student_profiles.batch_id` and never
   created the `batch_students` row that every batch-scoped feature reads
   (faculty rosters, attendance, performance, reports, announcement
   delivery), so students registered before this fix were assigned to a
   batch on paper and invisible everywhere else.

Uses stdlib sqlite3 only, so it runs without the app's dependencies
installed. For PostgreSQL, use Alembic instead - the same two changes.
"""
import os
import sqlite3
import sys
import uuid
from datetime import datetime, timezone

DB_PATH = os.environ.get("PLATFORM_DB", os.path.join(os.path.dirname(__file__), "platform.db"))


def column_exists(cur, table: str, column: str) -> bool:
    cur.execute(f"PRAGMA table_info({table})")
    return any(row[1] == column for row in cur.fetchall())


def table_exists(cur, table: str) -> bool:
    cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name=?", (table,))
    return cur.fetchone() is not None


def add_chat_thread_columns(cur) -> list[str]:
    notes = []
    if not table_exists(cur, "chat_history"):
        return ["chat_history table not present - skipped (run create_tables.py)"]
    for col in ("faculty_id", "student_id"):
        if column_exists(cur, "chat_history", col):
            notes.append(f"chat_history.{col} already present")
            continue
        # CHAR(36) matches app.core.db_types.GUID's SQLite storage format
        # (dashed str(uuid.UUID)), so these join correctly against users.id.
        cur.execute(f"ALTER TABLE chat_history ADD COLUMN {col} CHAR(36)")
        notes.append(f"added chat_history.{col}")
    cur.execute("CREATE INDEX IF NOT EXISTS ix_chat_history_faculty_id ON chat_history(faculty_id)")
    cur.execute("CREATE INDEX IF NOT EXISTS ix_chat_history_student_id ON chat_history(student_id)")
    notes.append("ensured indexes on chat_history(faculty_id, student_id)")
    return notes


def backfill_batch_students(cur) -> list[str]:
    if not (table_exists(cur, "student_profiles") and table_exists(cur, "batch_students")):
        return ["student_profiles / batch_students not present - skipped"]

    cur.execute(
        """
        SELECT sp.user_id, sp.batch_id
        FROM student_profiles sp
        JOIN batches b ON b.id = sp.batch_id
        WHERE sp.batch_id IS NOT NULL
          AND NOT EXISTS (
              SELECT 1 FROM batch_students bs
              WHERE bs.user_id = sp.user_id AND bs.batch_id = sp.batch_id
          )
        """
    )
    rows = cur.fetchall()
    if not rows:
        return ["batch_students: nothing to backfill"]

    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S.%f")
    for user_id, batch_id in rows:
        cur.execute(
            "INSERT INTO batch_students (id, batch_id, user_id, created_at, updated_at) "
            "VALUES (?, ?, ?, ?, ?)",
            (str(uuid.uuid4()), batch_id, user_id, now, now),
        )
    return [f"batch_students: enrolled {len(rows)} previously-orphaned student(s)"]




def migrate_assessment_features(cur) -> list[str]:
    notes = []
    # assessments.is_active
    if not column_exists(cur, "assessments", "is_active"):
        cur.execute("ALTER TABLE assessments ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1")
        notes.append("added assessments.is_active")
    # results.violation_count / is_flagged
    for col, defval in [("violation_count", "0"), ("is_flagged", "0")]:
        if not column_exists(cur, "results", col):
            cur.execute(f"ALTER TABLE results ADD COLUMN {col} INTEGER NOT NULL DEFAULT {defval}")
            notes.append(f"added results.{col}")
    # proctor_snapshots table
    cur.execute("""CREATE TABLE IF NOT EXISTS proctor_snapshots (
        id CHAR(36) PRIMARY KEY,
        result_id CHAR(36) NOT NULL,
        user_id CHAR(36) NOT NULL,
        assessment_id CHAR(36) NOT NULL,
        image_path TEXT NOT NULL,
        violation_count INTEGER NOT NULL DEFAULT 0,
        captured_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )""")
    cur.execute("CREATE INDEX IF NOT EXISTS ix_snap_result ON proctor_snapshots(result_id)")
    cur.execute("CREATE INDEX IF NOT EXISTS ix_snap_user ON proctor_snapshots(user_id)")
    notes.append("ensured proctor_snapshots table")
    # jobs.target_batch_ids
    if not column_exists(cur, "jobs", "target_batch_ids"):
        cur.execute("ALTER TABLE jobs ADD COLUMN target_batch_ids TEXT DEFAULT NULL")
        notes.append("added jobs.target_batch_ids")
    return notes



def migrate_student_answers(cur) -> list[str]:
    """student_answers was created with result_id/answer_data columns only,
    but the repository queries assessment_id/user_id/answer_text/selected_option."""
    notes = []
    for col, typ in [
        ("assessment_id", "CHAR(36)"),
        ("user_id", "CHAR(36)"),
        ("answer_text", "TEXT"),
        ("selected_option", "TEXT"),
    ]:
        cur.execute(f"PRAGMA table_info(student_answers)")
        if not any(r[1] == col for r in cur.fetchall()):
            cur.execute(f"ALTER TABLE student_answers ADD COLUMN {col} {typ}")
            notes.append(f"added student_answers.{col}")
        else:
            notes.append(f"student_answers.{col} already present")
    cur.execute("CREATE INDEX IF NOT EXISTS ix_sa_assess_user ON student_answers(assessment_id, user_id)")
    return notes



def migrate_termination_fields(cur) -> list[str]:
    notes = []
    for col, typ, default in [
        ("is_terminated", "INTEGER", "0"),
        ("termination_reason", "TEXT", "NULL"),
        ("help_requested", "INTEGER", "0"),
        ("help_message", "TEXT", "NULL"),
    ]:
        cur.execute("PRAGMA table_info(results)")
        if not any(r[1] == col for r in cur.fetchall()):
            if default == "NULL":
                cur.execute(f"ALTER TABLE results ADD COLUMN {col} {typ}")
            else:
                cur.execute(f"ALTER TABLE results ADD COLUMN {col} {typ} NOT NULL DEFAULT {default}")
            notes.append(f"added results.{col}")
        else:
            notes.append(f"results.{col} already present")
    return notes

def main() -> int:
    if not os.path.exists(DB_PATH):
        print(f"No database at {DB_PATH}. Nothing to migrate - run `python create_tables.py` first.")
        return 0

    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    try:
        cur.execute("PRAGMA foreign_keys=ON")
        notes = add_chat_thread_columns(cur) + backfill_batch_students(cur) + migrate_assessment_features(cur) + migrate_student_answers(cur) + migrate_termination_fields(cur)
        conn.commit()
    except Exception as exc:
        conn.rollback()
        print(f"Migration FAILED, rolled back: {exc}", file=sys.stderr)
        return 1
    finally:
        conn.close()

    print(f"Migration complete against {DB_PATH}:")
    for n in notes:
        print(f"  - {n}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
