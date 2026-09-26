import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getAttendanceAnalytics, AttendanceAnalytics } from "../../api/facultyApi";
import { api } from "../../services/api";
import ArcLoader from "../../components/ArcLoader";

const todayIso = () => new Date().toISOString().slice(0, 10);

export default function ManagerDashboardPage() {
  const [analytics, setAnalytics] = useState<AttendanceAnalytics | null>(null);
  const [staffToday, setStaffToday] = useState<{ staffId: string; status: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      getAttendanceAnalytics(undefined, 1),
      api.get<{ staffId: string; status: string }[]>("/api/v1/attendance/staff", { params: { for_date: todayIso() } }).then((r) => r.data).catch(() => []),
    ])
      .then(([a, s]) => { setAnalytics(a); setStaffToday(s); })
      .finally(() => setLoading(false));
  }, []);

  const staffPresent = staffToday.filter((s) => s.status === "present" || s.status === "late").length;
  const staffAbsent = staffToday.filter((s) => s.status === "absent").length;

  if (loading) return <ArcLoader label="Loading dashboard" />;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-semibold text-slate-800">Dashboard</h1>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-[10px] text-slate-400 uppercase font-semibold">Students present today</p>
          <p className="text-2xl font-bold text-emerald-600 mt-1">{analytics?.pie.present ?? "—"}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-[10px] text-slate-400 uppercase font-semibold">Students absent today</p>
          <p className="text-2xl font-bold text-rose-600 mt-1">{analytics?.pie.absent ?? "—"}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-[10px] text-slate-400 uppercase font-semibold">Faculty present today</p>
          <p className="text-2xl font-bold text-emerald-600 mt-1">{staffPresent}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-[10px] text-slate-400 uppercase font-semibold">Faculty absent today</p>
          <p className="text-2xl font-bold text-rose-600 mt-1">{staffAbsent}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link to="/attendance/students" className="block bg-indigo-600 text-white rounded-xl p-5 hover:bg-indigo-700 transition">
          <p className="font-semibold text-lg">Student Attendance →</p>
          <p className="text-sm text-indigo-100 mt-1">Take attendance, month view, reports, analytics</p>
        </Link>
        <Link to="/attendance/faculty" className="block bg-slate-800 text-white rounded-xl p-5 hover:bg-slate-900 transition">
          <p className="font-semibold text-lg">Faculty Attendance →</p>
          <p className="text-sm text-slate-300 mt-1">Mark and review faculty/trainer attendance</p>
        </Link>
      </div>
    </div>
  );
}
