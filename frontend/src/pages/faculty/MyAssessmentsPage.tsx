import { useEffect, useState } from "react";
import ArcLoader from "../../components/ArcLoader";
import { useNavigate } from "react-router-dom";
import { getMyAssessments, getAllAssessments } from "../../api/facultyApi";
import { apiClient } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import type { Assessment } from "../../types";

interface LiveStudent {
  studentId: string;
  studentName: string;
  studentEmail?: string;
  ipAddress?: string;
  startedAt: string;
  violationCount: number;
  isFlagged: boolean;
  lastViolationReason?: string | null;
  lastViolationSeverity?: "low" | "high" | null;
  latestSnapshot: string | null;
}

interface ResultRow {
  resultId: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  status: string;
  score: number | null;
  rank: number | null;
  isTerminated: boolean;
  violationCount: number;
  startedAt: string | null;
  submittedAt: string | null;
  mockInterview: { overallScore: number | null; maxScore: number | null; feedbackText: string | null; recordedAt: string | null } | null;
}

interface ResultSummary {
  averageScore: number | null;
  highestScore: number | null;
  lowestScore: number | null;
  attemptedCount: number;
  notAttemptedCount: number | null;
}

export default function MyAssessmentsPage() {
  const [items, setItems] = useState<Assessment[]>([]);
  const [monitor, setMonitor] = useState<{ id: string; title: string; data: LiveStudent[] } | null>(null);
  const [results, setResults] = useState<{ id: string; title: string; maxMarks: number | null; total: number; summary: ResultSummary; rows: ResultRow[] } | null>(null);
  const [resultStatusFilter, setResultStatusFilter] = useState("");
  const [resultBatchFilter, setResultBatchFilter] = useState("");
  const [resultSearch, setResultSearch] = useState("");
  const [batches, setBatches] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "super_admin";

  const load = () => {
    setLoading(true);
    (isAdmin ? getAllAssessments() : getMyAssessments())
      .then(setItems)
      .catch(() => setError("Failed to load assessments"))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  // Auto-refresh monitor every 8s (matches the 7s student snapshot cadence)
  useEffect(() => {
    if (!monitor) return;
    const t = setInterval(() => {
      apiClient.get(`/api/v1/assessments/${monitor.id}/monitor`)
        .then(r => setMonitor(m => m ? { ...m, data: r.data } : null))
        .catch(() => {});
    }, 8000);
    return () => clearInterval(t);
  }, [monitor?.id]);

  const handleToggle = async (id: string) => {
    try {
      await apiClient.patch(`/api/v1/assessments/${id}/toggle-active`);
      load();
    } catch { setError("Failed to toggle assessment"); }
  };

  const handleDelete = async (id: string, title: string) => {
    if (!window.confirm(`Delete "${title}"? This cannot be undone.`)) return;
    try {
      await apiClient.delete(`/api/v1/assessments/${id}`);
      load();
    } catch { setError("Failed to delete assessment"); }
  };

  const openMonitor = async (id: string, title: string) => {
    try {
      const r = await apiClient.get(`/api/v1/assessments/${id}/monitor`);
      setMonitor({ id, title, data: r.data });
    } catch { setError("Failed to load monitor"); }
  };

  const loadResults = async (id: string, title: string, statusFilter: string, batchFilter: string, search: string) => {
    try {
      const params: Record<string, string> = {};
      if (statusFilter) params.status = statusFilter;
      if (batchFilter) params.batch_id = batchFilter;
      if (search) params.search = search;
      const r = await apiClient.get(`/api/v1/assessments/${id}/results`, { params });
      setResults({ id, title, maxMarks: r.data.maxMarks, total: r.data.totalAttempts, summary: r.data.summary, rows: r.data.results });
    } catch { setError("Failed to load results"); }
  };

  const openResults = async (id: string, title: string) => {
    setResultStatusFilter("");
    setResultBatchFilter("");
    setResultSearch("");
    if (batches.length === 0) {
      try {
        const r = await apiClient.get(`/api/v1/registration/batches`);
        setBatches(r.data.map((b: any) => ({ id: b.id, name: b.name })));
      } catch { /* filter dropdown just stays empty if this fails */ }
    }
    loadResults(id, title, "", "", "");
  };

  const logMockInterviewScore = async (studentId: string, studentName: string) => {
    const maxStr = window.prompt(`Total marks for ${studentName}'s mock interview (e.g. 10, 50, 100):`, "100");
    if (maxStr === null) return;
    const maxScore = Number(maxStr);
    if (Number.isNaN(maxScore) || maxScore <= 0) {
      setError("Total marks must be a positive number");
      return;
    }
    const scoreStr = window.prompt(`Score obtained (out of ${maxScore}):`);
    if (scoreStr === null) return;
    const score = Number(scoreStr);
    if (Number.isNaN(score) || score < 0 || score > maxScore) {
      setError(`Score must be a number between 0 and ${maxScore}`);
      return;
    }
    const feedback = window.prompt("Feedback (optional):") || undefined;
    try {
      await apiClient.post("/api/v1/mock-interviews/manual-score", {
        studentId, overallScore: score, maxScore, feedbackText: feedback,
      });
      if (results) loadResults(results.id, results.title, resultStatusFilter, resultBatchFilter, resultSearch);
    } catch { setError("Failed to log mock interview score"); }
  };

  const exportResultsCsv = () => {
    if (!results) return;
    const header = ["Rank", "Student", "Email", "Status", "Assessment Score", "Max Marks", "Mock Interview Score", "Mock Interview Max", "Violations", "Submitted At"];
    const lines = results.rows.map((r) => [
      r.rank ?? "", r.studentName, r.studentEmail, r.status,
      r.score ?? "", results.maxMarks ?? "",
      r.mockInterview?.overallScore ?? "", r.mockInterview?.maxScore ?? "", r.violationCount,
      r.submittedAt ? new Date(r.submittedAt).toLocaleString() : "",
    ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","));
    const csv = [header.join(","), ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${results.title.replace(/[^a-z0-9]+/gi, "_")}_results.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const refreshMonitor = async () => {
    if (!monitor) return;
    try {
      const r = await apiClient.get(`/api/v1/assessments/${monitor.id}/monitor`);
      setMonitor(m => m ? { ...m, data: r.data } : null);
    } catch { /* ignore */ }
  };

  const handleReinstate = async (resultId: string) => {
    if (!window.confirm("Allow this student to resume the assessment?")) return;
    try {
      await apiClient.post(`/api/v1/assessments/results/${resultId}/reinstate`);
      refreshMonitor();
    } catch { setError("Failed to reinstate student"); }
  };

  const handleDenyHelp = async (resultId: string) => {
    try {
      await apiClient.post(`/api/v1/assessments/results/${resultId}/deny-help`);
      refreshMonitor();
    } catch { setError("Failed to dismiss request"); }
  };

  if (loading) return <ArcLoader label="Loading assessments" />;

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">My Assessments</h1>
        <button onClick={() => navigate("/faculty/assessments/new")}
          className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium">
          + Create Assessment
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-2">
          {error}
          <button onClick={() => setError("")} className="ml-2 underline">dismiss</button>
        </div>
      )}

      {items.length === 0 ? (
        <p className="text-sm text-gray-400">No assessments yet. Create one to get started.</p>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
          {items.map((a) => {
            const id = String(a.id);
            const isActive = (a as any).isActive !== false;
            return (
              <div key={id} className="px-5 py-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-gray-800">{a.title}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        isActive ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500"
                      }`}>
                        {isActive ? "Active" : "Inactive"}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {a.questionCount} questions · {a.duration} min · {a.type}
                    </p>
                    {a.batchIds?.length ? (
                      <p className="text-xs text-indigo-500 mt-0.5">{a.batchIds.length} batch(es) assigned</p>
                    ) : (
                      <p className="text-xs text-gray-400 mt-0.5">Visible to all students</p>
                    )}
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <button onClick={() => openMonitor(id, a.title)}
                      className="text-xs px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 font-medium hover:bg-blue-100">
                      📹 Monitor
                    </button>
                    <button onClick={() => openResults(id, a.title)}
                      className="text-xs px-3 py-1.5 rounded-lg bg-purple-50 text-purple-700 font-medium hover:bg-purple-100">
                      📊 View Results
                    </button>
                    <button onClick={() => handleToggle(id)}
                      className={`text-xs px-3 py-1.5 rounded-lg font-medium ${
                        isActive
                          ? "bg-amber-50 text-amber-700 hover:bg-amber-100"
                          : "bg-green-50 text-green-700 hover:bg-green-100"
                      }`}>
                      {isActive ? "Deactivate" : "Activate"}
                    </button>
                    <button onClick={() => handleDelete(id, a.title)}
                      className="text-xs px-3 py-1.5 rounded-lg bg-red-50 text-red-700 font-medium hover:bg-red-100">
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Live Monitor Panel */}
      {monitor && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-gray-200 sticky top-0 bg-white">
              <div>
                <h2 className="font-bold text-gray-800">🔴 Live Monitor — {monitor.title}</h2>
                <p className="text-xs text-gray-400 mt-0.5">Auto-refreshes every 8 seconds</p>
              </div>
              <button onClick={() => setMonitor(null)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">✕</button>
            </div>
            <div className="p-5 space-y-3">
              {monitor.data.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-12">
                  No students currently taking or terminated in this assessment.
                </p>
              ) : monitor.data.map((s) => (
                <div key={s.studentId}
                  className={`rounded-xl border p-4 ${
                    (s as any).isTerminated ? "border-red-400 bg-red-50" :
                    s.lastViolationSeverity === "high" ? "border-red-400 bg-red-50 ring-2 ring-red-300" :
                    s.isFlagged ? "border-amber-300 bg-amber-50" : "border-gray-200"
                  }`}>
                  <div className="flex items-start gap-4">
                    {s.latestSnapshot && (
                      <img src={s.latestSnapshot} alt="snapshot"
                        className="w-28 h-20 rounded-lg object-cover border border-gray-200 shrink-0" />
                    )}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-gray-800">{s.studentName}</p>
                        {(s as any).isTerminated && (
                          <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-bold">🚫 TERMINATED</span>
                        )}
                        {s.lastViolationSeverity === "high" && !(s as any).isTerminated && (
                          <span className="text-xs bg-red-600 text-white px-2 py-0.5 rounded-full font-bold animate-pulse">🔴 HIGH SEVERITY</span>
                        )}
                        {s.isFlagged && !(s as any).isTerminated && s.lastViolationSeverity !== "high" && (
                          <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-semibold">🚨 FLAGGED</span>
                        )}
                        {(s as any).helpRequested && (
                          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-bold animate-pulse">📩 HELP REQUESTED</span>
                        )}
                        {s.violationCount > 0 && (
                          <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                            ⚠️ {s.violationCount} violation{s.violationCount !== 1 ? "s" : ""}
                          </span>
                        )}
                        {!s.isFlagged && s.violationCount === 0 && !(s as any).isTerminated && (
                          <span className="text-xs text-green-600">✓ Clean</span>
                        )}
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase ${
                          (s as any).status === "terminated" ? "bg-red-200 text-red-800" :
                          (s as any).status === "in_progress" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                        }`}>{(s as any).status}</span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">Started: {new Date(s.startedAt).toLocaleTimeString()}</p>
                      <p className="text-xs text-gray-400 mt-0.5 font-mono">
                        {s.studentEmail || "no email"} · IP: {s.ipAddress || "unknown"}
                      </p>
                      {s.lastViolationReason && (
                        <div className={`mt-2 rounded p-2 text-xs font-medium ${
                          s.lastViolationSeverity === "high" ? "bg-red-100 text-red-800 border border-red-300" : "bg-slate-50 text-slate-600 border border-slate-200"
                        }`}>
                          {s.lastViolationSeverity === "high" ? "🔴" : "⚠️"} {s.lastViolationReason}
                        </div>
                      )}
                      {(s as any).helpMessage && (
                        <div className="mt-2 bg-blue-50 border border-blue-200 rounded p-2 text-xs text-blue-800">
                          <span className="font-bold">Help message:</span> {(s as any).helpMessage}
                        </div>
                      )}
                      {(s as any).helpRequested && (
                        <div className="mt-3 flex gap-2">
                          <button
                            onClick={() => handleReinstate((s as any).resultId)}
                            className="text-xs px-3 py-1.5 rounded-lg bg-green-600 text-white font-medium hover:bg-green-700">
                            ✓ Reinstate student
                          </button>
                          <button
                            onClick={() => handleDenyHelp((s as any).resultId)}
                            className="text-xs px-3 py-1.5 rounded-lg bg-gray-100 text-gray-600 font-medium hover:bg-gray-200">
                            Dismiss request
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Results Panel */}
      {results && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-6xl max-h-[92vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-gray-200 sticky top-0 bg-white">
              <div>
                <h2 className="font-bold text-gray-800">📊 Results — {results.title}</h2>
                <p className="text-xs text-gray-400 mt-0.5">{results.total} attempt(s){results.maxMarks ? ` · out of ${results.maxMarks} marks` : ""}</p>
              </div>
              <button onClick={() => setResults(null)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">✕</button>
            </div>

            <div className="p-5 space-y-4">
              {/* Filters */}
              <div className="flex gap-2 flex-wrap items-center">
                <select
                  value={resultBatchFilter}
                  onChange={(e) => { setResultBatchFilter(e.target.value); loadResults(results.id, results.title, resultStatusFilter, e.target.value, resultSearch); }}
                  className="text-xs border border-gray-200 rounded-lg px-3 py-1.5">
                  <option value="">All batches</option>
                  {batches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
                <select
                  value={resultStatusFilter}
                  onChange={(e) => { setResultStatusFilter(e.target.value); loadResults(results.id, results.title, e.target.value, resultBatchFilter, resultSearch); }}
                  className="text-xs border border-gray-200 rounded-lg px-3 py-1.5">
                  <option value="">All statuses</option>
                  <option value="completed">Completed</option>
                  <option value="in_progress">In progress</option>
                  <option value="terminated">Terminated</option>
                </select>
                <input
                  type="text"
                  placeholder="Search by name or email..."
                  value={resultSearch}
                  onChange={(e) => setResultSearch(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") loadResults(results.id, results.title, resultStatusFilter, resultBatchFilter, resultSearch); }}
                  className="text-xs border border-gray-200 rounded-lg px-3 py-1.5 flex-1 min-w-[160px]"
                />
                <button
                  onClick={() => loadResults(results.id, results.title, resultStatusFilter, resultBatchFilter, resultSearch)}
                  className="text-xs px-3 py-1.5 rounded-lg bg-gray-100 text-gray-700 font-medium hover:bg-gray-200">
                  Search
                </button>
                <button
                  onClick={exportResultsCsv}
                  className="text-xs px-3 py-1.5 rounded-lg bg-green-50 text-green-700 font-medium hover:bg-green-100">
                  ⬇ Export CSV
                </button>
              </div>

              {/* Summary stats — same shape as the batch Performance dashboard */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-[10px] text-gray-400 uppercase font-semibold">Attempted</p>
                  <p className="text-lg font-bold text-gray-800">{results.summary.attemptedCount}</p>
                </div>
                {results.summary.notAttemptedCount !== null && (
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-[10px] text-gray-400 uppercase font-semibold">Not attempted</p>
                    <p className="text-lg font-bold text-gray-800">{results.summary.notAttemptedCount}</p>
                  </div>
                )}
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-[10px] text-gray-400 uppercase font-semibold">Average</p>
                  <p className="text-lg font-bold text-gray-800">{results.summary.averageScore ?? "—"}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-[10px] text-gray-400 uppercase font-semibold">Highest</p>
                  <p className="text-lg font-bold text-green-700">{results.summary.highestScore ?? "—"}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-[10px] text-gray-400 uppercase font-semibold">Lowest</p>
                  <p className="text-lg font-bold text-red-600">{results.summary.lowestScore ?? "—"}</p>
                </div>
              </div>

              {/* Table */}
              {results.rows.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-12">No results match these filters.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-left text-gray-400 border-b border-gray-100">
                        <th className="py-2 pr-3">Rank</th>
                        <th className="py-2 pr-3">Student</th>
                        <th className="py-2 pr-3">Status</th>
                        <th className="py-2 pr-3">Assessment Score</th>
                        <th className="py-2 pr-3">Mock Interview</th>
                        <th className="py-2 pr-3">Violations</th>
                        <th className="py-2 pr-3">Submitted</th>
                      </tr>
                    </thead>
                    <tbody>
                      {results.rows.map((r) => (
                        <tr key={r.resultId} className="border-b border-gray-50">
                          <td className="py-2 pr-3">{r.rank ?? "—"}</td>
                          <td className="py-2 pr-3">
                            <p className="font-medium text-gray-800">{r.studentName}</p>
                            <p className="text-gray-400">{r.studentEmail}</p>
                          </td>
                          <td className="py-2 pr-3">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                              r.status === "completed" ? "bg-green-50 text-green-700" :
                              r.status === "terminated" ? "bg-red-100 text-red-700" :
                              "bg-amber-50 text-amber-700"
                            }`}>{r.status}</span>
                          </td>
                          <td className="py-2 pr-3 font-semibold text-gray-800">
                            {r.score !== null ? `${r.score} / ${results.maxMarks ?? "?"}` : "— (not attempted)"}
                          </td>
                          <td className="py-2 pr-3">
                            {r.mockInterview ? (
                              <div>
                                <span className="font-semibold text-gray-800">{r.mockInterview.overallScore} / {r.mockInterview.maxScore ?? 100}</span>
                                {r.mockInterview.feedbackText && (
                                  <p className="text-gray-400 max-w-[160px] truncate" title={r.mockInterview.feedbackText}>{r.mockInterview.feedbackText}</p>
                                )}
                              </div>
                            ) : (
                              <button
                                onClick={() => logMockInterviewScore(r.studentId, r.studentName)}
                                className="text-[10px] px-2 py-1 rounded-full bg-indigo-50 text-indigo-700 font-medium hover:bg-indigo-100">
                                + Log score
                              </button>
                            )}
                          </td>
                          <td className="py-2 pr-3">{r.violationCount}</td>
                          <td className="py-2 pr-3 text-gray-400">
                            {r.submittedAt ? new Date(r.submittedAt).toLocaleString() : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
