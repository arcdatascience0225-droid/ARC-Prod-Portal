import { useEffect, useState } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { api } from "../../services/api";
import ArcLoader from "../../components/ArcLoader";

interface StudentFullDetail {
  studentId: string; studentName: string; studentEmail: string;
  totalLectures: number; onlineLectures: number; offlineLectures: number;
  assignmentsSubmitted: number; mocksGiven: number;
  rank: number | null; score: number | null;
  assignmentsScore: number | null; mockScore: number | null;
  batchName: string | null; facultyName: string | null;
  jobsApplied: number; jobsRejected: number; placed: boolean;
}

function StatCard({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <p className="text-[11px] text-slate-400 uppercase font-semibold">{label}</p>
      <p className="text-xl font-bold text-slate-800 mt-1">{value}</p>
    </div>
  );
}

export default function StudentDetailPage() {
  const { studentId } = useParams<{ studentId: string }>();
  const [searchParams] = useSearchParams();
  const batchId = searchParams.get("batchId") || undefined;
  const navigate = useNavigate();
  const [detail, setDetail] = useState<StudentFullDetail | null>(null);

  useEffect(() => {
    if (!studentId) return;
    api.get<StudentFullDetail>(`/api/v1/attendance/student/${studentId}/full-detail`, {
      params: { batch_id: batchId },
    }).then((r) => setDetail(r.data));
  }, [studentId, batchId]);

  if (!detail) return <ArcLoader label="Loading student" />;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="text-slate-400 hover:text-slate-600 text-lg">←</button>
        <div>
          <h1 className="text-2xl font-semibold text-slate-800">{detail.studentName}</h1>
          <p className="text-sm text-slate-400">{detail.studentEmail}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Total Lectures" value={detail.totalLectures} />
        <StatCard label="Online Lectures" value={detail.onlineLectures} />
        <StatCard label="Offline Lectures" value={detail.offlineLectures} />
        <StatCard label="Rank in Batch" value={detail.rank ?? "—"} />
        <StatCard label="Overall Score" value={detail.score != null ? `${detail.score}%` : "—"} />
        <StatCard label="Assignments Submitted" value={detail.assignmentsSubmitted} />
        <StatCard label="Assignments Score" value={detail.assignmentsScore ?? "—"} />
        <StatCard label="Mocks Given" value={detail.mocksGiven} />
        <StatCard label="Mock Score" value={detail.mockScore ?? "—"} />
        <StatCard label="Batch" value={detail.batchName || "—"} />
        <StatCard label="Faculty" value={detail.facultyName || "—"} />
        <StatCard label="Jobs Applied" value={detail.jobsApplied} />
        <StatCard label="Jobs Rejected" value={detail.jobsRejected} />
        <StatCard label="Placement" value={
          detail.placed ? <span className="text-emerald-600">Placed ✓</span> : <span className="text-slate-500">Not placed</span>
        } />
      </div>
    </div>
  );
}
