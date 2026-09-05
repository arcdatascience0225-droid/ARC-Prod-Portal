"""
Wrapper around Judge0 API for compiling/running student code against test cases.
"""
import asyncio
import base64
import httpx
from typing import Optional
from app.config import settings

LANGUAGE_MAP = {
    "python": 71,
    "python3": 71,
    "javascript": 63,
    "java": 62,
    "cpp": 54,
    "c": 50,
    "sql": 82,
    "typescript": 74,
}


class Judge0Client:
    def __init__(self):
        self.base_url = settings.JUDGE0_API_URL.rstrip("/")
        self.headers = {
            "Content-Type": "application/json",
        }
        if settings.JUDGE0_API_KEY:
            self.headers["X-RapidAPI-Key"] = settings.JUDGE0_API_KEY
            self.headers["X-RapidAPI-Host"] = settings.JUDGE0_API_HOST

    def _b64(self, s: Optional[str]) -> str:
        return base64.b64encode((s or "").encode()).decode()

    def _unb64(self, s: Optional[str]) -> str:
        if not s:
            return ""
        try:
            return base64.b64decode(s).decode(errors="replace")
        except Exception:
            return s

    async def run_submission(
        self, source_code: str, language: str, stdin: str = "", expected_output: Optional[str] = None,
        timeout: float = 20.0,
    ) -> dict:
        language_id = LANGUAGE_MAP.get(language.lower())
        if not language_id:
            raise ValueError(f"Unsupported language: {language}")

        url = f"{self.base_url}/submissions?base64_encoded=true&wait=true"
        payload = {
            "source_code": self._b64(source_code),
            "language_id": language_id,
            "stdin": self._b64(stdin),
        }
        if expected_output is not None:
            payload["expected_output"] = self._b64(expected_output)

        async with httpx.AsyncClient(timeout=timeout) as client:
            resp = await client.post(url, json=payload, headers=self.headers)
            resp.raise_for_status()
            data = resp.json()

        return {
            "stdout": self._unb64(data.get("stdout")),
            "stderr": self._unb64(data.get("stderr")),
            "compile_output": self._unb64(data.get("compile_output")),
            "status": data.get("status", {}).get("description", "Unknown"),
            "status_id": data.get("status", {}).get("id"),
            "time": data.get("time"),
            "memory": data.get("memory"),
        }

    async def run_batch(
        self, source_code: str, language: str, test_cases: list[dict],
    ) -> list[dict]:
        """test_cases: [{"id": str, "input": str, "expected_output": str, "is_hidden": bool}]"""
        results = []
        sem = asyncio.Semaphore(5)

        async def _run_one(tc: dict):
            async with sem:
                r = await self.run_submission(
                    source_code, language, stdin=tc["input"], expected_output=tc["expected_output"]
                )
                actual = (r["stdout"] or "").strip()
                expected = (tc["expected_output"] or "").strip()
                passed = r["status_id"] == 3 and actual == expected
                results.append({
                    "test_case_id": tc["id"],
                    "passed": passed,
                    "is_hidden": tc["is_hidden"],
                    "actual_output": None if tc["is_hidden"] else actual,
                    "expected_output": None if tc["is_hidden"] else expected,
                    "raw_status": r["status"],
                })

        await asyncio.gather(*(_run_one(tc) for tc in test_cases))
        # keep original order
        order = {tc["id"]: i for i, tc in enumerate(test_cases)}
        results.sort(key=lambda r: order[r["test_case_id"]])
        return results


judge0_client = Judge0Client()
