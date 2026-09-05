import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { interviewApi } from "../../api/placementApi";
import type { Interview } from "../../types/placement";

export default function ConductInterviewListPage() {
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    interviewApi
      .myAssigned()
      .then(setInterviews)
      .catch((e: any) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="mx-auto max-w-3xl p-6">
      <h1 className="mb-6 text-2xl font-bold text-ink-900 dark:text-white">Conduct Interview</h1>

      {error && <div className="mb-4 text-sm text-red-600 dark:text-red-400">{error}</div>}
      {loading && <p className="text-sm text-slate-500 dark:text-slate-400">Loading assigned interviews...</p>}

      {!loading && interviews.length === 0 && !error && (
        <p className="rounded-xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
          No interviews assigned to you yet.
        </p>
      )}

      <div className="space-y-3">
        {interviews.map((iv) => (
          <button
            key={iv.id}
            onClick={() => navigate(`/interview/conduct/${iv.id}`)}
            className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-brand-400 dark:border-slate-800 dark:bg-slate-900"
          >
            <div>
              <p className="font-medium text-ink-900 dark:text-slate-100">{iv.roundName}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {new Date(iv.scheduledAt).toLocaleString()}
              </p>
            </div>
            <span className="text-sm font-medium text-brand-600 dark:text-brand-400">Conduct →</span>
          </button>
        ))}
      </div>
    </div>
  );
}
