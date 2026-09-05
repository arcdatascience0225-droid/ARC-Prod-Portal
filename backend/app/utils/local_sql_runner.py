"""
Runs student-submitted SQL locally via Python's built-in sqlite3 module — no
external API (Piston), so it is always free and never rate-limited or
subject to "Failed to fetch" from a flaky third-party service.

A SQL question stores its schema/seed-data as `schema_sql` (CREATE TABLE +
INSERT statements) on the question. We build a fresh in-memory SQLite
database, run that schema, then run the student's query against it and
return the resulting rows.
"""
import sqlite3
import threading


class SqlRunResult:
    def __init__(self, columns: list[str], rows: list[tuple], error: str | None, timed_out: bool = False):
        self.columns = columns
        self.rows = rows
        self.error = error
        self.timed_out = timed_out

    def as_text(self) -> str:
        """Render as a simple pipe-separated table: header row, then one
        data row per line. Matches the format AI-generated expectedOutput
        uses, so comparison in run_sql_test_cases lines up."""
        if self.error:
            return ""
        if not self.columns:
            return "(query executed, no result set)"
        lines = [" | ".join(str(c) for c in self.columns)]
        for r in self.rows:
            lines.append(" | ".join(str(v) for v in r))
        return "\n".join(lines)


def run_sql(schema_sql: str, query: str, timeout_seconds: float = 8.0) -> SqlRunResult:
    """Run `query` against a fresh in-memory DB seeded with `schema_sql`.
    A thread + timer enforces the timeout, since sqlite3 has no native
    per-statement timeout for a runaway query."""
    result_holder: dict = {}

    def _work():
        conn = sqlite3.connect(":memory:")
        try:
            cur = conn.cursor()
            if schema_sql:
                cur.executescript(schema_sql)
            cur.execute(query)
            if cur.description:
                columns = [d[0] for d in cur.description]
                rows = cur.fetchmany(500)  # cap result size shown back to the student
            else:
                columns, rows = [], []
            conn.commit()
            result_holder["result"] = SqlRunResult(columns, rows, None)
        except Exception as e:
            result_holder["result"] = SqlRunResult([], [], str(e))
        finally:
            conn.close()

    t = threading.Thread(target=_work, daemon=True)
    t.start()
    t.join(timeout_seconds)
    if t.is_alive():
        return SqlRunResult([], [], "Query took too long to execute.", timed_out=True)
    return result_holder.get("result", SqlRunResult([], [], "Unknown execution error."))


def _normalize(text: str) -> str:
    """Collapse repeated whitespace and strip each line, so minor spacing
    differences between the AI-authored expected output and this runner's
    own rendering don't cause a false failure."""
    return "\n".join(" ".join(line.split()) for line in text.strip().splitlines())


def run_sql_test_cases(schema_sql: str, query: str, test_cases: list[dict], timeout_seconds: float = 8.0) -> list[dict]:
    """A SQL question typically has ONE schema + expected result (not
    per-test-case stdin like a Python question) — but to stay consistent
    with the existing test-case UI, each test_case's `expected_output` is
    compared against the query's rendered result table (whitespace-normalized)."""
    out = []
    r = run_sql(schema_sql, query, timeout_seconds)
    actual = r.as_text() if not r.error else None
    for tc in test_cases:
        expected = (tc.get("expected_output") or "").strip()
        passed = (
            not r.error and actual is not None
            and _normalize(actual) == _normalize(expected)
        )
        out.append({
            "test_case_id": tc.get("id"),
            "passed": passed,
            "is_hidden": tc.get("is_hidden", False),
            "actual_output": actual if not tc.get("is_hidden") else (actual if passed else None),
            "expected_output": expected if not tc.get("is_hidden") else None,
            "error": r.error,
        })
    return out
