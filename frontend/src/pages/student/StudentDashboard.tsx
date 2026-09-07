import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { dashboardApi, assessmentApi } from "../../api/studentApi";
import { api } from "../../services/api";
import type { Dashboard as DashboardType, AvailableAssessment } from "../../types";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line } from "recharts";

interface DashboardStats {
  assessmentsTaken: number;
  averageScore: number | null;
  bestRank: number | null;
  batchName: string | null;
  courseName: string | null;
  facultyName: string | null;
  typeBreakdown: { type: string; averageScore: number; count: number }[];
  recentScores: { date: string; score: number; title: string }[];
}

const PIE_COLORS = ["#6366f1", "#22c55e", "#f59e0b", "#ec4899", "#06b6d4"];

export default function Dashboard() {
  const [data, setData] = useState<DashboardType | null>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [assessments, setAssessments] = useState<AvailableAssessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    dashboardApi.get().then(setData).catch(() => setError("Failed to load dashboard")).finally(() => setLoading(false));
    assessmentApi.available().then(setAssessments).catch(() => {});
    api.get<DashboardStats>("/api/v1/student/dashboard/stats").then((r) => setStats(r.data)).catch(() => {});
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

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard label="Course Progress" value={`${data.progressPercent}%`} />
        <StatCard label="Attendance" value={`${data.attendancePercent}%`} />
        <StatCard label="Assessments Taken" value={stats ? String(stats.assessmentsTaken) : "—"} />
        <StatCard label="Average Score" value={stats?.averageScore != null ? `${stats.averageScore}%` : "—"} />
        <StatCard label="Best Rank" value={stats?.bestRank != null ? `#${stats.bestRank}` : "—"} />
        <StatCard label="Batch" value={stats?.batchName || "—"} small />
      </div>

      {stats && (stats.courseName || stats.facultyName) && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-wrap gap-6 text-sm">
          {stats.courseName && <div><span className="text-gray-400">Course: </span><span className="font-medium text-gray-700">{stats.courseName}</span></div>}
          {stats.facultyName && <div><span className="text-gray-400">Faculty: </span><span className="font-medium text-gray-700">{stats.facultyName}</span></div>}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-800 mb-3">Overview</h2>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={[
                { name: "Progress", value: data.progressPercent },
                { name: "Attendance", value: data.attendancePercent },
                { name: "Avg Score", value: stats?.averageScore ?? 0 },
              ]}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} domain={[0, 100]} />
                <Tooltip />
                <Bar dataKey="value" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {stats && stats.typeBreakdown.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="font-semibold text-gray-800 mb-3">By Assessment Type</h2>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stats.typeBreakdown}
                    dataKey="averageScore"
                    nameKey="type"
                    cx="50%"
                    cy="50%"
                    outerRadius={70}
                    label={(entry) => `${entry.type}: ${entry.averageScore}%`}
                  >
                    {stats.typeBreakdown.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {stats && stats.recentScores.length > 1 && (
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="font-semibold text-gray-800 mb-3">Score Trend</h2>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={stats.recentScores}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} domain={[0, 100]} />
                  <Tooltip />
                  <Line type="monotone" dataKey="score" stroke="#22c55e" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5">
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
      </div>
    </div>
  );
}

function StatCard({ label, value, small }: { label: string; value: string; small?: boolean }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`${small ? "text-lg" : "text-2xl"} font-bold text-primary mt-1 truncate`}>{value}</p>
    </div>
  );
}
