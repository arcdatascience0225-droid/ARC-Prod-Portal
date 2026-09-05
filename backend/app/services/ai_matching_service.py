"""
Gemini-powered AI services:
1. Job <-> Student matching + ranking
2. Interview transcript analysis + objective scoring

All Gemini usage is logged into the shared `ai_usage` table (module='placement_matching'
or 'interview_analysis') so token/cost tracking stays consistent across phases.
"""
import json
import os
import re
from typing import Any, Dict, List, Optional
from uuid import UUID

import google.generativeai as genai
from sqlalchemy.orm import Session

from app.models.placement import Job

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-1.5-flash")

if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)


def _extract_json(text: str) -> Dict[str, Any]:
    """Gemini sometimes wraps JSON in markdown fences - strip them safely."""
    cleaned = re.sub(r"^```(json)?|```$", "", text.strip(), flags=re.MULTILINE).strip()
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", cleaned, re.DOTALL)
        if match:
            return json.loads(match.group(0))
        raise


class AIMatchingService:
    def __init__(self, db: Session):
        self.db = db
        self.model = genai.GenerativeModel(GEMINI_MODEL) if GEMINI_API_KEY else None

    def _log_usage(self, user_id: UUID, module: str, tokens_used: int, cost: float):
        from app.models.assessment import AiUsage  # local import to avoid circularity

        entry = AiUsage(
            user_id=user_id,
            module=module,
            tokens_used=tokens_used,
            cost=cost,
        )
        self.db.add(entry)
        self.db.commit()

    def match_student_to_job(
        self,
        job: Job,
        student_profile: Dict[str, Any],
        requesting_user_id: UUID,
    ) -> Dict[str, Any]:
        """
        Returns: {matchScore: float 0-100, reasoning: str, skillsMatched: [...], skillsMissing: [...]}
        student_profile example:
        {
          "name": str, "skills": [...], "avg_assessment_score": float,
          "completed_assessments": int, "coding_languages": [...],
          "recent_activity_summary": str
        }
        """
        if not self.model:
            return self._fallback_match(job, student_profile)

        prompt = f"""You are a technical recruiter AI. Score how well this candidate fits this job.

JOB REQUIREMENTS:
Title: {job.title}
Description: {job.description}
Required Skills: {job.required_skills}
Min Experience (years): {job.min_experience_years}
Min Assessment Score Required: {job.min_score_percent}%

CANDIDATE PROFILE:
Name: {student_profile.get('name')}
Skills: {student_profile.get('skills', [])}
Average Assessment Score: {student_profile.get('avg_assessment_score')}
Completed Assessments: {student_profile.get('completed_assessments')}
Coding Languages: {student_profile.get('coding_languages', [])}
Activity Summary: {student_profile.get('recent_activity_summary', 'N/A')}

Return ONLY valid JSON, no markdown, no preamble, in this exact shape:
{{
  "matchScore": <number 0-100>,
  "reasoning": "<2-3 sentence explanation>",
  "skillsMatched": ["skill1", "skill2"],
  "skillsMissing": ["skill3"]
}}"""

        try:
            response = self.model.generate_content(prompt)
            result = _extract_json(response.text)
            usage = getattr(response, "usage_metadata", None)
            tokens = usage.total_token_count if usage else 0
            self._log_usage(requesting_user_id, "placement_matching", tokens, tokens * 0.000001)
            return {
                "matchScore": float(result.get("matchScore", 0)),
                "reasoning": result.get("reasoning", ""),
                "skillsMatched": result.get("skillsMatched", []),
                "skillsMissing": result.get("skillsMissing", []),
            }
        except Exception:
            return self._fallback_match(job, student_profile)

    def _fallback_match(self, job: Job, student_profile: Dict[str, Any]) -> Dict[str, Any]:
        """Deterministic fallback if Gemini API key missing or call fails - keeps feature usable."""
        required = set(s.lower() for s in (job.required_skills or []))
        have = set(s.lower() for s in student_profile.get("skills", []))
        matched = sorted(required & have)
        missing = sorted(required - have)
        skill_ratio = (len(matched) / len(required)) if required else 1.0
        avg_score = student_profile.get("avg_assessment_score") or 0
        score_component = min(avg_score / max(job.min_score_percent, 1), 1.0) if job.min_score_percent else 1.0
        match_score = round((skill_ratio * 0.6 + score_component * 0.4) * 100, 1)
        reasoning = (
            f"Matched {len(matched)}/{len(required) or 1} required skills; "
            f"average assessment score {avg_score}."
        )
        return {
            "matchScore": match_score,
            "reasoning": reasoning,
            "skillsMatched": matched,
            "skillsMissing": missing,
        }

    def rank_candidates_for_job(
        self,
        job: Job,
        candidates: List[Dict[str, Any]],
        requesting_user_id: UUID,
    ) -> List[Dict[str, Any]]:
        results = []
        for c in candidates:
            match = self.match_student_to_job(job, c, requesting_user_id)
            results.append({**c, **match})
        results.sort(key=lambda r: r["matchScore"], reverse=True)
        return results

    def analyze_interview(
        self, transcript: str, job: Job, requesting_user_id: UUID
    ) -> Dict[str, Any]:
        """
        Returns: {score: float 0-100, strengths: [...], weaknesses: [...], summary: str}
        """
        if not self.model:
            return self._fallback_interview_analysis(transcript)

        prompt = f"""You are an unbiased technical interview evaluator AI.
Analyze this interview transcript for the role "{job.title}" and score the candidate objectively.

TRANSCRIPT:
{transcript[:8000]}

Return ONLY valid JSON, no markdown, in this exact shape:
{{
  "score": <number 0-100>,
  "strengths": ["point1", "point2"],
  "weaknesses": ["point1"],
  "summary": "<3-4 sentence objective summary>"
}}"""

        try:
            response = self.model.generate_content(prompt)
            result = _extract_json(response.text)
            usage = getattr(response, "usage_metadata", None)
            tokens = usage.total_token_count if usage else 0
            self._log_usage(requesting_user_id, "interview_analysis", tokens, tokens * 0.000001)
            return {
                "score": float(result.get("score", 0)),
                "strengths": result.get("strengths", []),
                "weaknesses": result.get("weaknesses", []),
                "summary": result.get("summary", ""),
            }
        except Exception:
            return self._fallback_interview_analysis(transcript)

    def _fallback_interview_analysis(self, transcript: str) -> Dict[str, Any]:
        word_count = len(transcript.split())
        score = min(90.0, max(40.0, word_count / 10))
        return {
            "score": round(score, 1),
            "strengths": ["Participated actively in the discussion"],
            "weaknesses": ["AI analysis unavailable - manual review recommended"],
            "summary": "Automated scoring unavailable (Gemini API not configured); "
            "fallback heuristic score generated from transcript length.",
        }
