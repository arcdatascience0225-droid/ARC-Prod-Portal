"""
Runs student-submitted Python code locally via subprocess — no external API
(Piston/Judge0), so it is always free and never rate-limited. Only Python is
supported; this is intentional since all AI-generated coding questions in
this platform target Python.
"""
import subprocess
import sys
import tempfile
import os


class LocalRunResult:
    def __init__(self, stdout: str, stderr: str, timed_out: bool, exit_code: int):
        self.stdout = stdout
        self.stderr = stderr
        self.timed_out = timed_out
        self.exit_code = exit_code


def run_python(code: str, stdin: str = "", timeout_seconds: float = 8.0) -> LocalRunResult:
    """Execute `code` in a fresh subprocess, feeding `stdin`, capturing stdout/stderr."""
    with tempfile.NamedTemporaryFile(mode="w", suffix=".py", delete=False) as f:
        f.write(code)
        path = f.name

    try:
        proc = subprocess.run(
            [sys.executable, path],
            input=stdin,
            capture_output=True,
            text=True,
            timeout=timeout_seconds,
        )
        return LocalRunResult(
            stdout=proc.stdout or "",
            stderr=proc.stderr or "",
            timed_out=False,
            exit_code=proc.returncode,
        )
    except subprocess.TimeoutExpired as e:
        return LocalRunResult(
            stdout=(e.stdout or "") if isinstance(e.stdout, str) else "",
            stderr=f"Code took too long to execute ({timeout_seconds}s limit).",
            timed_out=True,
            exit_code=-1,
        )
    finally:
        try:
            os.unlink(path)
        except OSError:
            pass


def run_test_cases(code: str, test_cases: list[dict], timeout_seconds: float = 8.0) -> list[dict]:
    """test_cases: [{"id": str, "input": str, "expected_output": str, "is_hidden": bool}]"""
    results = []
    for tc in test_cases:
        r = run_python(code, stdin=tc.get("input") or "", timeout_seconds=timeout_seconds)
        actual = (r.stdout or "").strip()
        expected = (tc.get("expected_output") or "").strip()
        passed = (not r.timed_out) and r.exit_code == 0 and actual == expected
        results.append({
            "test_case_id": tc["id"],
            "passed": passed,
            "is_hidden": tc.get("is_hidden", False),
            "actual_output": None if tc.get("is_hidden") else actual,
            "expected_output": None if tc.get("is_hidden") else expected,
            "error": r.stderr if (r.stderr and not passed) else None,
        })
    return results
