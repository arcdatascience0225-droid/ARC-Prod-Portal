import React, { useEffect, useState } from "react";
import ArcLoader from "../../../components/ArcLoader";
import { studentJobsApi, interviewApi } from "../../../api/placementApi";
import { Application, Interview } from "../../../types/placement";
import StatusBadge from "../../../components/StatusBadge";

const STAGES = ["applied", "shortlisted", "interview", "offer", "placed"];

export default function ApplicationTrackerPage() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const [apps, upcoming] = await Promise.all([
      studentJobsApi.myApplications(),
      interviewApi.myUpcoming(),
    ]);
    setApplications(apps);
    setInterviews(upcoming);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const withdraw = async (id: string) => {
    if (!confirm("Withdraw this application?")) return;
    await studentJobsApi.withdraw(id);
    load();
  };

  const interviewsFor = (applicationId: string) =>
    interviews.filter((i) => i.applicationId === applicationId);

  if (loading) return <ArcLoader />;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">My Applications</h1>

      <div className="space-y-4">
        {applications.map((a) => (
          <div key={a.id} className="border border-gray-200 rounded-xl p-5 bg-white shadow-sm">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-semibold text-gray-900">{a.jobTitle}</h3>
                <p className="text-sm text-gray-500">{a.companyName}</p>
              </div>
              <StatusBadge status={a.status} />
            </div>

            {a.status !== "withdrawn" && a.status !== "rejected" && (
              <div className="flex items-center gap-2 mt-4">
                {STAGES.map((stage, idx) => {
                  const currentIdx = STAGES.indexOf(a.status);
                  const active = idx <= currentIdx;
                  return (
                    <React.Fragment key={stage}>
                      <div
                        className={`w-2.5 h-2.5 rounded-full ${active ? "bg-indigo-600" : "bg-gray-200"}`}
                        title={stage}
                      />
                      {idx < STAGES.length - 1 && (
                        <div className={`flex-1 h-0.5 ${active ? "bg-indigo-600" : "bg-gray-200"}`} />
                      )}
                    </React.Fragment>
                  );
                })}
              </div>
            )}

            {interviewsFor(a.id).length > 0 && (
              <div className="mt-4 space-y-1">
                <p className="text-xs font-medium text-gray-600">Interviews</p>
                {interviewsFor(a.id).map((i) => (
                  <p key={i.id} className="text-xs text-gray-500">
                    {i.roundName}: {new Date(i.scheduledAt).toLocaleString()} ({i.status})
                  </p>
                ))}
              </div>
            )}

            <div className="flex justify-between items-center mt-4">
              <p className="text-xs text-gray-400">
                Applied {new Date(a.appliedAt).toLocaleDateString()}
              </p>
              {["applied", "shortlisted"].includes(a.status) && (
                <button onClick={() => withdraw(a.id)} className="text-xs text-red-600 hover:underline">
                  Withdraw Application
                </button>
              )}
            </div>
          </div>
        ))}
        {applications.length === 0 && (
          <p className="text-gray-500">You haven't applied to any jobs yet.</p>
        )}
      </div>
    </div>
  );
}
