import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getBatchesSummary, getMySummary, BatchSummaryRow, FacultyActivitySummary } from "../../api/facultyApi";
import ArcLoader from "../../components/ArcLoader";

function StatCard({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <p className="text-[11px] text-slate-400 uppercase font-semibold">{label}</p>
      <p className="text-xl font-bold text-slate-800 mt-1">{value}</p>
    </div>
  );
}

export default function FacultyDashboard() {
  const navigate = useNavigate();
  const [summary, setSummary] = useState<FacultyActivitySummary | null>(null);
  const [batches, setBatches] = useState<BatchSummaryRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([getMySummary(), getBatchesSummary()])
      .then(([s, b]) => { setSummary(s); setBatches(b); })
      .finally(() => setLoading(false));
  }, []);

  const fmtDate = (d?: string | null) => (d ? new Date(d).toLocaleDateString() : "—");

  if (loading) return <ArcLoader label="Loading dashboard" />;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-800">Faculty Dashboard</h1>
        <p className="text-sm text-slate-400 mt-1">
          Batches are created and assigned by Admin. Contact Admin to get a new batch assigned to you.
        </p>
      </div>

      {summary && (
        <div>
          <h2 className="text-sm font-semibold text-slate-500 uppercase mb-2">My Activity</h2>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <StatCard label="Lectures Taken" value={summary.lecturesTaken} />
            <StatCard label="Online Classes" value={summary.onlineClasses} />
            <StatCard label="Offline Classes" value={summary.offlineClasses} />
            <StatCard label="Assessments Given" value={summary.assessmentsCreated} />
            <StatCard label="Mocks Scheduled" value={summary.mocksScheduled} />
          </div>
        </div>
      )}

      <div>
        <h2 className="text-sm font-semibold text-slate-500 uppercase mb-2">
          Assigned Batches ({batches.length}) — click a batch to open its full page
        </h2>
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3 text-left">Batch</th>
                <th className="px-4 py-3 text-left">Start</th>
                <th className="px-4 py-3 text-left">Expected End</th>
                <th className="px-4 py-3 text-left">Delayed By</th>
                <th className="px-4 py-3 text-left">Syllabus</th>
                <th className="px-4 py-3 text-left">Batch Time</th>
                <th className="px-4 py-3 text-left">Students</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {batches.map((b) => (
                <tr key={b.batchId} onClick={() => navigate(`/faculty/batches/${b.batchId}`)}
                  className="cursor-pointer hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-800">{b.batchName}</p>
                    <p className="text-xs text-slate-400">{b.course || "—"}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{fmtDate(b.startDate)}</td>
                  <td className="px-4 py-3 text-slate-600">{fmtDate(b.endDate)}</td>
                  <td className="px-4 py-3">
                    {b.delayedByDays > 0 ? (
                      <span className="text-red-600 font-semibold">{b.delayedByDays} days</span>
                    ) : (
                      <span className="text-emerald-600">On track</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                        <div className="h-full bg-indigo-500" style={{ width: `${b.syllabusPercent}%` }} />
                      </div>
                      <span className="text-xs text-slate-500">{b.syllabusPercent}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{b.batchTime || "—"}</td>
                  <td className="px-4 py-3 text-slate-600">{b.studentsCount}</td>
                </tr>
              ))}
              {batches.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-6 text-center text-slate-400">No batches assigned yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
