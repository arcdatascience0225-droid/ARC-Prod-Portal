import React, { useEffect, useState } from "react";
import { hrApi } from "../../api/placementApi";
import { CandidateMatch, Application } from "../../types/placement";
import MatchScoreBadge from "../../components/MatchScoreBadge";
import StatusBadge from "../../components/StatusBadge";

export default function CandidateMatchPage({ jobId }: { jobId: string }) {
  const [matches, setMatches] = useState<CandidateMatch[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadApplications = async () => {
    try {
      const apps = await hrApi.listJobApplications(jobId);
      setApplications(apps);
    } catch (e: any) {
      setError(e.message);
    }
  };

  useEffect(() => {
    loadApplications();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId]);

  const runMatch = async () => {
    setLoading(true);
    setError("");
    try {
      const result = await hrApi.matchCandidates(jobId);
      setMatches(result.matches);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (appId: string, status: string) => {
    await hrApi.updateApplicationStatus(appId, status);
    loadApplications();
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Candidate Ranking (AI Match)</h1>
        <button
          onClick={runMatch}
          disabled={loading}
          className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium"
        >
          {loading ? (<span className="inline-flex items-center gap-2"><span className="w-3.5 h-3.5 border-2 border-white/70 border-t-transparent rounded-full animate-spin" /> Running AI Match…</span>) : "Run AI Candidate Match"}
        </button>
      </div>

      {error && <div className="mb-4 text-red-600 text-sm">{error}</div>}

      {matches.length > 0 && (
        <div className="mb-8">
          <h2 className="font-semibold text-gray-800 mb-3">Ranked Candidates (Gemini-scored)</h2>
          <div className="space-y-3">
            {matches.map((m) => (
              <div key={m.studentId} className="border border-gray-200 rounded-xl p-4 bg-white shadow-sm">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-medium text-gray-900">{m.studentName}</h3>
                    <p className="text-xs text-gray-500">{m.studentEmail}</p>
                  </div>
                  <MatchScoreBadge score={m.matchScore} />
                </div>
                <p className="text-sm text-gray-600 mt-2">{m.matchReasoning}</p>
                <div className="flex flex-wrap gap-1 mt-2">
                  {m.skillsMatched.map((s) => (
                    <span key={s} className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                      ✓ {s}
                    </span>
                  ))}
                  {m.skillsMissing.map((s) => (
                    <span key={s} className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                      ✗ {s}
                    </span>
                  ))}
                </div>
                {m.avgAssessmentScore !== undefined && (
                  <p className="text-xs text-gray-500 mt-2">
                    Avg assessment score: {m.avgAssessmentScore}%
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <h2 className="font-semibold text-gray-800 mb-3">Applications for this Job</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm border border-gray-200 rounded-xl overflow-hidden">
          <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-2">Student</th>
              <th className="text-left px-4 py-2">Match Score</th>
              <th className="text-left px-4 py-2">Status</th>
              <th className="text-left px-4 py-2">Applied</th>
              <th className="text-left px-4 py-2">Action</th>
            </tr>
          </thead>
          <tbody>
            {applications.map((a) => (
              <tr key={a.id} className="border-t border-gray-100">
                <td className="px-4 py-2">{a.studentId}</td>
                <td className="px-4 py-2">
                  {a.matchScore !== undefined && a.matchScore !== null ? (
                    <MatchScoreBadge score={a.matchScore} />
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-4 py-2">
                  <StatusBadge status={a.status} />
                </td>
                <td className="px-4 py-2 text-gray-500">{new Date(a.appliedAt).toLocaleDateString()}</td>
                <td className="px-4 py-2">
                  <select
                    value={a.status}
                    onChange={(e) => updateStatus(a.id, e.target.value)}
                    className="border border-gray-300 rounded-lg px-2 py-1 text-xs"
                  >
                    {["applied", "shortlisted", "interview", "offer", "rejected", "placed"].map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
            {applications.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-gray-500">
                  No applications yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
