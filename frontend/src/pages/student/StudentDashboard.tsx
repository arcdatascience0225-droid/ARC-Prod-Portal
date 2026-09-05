import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { dashboardApi, assessmentApi } from "../../api/studentApi";
import type { Dashboard as DashboardType, AvailableAssessment } from "../../types";

export default function Dashboard() {
  const [data, setData] = useState<DashboardType | null>(null);
  const [assessments, setAssessments] = useState<AvailableAssessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    dashboardApi.get().then(setData).catch(() => setError("Failed to load dashboard")).finally(() => setLoading(false));
    assessmentApi.available().then(setAssessments).catch(() => {});
  }, []);

  if (loading) return <div className="text-gray-500">Loading dashboard...</div>;
  if (error) return <div className="text-red-600">{error}</div>;
  if (!data) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Welcome back, {data.welcomeName} 👋</h1>
        <p className="text-gray-500">Here's what's happening with your learning journey.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <StatCard label="Course Progress" value={`${data.progressPercent}%`} />
        <StatCard label="Attendance" value={`${data.attendancePercent}%`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-800 mb-3">Available Assessments</h2>
          {assessments.length === 0 ? (
            <p className="text-sm text-gray-400">No pending assessments. 🎉</p>
          ) : (
            <ul className="space-y-2">
              {assessments.slice(0, 5).map((a) => (
                <li key={a.id} className="flex items-center justify-between border-b border-gray-100 pb-2">
                  <div>
                    <p className="text-sm font-medium text-gray-700">{a.title}</p>
                    <p className="text-xs text-gray-400 uppercase">{a.type} · {a.duration} min · {a.questionCount} Qs</p>
                  </div>
                  <Link to={`/student/assessments/${a.id}`}
                    className="text-xs px-3 py-1.5 rounded-lg bg-primary text-white hover:bg-primary-dark">
                    Start
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-800 mb-3">Recent Notifications</h2>
          {data.recentNotifications.length === 0 && (
            <p className="text-sm text-gray-400">You're all caught up!</p>
          )}
          <ul className="space-y-2">
            {data.recentNotifications.map((n) => (
              <li key={n.id} className={`p-2 rounded-lg text-sm ${n.isRead ? "text-gray-500" : "text-gray-800 bg-primary/5"}`}>
                <p className="font-medium">{n.title}</p>
                {n.message && <p className="text-xs text-gray-400">{n.message}</p>}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="text-3xl font-bold text-primary mt-1">{value}</p>
    </div>
  );
}
