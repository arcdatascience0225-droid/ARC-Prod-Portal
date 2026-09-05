import { useEffect, useState } from "react";
import {
  getMyBatches, getBatchStudents, markAttendance, getBatchAttendance,
  getAttendanceReport, getStudentFullDetail, AttendanceReportRow, StudentFullDetail,
} from "../../api/facultyApi";
import ArcLoader from "../../components/ArcLoader";
import { FacultyBatch, StudentInBatch, AttendanceStatus, AttendanceRecord } from "../../types";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../services/api";

function DetailStat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="bg-slate-50 rounded-lg p-3">
      <p className="text-[10px] text-slate-400 uppercase font-semibold">{label}</p>
      <p className="text-sm font-bold text-slate-800 mt-0.5">{value}</p>
    </div>
  );
}

export default function AttendancePage() {
  const { user } = useAuth();
  const isManager = user?.role === "manager" || user?.role === "super_admin";

  // ── Staff (faculty) attendance — Manager only ────────────────────────────
  const [staffList, setStaffList] = useState<{ id: string; name: string; email: string }[]>([]);
  const [staffDate, setStaffDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [staffStatuses, setStaffStatuses] = useState<Record<string, AttendanceStatus>>({});
  const [savingStaff, setSavingStaff] = useState(false);

  useEffect(() => {
    if (!isManager) return;
    api.get<{ id: string; name: string; email: string }[]>("/api/v1/attendance/staff-list").then((r) => setStaffList(r.data)).catch(() => {});
  }, [isManager]);

  useEffect(() => {
    if (!isManager) return;
    api.get<{ staffId: string; status: AttendanceStatus }[]>("/api/v1/attendance/staff", { params: { for_date: staffDate } })
      .then((r) => {
        const map: Record<string, AttendanceStatus> = {};
        r.data.forEach((row) => (map[row.staffId] = row.status));
        setStaffStatuses(map);
      })
      .catch(() => {});
  }, [isManager, staffDate]);

  const setStaffStatus = (staffId: string, status: AttendanceStatus) => {
    setStaffStatuses((prev) => ({ ...prev, [staffId]: status }));
  };

  const saveStaffAttendance = async () => {
    setSavingStaff(true);
    try {
      await Promise.all(
        staffList.map((s) =>
          api.post("/api/v1/attendance/staff", { staffId: s.id, date: staffDate, status: staffStatuses[s.id] || "present" })
        )
      );
    } finally {
      setSavingStaff(false);
    }
  };

  // ── Mark attendance (existing feature, kept as-is) ──────────────────────
  const [batches, setBatches] = useState<FacultyBatch[]>([]);
  const [batchId, setBatchId] = useState<string>("");
  const [students, setStudents] = useState<StudentInBatch[]>([]);
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [statuses, setStatuses] = useState<Record<string, AttendanceStatus>>({});
  const [saving, setSaving] = useState(false);
  const [, setExisting] = useState<AttendanceRecord[]>([]);

  // ── Report (new) ─────────────────────────────────────────────────────────
  const [reportBatchId, setReportBatchId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [studentName, setStudentName] = useState("");
  const [report, setReport] = useState<AttendanceReportRow[]>([]);
  const [reportLoading, setReportLoading] = useState(false);
  const [detail, setDetail] = useState<StudentFullDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    getMyBatches().then(setBatches).catch(() => {});
  }, []);

  useEffect(() => {
    if (!batchId) return;
    getBatchStudents(batchId).then(setStudents);
    refreshExisting();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batchId, date]);

  const refreshExisting = async () => {
    if (!batchId) return;
    const records = await getBatchAttendance(batchId, date);
    setExisting(records);
    const map: Record<string, AttendanceStatus> = {};
    records.forEach((r) => (map[r.studentId] = r.status));
    setStatuses((prev) => ({ ...map, ...prev }));
  };

  const setStatus = (studentId: string, status: AttendanceStatus) => {
    setStatuses((prev) => ({ ...prev, [studentId]: status }));
  };

  const save = async () => {
    setSaving(true);
    const entries = students.map((s) => ({
      studentId: s.id,
      status: statuses[s.id] || "present",
    }));
    await markAttendance(batchId, date, entries);
    await refreshExisting();
    setSaving(false);
  };

  const statusColor = (s?: AttendanceStatus) =>
    s === "present" ? "bg-emerald-600" : s === "late" ? "bg-amber-500" : s === "absent" ? "bg-rose-600" : "bg-slate-200";

  const loadReport = async () => {
    setReportLoading(true);
    try {
      const rows = await getAttendanceReport({
        batchId: reportBatchId || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        studentName: studentName || undefined,
      });
      setReport(rows);
    } finally {
      setReportLoading(false);
    }
  };

  useEffect(() => {
    loadReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openStudentDetail = async (studentId: string) => {
    setDetailLoading(true);
    try {
      const d = await getStudentFullDetail(studentId, reportBatchId || undefined);
      setDetail(d);
    } finally {
      setDetailLoading(false);
    }
  };

  const exportToExcel = () => {
    const header = ["Name", "Email", "Total Lectures", "Missed", "Online", "Offline"];
    const lines = report.map((r) => [
      r.studentName, r.studentEmail, r.totalLectures, r.missedLectures, r.onlineLectures, r.offlineLectures,
    ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","));
    const csv = [header.join(","), ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "attendance_report.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-10">
      {/* ── Faculty attendance — Manager only ─────────────────────────────── */}
      {isManager && (
        <div>
          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <h1 className="text-2xl font-semibold text-slate-800">Faculty Attendance</h1>
            <input type="date" className="border border-slate-300 rounded-lg px-3 py-2 text-sm"
              value={staffDate} onChange={(e) => setStaffDate(e.target.value)} />
          </div>
          <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
            {staffList.map((s) => (
              <div key={s.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-slate-800">{s.name}</p>
                  <p className="text-xs text-slate-400">{s.email}</p>
                </div>
                <div className="flex gap-2">
                  {(["present", "late", "absent"] as AttendanceStatus[]).map((st) => (
                    <button key={st} onClick={() => setStaffStatus(s.id, st)}
                      className={`text-xs px-3 py-1.5 rounded-full capitalize ${
                        staffStatuses[s.id] === st
                          ? st === "present" ? "bg-emerald-600 text-white" : st === "late" ? "bg-amber-500 text-white" : "bg-rose-600 text-white"
                          : "bg-slate-200 text-slate-500"
                      }`}>
                      {st}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            {staffList.length === 0 && <p className="px-4 py-3 text-sm text-slate-400">No faculty/trainer accounts found.</p>}
          </div>
          {staffList.length > 0 && (
            <button onClick={saveStaffAttendance} disabled={savingStaff}
              className="mt-4 bg-indigo-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
              {savingStaff ? "Saving…" : "Save Faculty Attendance"}
            </button>
          )}
        </div>
      )}

      {/* ── Mark attendance ─────────────────────────────────────────────── */}
      <div>
        <h1 className="text-2xl font-semibold text-slate-800 mb-4">Mark Attendance</h1>
        <div className="flex gap-4 mb-6 flex-wrap">
          <select
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm"
            value={batchId}
            onChange={(e) => setBatchId(e.target.value)}
          >
            <option value="">Select batch</option>
            {batches.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
          <input
            type="date"
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>

        {batchId && (
          <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
            {students.map((s) => (
              <div key={s.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-slate-800">{s.name}</p>
                  <p className="text-xs text-slate-400">{s.email}{s.phone ? ` · ${s.phone}` : ""}</p>
                </div>
                <div className="flex gap-2">
                  {(["present", "late", "absent"] as AttendanceStatus[]).map((st) => (
                    <button
                      key={st}
                      onClick={() => setStatus(s.id, st)}
                      className={`text-xs px-3 py-1.5 rounded-full text-white capitalize ${
                        statuses[s.id] === st ? statusColor(st) : "bg-slate-200 text-slate-500"
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            {students.length === 0 && (
              <p className="px-4 py-3 text-sm text-slate-400">No students in this batch.</p>
            )}
          </div>
        )}

        {batchId && students.length > 0 && (
          <button
            onClick={save}
            disabled={saving}
            className="mt-4 bg-indigo-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save Attendance"}
          </button>
        )}

        <p className="text-xs text-slate-400 mt-3">
          Face-recognition auto-marking is available via a separate hook (see AIRA project) —
          this manual view lets faculty record or override attendance directly.
        </p>
      </div>

      {/* ── Attendance report ────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-semibold text-slate-800">Attendance Report</h2>
          <button onClick={exportToExcel} disabled={report.length === 0}
            className="text-sm px-4 py-2 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 disabled:opacity-40">
            ⬇ Export to Excel
          </button>
        </div>

        <div className="flex gap-3 flex-wrap mb-4">
          <select
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm"
            value={reportBatchId}
            onChange={(e) => setReportBatchId(e.target.value)}
          >
            <option value="">All batches</option>
            {batches.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
          <input type="date" className="border border-slate-300 rounded-lg px-3 py-2 text-sm"
            value={startDate} onChange={(e) => setStartDate(e.target.value)} placeholder="Start date" />
          <input type="date" className="border border-slate-300 rounded-lg px-3 py-2 text-sm"
            value={endDate} onChange={(e) => setEndDate(e.target.value)} placeholder="End date" />
          <input type="text" placeholder="Student name" className="border border-slate-300 rounded-lg px-3 py-2 text-sm"
            value={studentName} onChange={(e) => setStudentName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && loadReport()} />
          <button onClick={loadReport} className="text-sm px-4 py-2 bg-slate-100 text-slate-700 rounded-lg font-medium hover:bg-slate-200">
            Filter
          </button>
        </div>

        {reportLoading ? (
          <ArcLoader label="Loading attendance report" />
        ) : (
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3 text-left">Name</th>
                  <th className="px-4 py-3 text-left">Total Lectures</th>
                  <th className="px-4 py-3 text-left">Missed</th>
                  <th className="px-4 py-3 text-left">Online</th>
                  <th className="px-4 py-3 text-left">Offline</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {report.map((r) => (
                  <tr key={r.studentId} onClick={() => openStudentDetail(r.studentId)}
                    className="cursor-pointer hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-800">{r.studentName}</p>
                      <p className="text-xs text-slate-400">{r.studentEmail}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{r.totalLectures}</td>
                    <td className="px-4 py-3 text-slate-600">{r.missedLectures}</td>
                    <td className="px-4 py-3 text-slate-600">{r.onlineLectures}</td>
                    <td className="px-4 py-3 text-slate-600">{r.offlineLectures}</td>
                  </tr>
                ))}
                {report.length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-400">No attendance records match these filters.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Student detail modal ─────────────────────────────────────────── */}
      {(detail || detailLoading) && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setDetail(null)}>
          <div className="bg-white rounded-xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            {detailLoading || !detail ? (
              <ArcLoader label="Loading student detail" />
            ) : (
              <>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="font-semibold text-slate-800 text-lg">{detail.studentName}</h2>
                    <p className="text-xs text-slate-400">{detail.studentEmail}</p>
                  </div>
                  <button onClick={() => setDetail(null)} className="text-slate-400 hover:text-slate-600 text-xl leading-none">✕</button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <DetailStat label="Total Lectures" value={detail.totalLectures} />
                  <DetailStat label="Offline Lectures" value={detail.offlineLectures} />
                  <DetailStat label="Online Lectures" value={detail.onlineLectures} />
                  <DetailStat label="Assignments Submitted" value={detail.assignmentsSubmitted} />
                  <DetailStat label="Mocks Given" value={detail.mocksGiven} />
                  <DetailStat label="Rank in Batch" value={detail.rank ?? "—"} />
                  <DetailStat label="Overall Score" value={detail.score != null ? `${detail.score}%` : "—"} />
                  <DetailStat label="Assignments Score" value={detail.assignmentsScore ?? "—"} />
                  <DetailStat label="Mock Score" value={detail.mockScore ?? "—"} />
                  <DetailStat label="Batch" value={detail.batchName || "—"} />
                  <DetailStat label="Faculty" value={detail.facultyName || "—"} />
                  <DetailStat label="Jobs Applied" value={detail.jobsApplied} />
                  <DetailStat label="Jobs Rejected" value={detail.jobsRejected} />
                  <DetailStat label="Placement Status" value={
                    detail.placed
                      ? <span className="text-emerald-600 font-bold">Placed ✓</span>
                      : <span className="text-slate-500">Not placed</span>
                  } />
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
