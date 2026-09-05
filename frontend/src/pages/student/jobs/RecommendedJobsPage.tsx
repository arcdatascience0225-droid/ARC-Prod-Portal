import React, { useEffect, useState } from "react";
import ArcLoader from "../../../components/ArcLoader";
import { studentJobsApi } from "../../../api/placementApi";
import { RecommendedJob } from "../../../types/placement";
import MatchScoreBadge from "../../../components/MatchScoreBadge";

export default function RecommendedJobsPage() {
  const [jobs, setJobs] = useState<RecommendedJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [applyingId, setApplyingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const data = await studentJobsApi.recommended(15);
      setJobs(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const apply = async (jobId: string) => {
    setApplyingId(jobId);
    setMessage("");
    setError("");
    try {
      await studentJobsApi.apply(jobId);
      setMessage("Application submitted successfully!");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setApplyingId(null);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Recommended Jobs For You</h1>
      <p className="text-sm text-gray-500 mb-6">
        Ranked using AI-based matching of your assessment performance and skills against open roles.
      </p>

      {message && <div className="mb-4 text-green-600 text-sm">{message}</div>}
      {error && <div className="mb-4 text-red-600 text-sm">{error}</div>}

      {loading ? (
        <ArcLoader label="Finding the best matches" />
      ) : (
        <div className="space-y-4">
          {jobs.map((j) => (
            <div key={j.id} className="border border-gray-200 rounded-xl p-5 bg-white shadow-sm">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-semibold text-gray-900">{j.title}</h3>
                  <p className="text-sm text-gray-500">
                    {j.companyName} · {j.location || "Remote"} · {j.jobType.replace("_", " ")}
                  </p>
                </div>
                <MatchScoreBadge score={j.matchScore} />
              </div>
              <p className="text-sm text-gray-600 mt-2">{j.matchReasoning}</p>
              <div className="flex flex-wrap gap-1 mt-3">
                {j.skillsMatched.map((s) => (
                  <span key={s} className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                    ✓ {s}
                  </span>
                ))}
                {j.skillsMissing.map((s) => (
                  <span key={s} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                    {s}
                  </span>
                ))}
              </div>
              <div className="flex justify-between items-center mt-4">
                <p className="text-xs text-gray-500">
                  {j.salaryMin && j.salaryMax
                    ? `₹${j.salaryMin.toLocaleString()} - ₹${j.salaryMax.toLocaleString()}`
                    : "Salary not disclosed"}
                </p>
                <button
                  onClick={() => apply(j.id)}
                  disabled={applyingId === j.id}
                  className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-4 py-1.5 rounded-lg text-sm font-medium"
                >
                  {applyingId === j.id ? "Applying..." : "Apply Now"}
                </button>
              </div>
            </div>
          ))}
          {jobs.length === 0 && <p className="text-gray-500">No recommended jobs right now. Check back soon.</p>}
        </div>
      )}
    </div>
  );
}
