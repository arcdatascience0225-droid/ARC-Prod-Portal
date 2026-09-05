import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { api } from "../../services/api";
import ArcLoader from "../../components/ArcLoader";

interface BatchStudentRow {
  id: string; name: string; email: string; phone: string | null;
  isActive: boolean; averageScore: number | null;
}

interface BatchDetail {
  batchId: string; batchName: string; course: string | null;
  startDate: string | null; endDate: string | null; delayedByDays: number;
  syllabusPercent: number; batchTime: string | null; assessmentsGiven: number;
  studentsCount: number; activeStudents: number; inactiveStudents: number;
  onlineLectures: number; offlineLectures: number; students: BatchStudentRow[];
}

function StatCard({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <p className="text-[11px] text-slate-400 uppercase font-semibold">{label}</p>
      <p className="text-xl font-bold text-slate-800 mt-1">{value}</p>
    </div>
  );
}

export default function BatchDetailPage() {
  const { batchId } = useParams<{ batchId: string }>();
  const navigate = useNavigate();
  const [detail, setDetail] = useState<BatchDetail | null>(null);

  useEffect(() => {
    if (!batchId) return;
    api.get<BatchDetail>(`/api/v1/faculty/batches/${batchId}/detail`).then((r) => setDetail(r.data));
  }, [batchId]);

  const fmtDate = (d?: string | null) => (d ? new Date(d).toLocaleDateString() : "—");

  if (!detail) return <ArcLoader label="Loading batch" />;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="text-slate-400 hover:text-slate-600 text-lg">←</button>
        <div>
          <h1 className="text-2xl font-semibold text-slate-800">{detail.batchName}</h1>
          <p className="text-sm text-slate-400">{detail.course || "—"}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Start Date" value={fmtDate(detail.startDate)} />
        <StatCard label="Expected End" value={fmtDate(detail.endDate)} />
        <StatCard label="Delayed By" value={detail.delayedByDays > 0 ? `${detail.delayedByDays} days` : "On track"} />
        <StatCard label="Syllabus" value={`${detail.syllabusPercent}%`} />
        <StatCard label="Batch Time" value={detail.batchTime || "—"} />
        <StatCard label="Assessments Given" value={detail.assessmentsGiven} />
        <StatCard label="Online Classes" value={detail.onlineLectures} />
        <StatCard label="Offline Classes" value={detail.offlineLectures} />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <StatCard label="Total Students" value={detail.studentsCount} />
        <StatCard label="Active" value={detail.activeStudents} />
        <StatCard label="Inactive" value={detail.inactiveStudents} />
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100">
          <h2 className="font-semibold text-slate-800">Students in {detail.batchName}</h2>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3 text-left">Name</th>
              <th className="px-4 py-3 text-left">Contact</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left">Average Score</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {detail.students.map((s) => (
              <tr key={s.id} onClick={() => navigate(`/faculty/students/${s.id}?batchId=${detail.batchId}`)}
                className="cursor-pointer hover:bg-slate-50">
                <td className="px-4 py-3 font-medium text-slate-800">{s.name}</td>
                <td className="px-4 py-3 text-slate-500">
                  <div>{s.email}</div>
                  {s.phone && <div className="text-xs text-slate-400">{s.phone}</div>}
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${s.isActive ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                    {s.isActive ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-600">{s.averageScore != null ? `${s.averageScore}%` : "—"}</td>
              </tr>
            ))}
            {detail.students.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-6 text-center text-slate-400">No students in this batch.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
