import React, { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { api } from "../services/api";
import StudentDashboard from "./student/StudentDashboard";

const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  faculty: "Faculty",
  trainer: "Trainer",
  hr: "HR",
  placement_coordinator: "Placement Coordinator",
  student: "Student",
  guest: "Guest",
};

interface BatchProgressRow {
  batchId: string;
  batchName: string;
  studentsCount: number;
  averageScore: number | null;
  completionRate: number;
}

interface DashboardSummary {
  totalBatches: number;
  totalStudents: number;
  overallAverageScore: number | null;
  batches: BatchProgressRow[];
}

const StatCard: React.FC<{ label: string; value: React.ReactNode; hint: string; accent: string }> = ({
  label,
  value,
  hint,
  accent,
}) => (
  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
    <div className="flex items-center gap-3">
      <span className={`h-2.5 w-2.5 rounded-full ${accent}`} />
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">{label}</p>
    </div>
    <p className="mt-2 font-display text-xl font-bold text-ink-900 dark:text-white">{value}</p>
    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{hint}</p>
  </div>
);

export const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const roleLabel = user ? ROLE_LABELS[user.role] : "";
  const [summary, setSummary] = useState<DashboardSummary | null>(null);

  const canSeeBatches = user && ["faculty", "trainer", "admin", "super_admin"].includes(user.role);

  useEffect(() => {
    if (canSeeBatches) {
      api.get<DashboardSummary>("/api/v1/analytics/dashboard-summary")
        .then((r) => setSummary(r.data))
        .catch(() => { /* section just stays empty if this fails */ });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.role]);

  if (user?.role === "student") {
    return <StudentDashboard />;
  }

  return (
    <>
      <h1 className="font-display text-2xl font-bold text-ink-900 dark:text-white">Welcome, {user?.name}</h1>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        You are signed in as <span className="font-medium text-ink-700 dark:text-slate-200">{roleLabel}</span>.
      </p>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Portal" value={roleLabel} hint="Access is scoped to your role" accent="bg-brand-500" />
        <StatCard label="Account status" value="Active" hint="Account in good standing" accent="bg-emerald-500" />
        <StatCard
          label="Platform"
          value="ARC"
          hint="AI Learning, Assessment & Placement"
          accent="bg-indigo-500"
        />
      </div>

      {summary && (
        <div className="mt-8">
          <h2 className="font-display text-lg font-bold text-ink-900 dark:text-white">
            {user?.role === "admin" || user?.role === "super_admin" ? "Overall Analytics" : "My Batches"}
          </h2>
          <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard label="Batches" value={summary.totalBatches} hint="Currently assigned" accent="bg-brand-500" />
            <StatCard label="Students" value={summary.totalStudents} hint="Across all batches" accent="bg-emerald-500" />
            <StatCard
              label="Average Score"
              value={summary.overallAverageScore !== null ? `${summary.overallAverageScore}%` : "—"}
              hint="Across completed assessments"
              accent="bg-indigo-500"
            />
          </div>

          {summary.batches.length > 0 && (
            <div className="mt-5 space-y-3">
              {summary.batches.map((b) => (
                <div key={b.batchId} className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-display text-sm font-bold text-ink-900 dark:text-white">{b.batchName}</p>
                    <p className="text-xs text-slate-400">
                      {b.studentsCount} students · {b.averageScore !== null ? `${b.averageScore}% avg` : "no scores yet"}
                    </p>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <div
                      className="h-full bg-brand-500 rounded-full transition-all"
                      style={{ width: `${b.completionRate}%` }}
                    />
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">{b.completionRate}% of students completed at least one assessment</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
};
