import { useEffect, useState } from "react";
import {
  getMyBatches, getBatchStudents, markAttendance, getBatchAttendance,
  getAttendanceReport, getStudentFullDetail, AttendanceReportRow, StudentFullDetail,
  listHolidays, addHoliday, removeHoliday, Holiday,
  getMonthGrid, MonthGrid,
  getStudentBreakdown, AttendanceBreakdown,
  getStudentOnDate, DateLookupResult,
  getAttendanceAnalytics, AttendanceAnalytics,
} from "../../api/facultyApi";
import ArcLoader from "../../components/ArcLoader";
import { FacultyBatch, StudentInBatch, AttendanceStatus, AttendanceRecord } from "../../types";
import { api } from "../../services/api";
import { BarChart, Bar, PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

const PIE_COLORS = { present: "#10b981", absent: "#e11d48", late: "#f59e0b" };
const REASONS = ["Sick", "Family function", "Travel", "No transport", "Other"];
type Mode = "online" | "offline";

function DetailStat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="bg-slate-50 rounded-lg p-3">
      <p className="text-[10px] text-slate-400 uppercase font-semibold">{label}</p>
      <p className="text-sm font-bold text-slate-800 mt-0.5">{value}</p>
    </div>
  );
}

function shiftDate(iso: string, days: number) {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
function prettyDate(iso: string) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
}
const todayIso = () => new Date().toISOString().slice(0, 10);

export default function StudentAttendancePage() {
  // ── Shared: batches ───────────────────────────────────────────────────────
  const [batches, setBatches] = useState<FacultyBatch[]>([]);
  useEffect(() => { getMyBatches().then(setBatches).catch(() => {}); }, []);

  // ── Tabs ──────────────────────────────────────────────────────────────────
  const [tab, setTab] = useState<"take" | "month" | "report" | "analytics">("take");

  // ── Analytics ─────────────────────────────────────────────────────────────
  const [analyticsBatchId, setAnalyticsBatchId] = useState("");
  const [analytics, setAnalytics] = useState<AttendanceAnalytics | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  useEffect(() => {
    if (tab !== "analytics") return;
    setAnalyticsLoading(true);
    getAttendanceAnalytics(analyticsBatchId || undefined, 30).then(setAnalytics).finally(() => setAnalyticsLoading(false));
  }, [tab, analyticsBatchId]);

  // ── Take attendance ───────────────────────────────────────────────────────
  const [batchId, setBatchId] = useState<string>("");
  const [students, setStudents] = useState<StudentInBatch[]>([]);
  const [date, setDate] = useState<string>(todayIso());
  const [mode, setMode] = useState<Mode>("offline");
  const [statuses, setStatuses] = useState<Record<string, AttendanceStatus>>({});
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  const [uploadingFor, setUploadingFor] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [, setExisting] = useState<AttendanceRecord[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [addingHoliday, setAddingHoliday] = useState(false);
  const [holidayLabel, setHolidayLabel] = useState("");

  useEffect(() => {
    if (!batchId) return;
    getBatchStudents(batchId).then(setStudents);
    refreshExisting();
    listHolidays(batchId).then(setHolidays).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batchId, date, mode]);

  const refreshExisting = async () => {
    if (!batchId) return;
    const records = (await getBatchAttendance(batchId, date)).filter((r) => r.mode === mode);
    setExisting(records);
    const map: Record<string, AttendanceStatus> = {};
    const reasonMap: Record<string, string> = {};
    const photoMap: Record<string, string> = {};
    records.forEach((r) => {
      map[r.studentId] = r.status;
      if (r.reason) reasonMap[r.studentId] = r.reason;
      if (r.photoUrl) photoMap[r.studentId] = r.photoUrl;
    });
    setStatuses(map);
    setReasons(reasonMap);
    setPhotoUrls(photoMap);
  };

  const todaysHoliday = holidays.find((h) => h.date === date);

  const setStatus = (studentId: string, status: AttendanceStatus) => {
    setStatuses((prev) => ({ ...prev, [studentId]: status }));
    if (status === "present") {
      setReasons((prev) => { const n = { ...prev }; delete n[studentId]; return n; });
      setPhotoUrls((prev) => { const n = { ...prev }; delete n[studentId]; return n; });
    }
  };
  const setReason = (studentId: string, reason: string) => setReasons((prev) => ({ ...prev, [studentId]: reason }));

  const uploadNotePhoto = async (studentId: string, file: File) => {
    setUploadingFor(studentId);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const up = await api.post("/api/v1/uploads/file", fd, { headers: { "Content-Type": "multipart/form-data" } });
      setPhotoUrls((prev) => ({ ...prev, [studentId]: up.data.url }));
    } finally {
      setUploadingFor(null);
    }
  };

  const markAllPresent = () => {
    const map: Record<string, AttendanceStatus> = {};
    students.forEach((s) => (map[s.id] = "present"));
    setStatuses(map);
    setReasons({});
    setPhotoUrls({});
  };

  const save = async () => {
    setSaving(true);
    const entries = students.map((s) => ({
      studentId: s.id,
      status: statuses[s.id] || "present",
      reason: reasons[s.id] || undefined,
      photoUrl: photoUrls[s.id] || undefined,
    }));
    await markAttendance(batchId, date, entries, mode);
    await refreshExisting();
    setSaving(false);
  };

  const markHoliday = async () => {
    if (!holidayLabel.trim()) return;
    await addHoliday(date, holidayLabel.trim(), batchId);
    setHolidayLabel("");
    setAddingHoliday(false);
    listHolidays(batchId).then(setHolidays);
  };
  const unmarkHoliday = async () => {
    if (!todaysHoliday) return;
    await removeHoliday(todaysHoliday.id);
    listHolidays(batchId).then(setHolidays);
  };

  const statusColor = (s?: AttendanceStatus) =>
    s === "present" ? "bg-emerald-600" : s === "late" ? "bg-amber-500" : s === "absent" ? "bg-rose-600" : "bg-slate-200";

  const presentCount = students.filter((s) => statuses[s.id] === "present" || statuses[s.id] === "late").length;
  const absentCount = students.filter((s) => statuses[s.id] === "absent").length;
  const leftCount = students.length - students.filter((s) => statuses[s.id]).length;

  // ── Month view ────────────────────────────────────────────────────────────
  const [monthBatchId, setMonthBatchId] = useState("");
  const [month, setMonth] = useState<string>(new Date().toISOString().slice(0, 7));
  const [grid, setGrid] = useState<MonthGrid | null>(null);
  const [gridLoading, setGridLoading] = useState(false);

  useEffect(() => {
    if (!monthBatchId) return;
    setGridLoading(true);
    const [y, m] = month.split("-").map(Number);
    getMonthGrid(monthBatchId, y, m).then(setGrid).finally(() => setGridLoading(false));
  }, [monthBatchId, month]);

  const shiftMonth = (delta: number) => {
    const [y, m] = month.split("-").map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  };

  const exportMonthCsv = () => {
    if (!grid) return;
    const header = ["Student", ...grid.dates.map((d) => prettyDate(d)), "%"];
    const lines = grid.rows.map((r) => [r.studentName, ...r.cells, r.percent == null ? "" : `${r.percent}%`]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","));
    const csv = [header.join(","), ...lines].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `attendance_${month}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Report ────────────────────────────────────────────────────────────────
  const [reportBatchId, setReportBatchId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [studentName, setStudentName] = useState("");
  const [report, setReport] = useState<AttendanceReportRow[]>([]);
  const [reportLoading, setReportLoading] = useState(false);
  const [detail, setDetail] = useState<StudentFullDetail | null>(null);
  const [breakdown, setBreakdown] = useState<AttendanceBreakdown | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [lookupDate, setLookupDate] = useState(todayIso());
  const [lookupResult, setLookupResult] = useState<DateLookupResult | null>(null);
  const [detailStudentId, setDetailStudentId] = useState<string | null>(null);

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
    setDetailStudentId(studentId);
    setDetailLoading(true);
    setLookupResult(null);
    try {
      const [d, b] = await Promise.all([
        getStudentFullDetail(studentId, reportBatchId || undefined),
        getStudentBreakdown(studentId, reportBatchId || undefined),
      ]);
      setDetail(d);
      setBreakdown(b);
    } finally {
      setDetailLoading(false);
    }
  };

  const closeDetail = () => { setDetail(null); setBreakdown(null); setDetailStudentId(null); setLookupResult(null); };
  const lookupStudentDate = async () => {
    if (!detailStudentId) return;
    const r = await getStudentOnDate(detailStudentId, lookupDate);
    setLookupResult(r);
  };

  const shareSummary = () => {
    if (!detail || !breakdown) return;
    const text = `${detail.studentName} — Attendance: ${breakdown.percent ?? "—"}% (Present ${breakdown.present}, Absent ${breakdown.absent}, Late ${breakdown.late})`;
    if (navigator.share) navigator.share({ text }).catch(() => {});
    else { navigator.clipboard.writeText(text); alert("Summary copied to clipboard"); }
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

  const cellClass = (v: string) =>
    v === "present" ? "text-emerald-600 font-semibold" : v === "late" ? "text-amber-600 font-semibold" :
    v === "absent" ? "text-rose-600 font-bold" : "text-slate-300";
  const cellLetter = (v: string) => (v === "present" ? "P" : v === "late" ? "L" : v === "absent" ? "A" : "·");

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <h1 className="text-2xl font-semibold text-slate-800">Student Attendance</h1>

      <div>
        <div className="flex gap-1 bg-slate-100 rounded-lg p-1 w-fit mb-6">
          {([["take", "Take Attendance"], ["month", "Month View"], ["report", "Students / Report"], ["analytics", "Analytics"]] as const).map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition ${
                tab === id ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"
              }`}>
              {label}
            </button>
          ))}
        </div>

        {/* ── Take attendance ─────────────────────────────────────────────── */}
        {tab === "take" && (
          <div>
            <div className="flex gap-4 mb-4 flex-wrap items-center">
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

              {batchId && (
                <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-2 py-1.5">
                  <button onClick={() => setDate(shiftDate(date, -1))} className="w-8 h-8 rounded-md hover:bg-slate-100 text-slate-500 font-bold">‹</button>
                  <div className="text-sm font-medium text-slate-700 min-w-[110px] text-center relative">
                    {prettyDate(date)}
                    <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
                      className="absolute inset-0 opacity-0 cursor-pointer" />
                  </div>
                  <button onClick={() => setDate(shiftDate(date, 1))} className="w-8 h-8 rounded-md hover:bg-slate-100 text-slate-500 font-bold">›</button>
                </div>
              )}
              {batchId && date !== todayIso() && (
                <button onClick={() => setDate(todayIso())} className="text-xs text-indigo-600 font-medium hover:underline">
                  Jump to today
                </button>
              )}

              {batchId && (
                <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
                  {(["offline", "online"] as Mode[]).map((m) => (
                    <button key={m} onClick={() => setMode(m)}
                      className={`px-3 py-1.5 rounded-md text-xs font-medium capitalize transition ${
                        mode === m ? "bg-white text-slate-800 shadow-sm" : "text-slate-500"
                      }`}>
                      {m}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {batchId && (
              todaysHoliday ? (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4">
                  <p className="font-semibold text-amber-800">{todaysHoliday.label}</p>
                  <p className="text-xs text-amber-600 mt-0.5">Marked as a holiday — left out of attendance percentages.</p>
                  <button onClick={unmarkHoliday} className="text-xs text-amber-700 font-medium hover:underline mt-2">Remove holiday</button>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-3 gap-3 mb-4">
                    <div className="bg-white border border-slate-200 rounded-xl p-3">
                      <p className="text-[10px] text-slate-400 uppercase font-semibold">Present</p>
                      <p className="text-xl font-bold text-emerald-600 mt-1">{presentCount}</p>
                    </div>
                    <div className="bg-white border border-slate-200 rounded-xl p-3">
                      <p className="text-[10px] text-slate-400 uppercase font-semibold">Absent</p>
                      <p className={`text-xl font-bold mt-1 ${absentCount ? "text-rose-600" : "text-slate-700"}`}>{absentCount}</p>
                    </div>
                    <div className="bg-white border border-slate-200 rounded-xl p-3">
                      <p className="text-[10px] text-slate-400 uppercase font-semibold">Left</p>
                      <p className="text-xl font-bold text-slate-700 mt-1">{leftCount}</p>
                    </div>
                  </div>

                  <div className="flex gap-2 mb-4">
                    <button onClick={markAllPresent} className="text-sm px-4 py-2 bg-amber-500 text-white rounded-lg font-medium hover:bg-amber-600">
                      Mark all present
                    </button>
                    {!addingHoliday ? (
                      <button onClick={() => setAddingHoliday(true)} className="text-sm px-4 py-2 bg-slate-100 text-slate-700 rounded-lg font-medium hover:bg-slate-200">
                        It's a holiday
                      </button>
                    ) : (
                      <div className="flex gap-2 flex-1">
                        <input autoFocus placeholder="e.g. Diwali" value={holidayLabel} onChange={(e) => setHolidayLabel(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && markHoliday()}
                          className="border border-slate-300 rounded-lg px-3 py-2 text-sm flex-1" />
                        <button onClick={markHoliday} className="text-sm px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium">Save</button>
                        <button onClick={() => setAddingHoliday(false)} className="text-sm px-3 py-2 text-slate-400">✕</button>
                      </div>
                    )}
                  </div>

                  <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
                    {students.map((s) => (
                      <div key={s.id} className="px-4 py-3">
                        <div className="flex items-center justify-between">
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

                        {(statuses[s.id] === "absent" || statuses[s.id] === "late") && (
                          <div className="mt-3 pt-3 border-t border-slate-100">
                            <div className="flex gap-1.5 flex-wrap mb-2">
                              {REASONS.map((r) => (
                                <button key={r} onClick={() => setReason(s.id, r)}
                                  className={`text-xs px-2.5 py-1 rounded-full border ${
                                    reasons[s.id] === r ? "bg-slate-800 text-white border-slate-800" : "bg-white text-slate-600 border-slate-200"
                                  }`}>
                                  {r}
                                </button>
                              ))}
                            </div>
                            <input placeholder="Or type the reason" value={reasons[s.id] || ""}
                              onChange={(e) => setReason(s.id, e.target.value)}
                              className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-xs" />
                            <div className="flex items-center gap-2 mt-2">
                              {photoUrls[s.id] ? (
                                <>
                                  <img src={photoUrls[s.id]} alt="note" className="w-12 h-12 rounded-lg object-cover border border-slate-200" />
                                  <button onClick={() => setPhotoUrls((prev) => { const n = { ...prev }; delete n[s.id]; return n; })}
                                    className="text-xs text-rose-600 font-medium">Remove photo</button>
                                </>
                              ) : (
                                <label className="text-xs text-slate-500 border border-dashed border-slate-300 rounded-lg px-3 py-1.5 cursor-pointer hover:bg-slate-50">
                                  {uploadingFor === s.id ? "Uploading…" : "Add photo of the note"}
                                  <input type="file" accept="image/*" className="hidden"
                                    onChange={(e) => e.target.files?.[0] && uploadNotePhoto(s.id, e.target.files[0])} />
                                </label>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                    {students.length === 0 && (
                      <p className="px-4 py-3 text-sm text-slate-400">No students in this batch.</p>
                    )}
                  </div>

                  {students.length > 0 && (
                    <button
                      onClick={save}
                      disabled={saving}
                      className="mt-4 bg-indigo-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
                    >
                      {saving ? "Saving…" : `Save ${mode === "online" ? "Online" : "Offline"} Attendance`}
                    </button>
                  )}
                  <p className="text-xs text-slate-400 mt-3">
                    Everyone taking attendance sees this update live. Online and offline sessions on the same day are kept separate — switch the toggle above before marking each one.
                  </p>
                </>
              )
            )}
          </div>
        )}

        {/* ── Month view ───────────────────────────────────────────────────── */}
        {tab === "month" && (
          <div>
            <div className="flex gap-4 mb-4 flex-wrap items-center">
              <select className="border border-slate-300 rounded-lg px-3 py-2 text-sm"
                value={monthBatchId} onChange={(e) => setMonthBatchId(e.target.value)}>
                <option value="">Select batch</option>
                {batches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
              {monthBatchId && (
                <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-2 py-1.5">
                  <button onClick={() => shiftMonth(-1)} className="w-8 h-8 rounded-md hover:bg-slate-100 text-slate-500 font-bold">‹</button>
                  <div className="text-sm font-medium text-slate-700 min-w-[130px] text-center relative">
                    {new Date(month + "-01").toLocaleDateString(undefined, { month: "long", year: "numeric" })}
                    <input type="month" value={month} onChange={(e) => setMonth(e.target.value)}
                      className="absolute inset-0 opacity-0 cursor-pointer" />
                  </div>
                  <button onClick={() => shiftMonth(1)} className="w-8 h-8 rounded-md hover:bg-slate-100 text-slate-500 font-bold">›</button>
                </div>
              )}
            </div>

            {!monthBatchId ? (
              <p className="text-sm text-slate-400">Pick a batch to see the month grid.</p>
            ) : gridLoading ? (
              <ArcLoader label="Loading month view" />
            ) : grid && grid.dates.length === 0 ? (
              <p className="text-sm text-slate-400">Nothing marked this month yet.</p>
            ) : grid ? (
              <>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="bg-white border border-slate-200 rounded-xl p-3">
                    <p className="text-[10px] text-slate-400 uppercase font-semibold">Class attendance</p>
                    <p className="text-xl font-bold text-slate-800 mt-1">{grid.classPercent == null ? "—" : `${grid.classPercent}%`}</p>
                  </div>
                  <div className="bg-white border border-slate-200 rounded-xl p-3">
                    <p className="text-[10px] text-slate-400 uppercase font-semibold">Absences</p>
                    <p className="text-xl font-bold text-rose-600 mt-1">{grid.absences}<span className="text-xs text-slate-400 font-normal ml-2">{grid.lates} late</span></p>
                  </div>
                </div>
                <button onClick={exportMonthCsv} className="text-sm px-4 py-2 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 mb-4">
                  ⬇ Export this month to Excel
                </button>
                <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
                  <table className="text-xs w-full">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="sticky left-0 bg-slate-50 px-3 py-2 text-left font-semibold text-slate-500 min-w-[140px]">Student</th>
                        {grid.dates.map((d) => (
                          <th key={d} className="px-2 py-2 text-center font-semibold text-slate-500">{new Date(d + "T00:00:00").getDate()}</th>
                        ))}
                        <th className="px-3 py-2 text-center font-semibold text-slate-500">%</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {grid.rows.map((r) => (
                        <tr key={r.studentId}>
                          <td className="sticky left-0 bg-white px-3 py-2 font-medium text-slate-700 whitespace-nowrap">{r.studentName}</td>
                          {r.cells.map((c, i) => (
                            <td key={i} className={`px-2 py-2 text-center ${cellClass(c)}`}>{cellLetter(c)}</td>
                          ))}
                          <td className="px-3 py-2 text-center font-semibold text-slate-700">{r.percent == null ? "—" : `${r.percent}%`}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : null}
          </div>
        )}

        {/* ── Report ───────────────────────────────────────────────────────── */}
        {tab === "report" && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-slate-500">{report.length} students shown · tap a row for their full record.</p>
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
        )}

        {/* ── Analytics ────────────────────────────────────────────────────── */}
        {tab === "analytics" && (
          <div>
            <select className="border border-slate-300 rounded-lg px-3 py-2 text-sm mb-6"
              value={analyticsBatchId} onChange={(e) => setAnalyticsBatchId(e.target.value)}>
              <option value="">All batches (last 30 days)</option>
              {batches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>

            {analyticsLoading ? (
              <ArcLoader label="Loading analytics" />
            ) : analytics ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white border border-slate-200 rounded-xl p-4">
                  <h3 className="text-sm font-semibold text-slate-700 mb-3">Present / Absent / Late split</h3>
                  <ResponsiveContainer width="100%" height={240}>
                    <PieChart>
                      <Pie
                        data={[
                          { name: "Present", value: analytics.pie.present },
                          { name: "Absent", value: analytics.pie.absent },
                          { name: "Late", value: analytics.pie.late },
                        ]}
                        dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label
                      >
                        <Cell fill={PIE_COLORS.present} />
                        <Cell fill={PIE_COLORS.absent} />
                        <Cell fill={PIE_COLORS.late} />
                      </Pie>
                      <Tooltip /><Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <div className="bg-white border border-slate-200 rounded-xl p-4">
                  <h3 className="text-sm font-semibold text-slate-700 mb-3">
                    {analyticsBatchId ? "Selected batch" : "Attendance % by batch"}
                  </h3>
                  {analytics.bar.length === 0 ? (
                    <p className="text-sm text-slate-400 flex items-center justify-center h-[240px]">
                      {analyticsBatchId ? "Pick \"All batches\" to compare across batches." : "No data in the last 30 days."}
                    </p>
                  ) : (
                    <ResponsiveContainer width="100%" height={240}>
                      <BarChart data={analytics.bar}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} domain={[0, 100]} />
                        <Tooltip />
                        <Bar dataKey="percent" fill="#4f46e5" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>

                <div className="bg-white border border-slate-200 rounded-xl p-4 lg:col-span-2">
                  <h3 className="text-sm font-semibold text-slate-700 mb-3">Daily attendance % trend (last 30 days)</h3>
                  {analytics.line.length === 0 ? (
                    <p className="text-sm text-slate-400 flex items-center justify-center h-[240px]">No data in the last 30 days.</p>
                  ) : (
                    <ResponsiveContainer width="100%" height={260}>
                      <LineChart data={analytics.line}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 11 }} domain={[0, 100]} />
                        <Tooltip />
                        <Line type="monotone" dataKey="percent" stroke="#4f46e5" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        )}
      </div>

      {/* ── Student detail modal ─────────────────────────────────────────── */}
      {(detail || detailLoading) && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={closeDetail}>
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
                  <button onClick={closeDetail} className="text-slate-400 hover:text-slate-600 text-xl leading-none">✕</button>
                </div>

                {breakdown && (
                  <div className="bg-slate-50 rounded-xl p-4 mb-4 flex items-center justify-between">
                    <div className="grid grid-cols-3 gap-4 flex-1">
                      <div><p className="text-[10px] text-slate-400 uppercase font-semibold">Present</p><p className="text-lg font-bold text-emerald-600">{breakdown.present}</p></div>
                      <div><p className="text-[10px] text-slate-400 uppercase font-semibold">Absent</p><p className="text-lg font-bold text-rose-600">{breakdown.absent}</p></div>
                      <div><p className="text-[10px] text-slate-400 uppercase font-semibold">Late</p><p className="text-lg font-bold text-amber-600">{breakdown.late}</p></div>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-black text-slate-800">{breakdown.percent == null ? "—" : `${breakdown.percent}%`}</p>
                      <p className="text-xs text-slate-400">{breakdown.total} lectures</p>
                    </div>
                  </div>
                )}

                <div className="flex gap-2 mb-4">
                  <button onClick={shareSummary} className="text-xs px-3 py-1.5 bg-amber-500 text-white rounded-lg font-medium">Share summary</button>
                  <button onClick={exportToExcel} className="text-xs px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg font-medium">Export to Excel</button>
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

                <div className="mt-5">
                  <h3 className="text-xs uppercase font-semibold text-slate-400 mb-2">Check a specific date</h3>
                  <div className="flex gap-2">
                    <input type="date" value={lookupDate} onChange={(e) => setLookupDate(e.target.value)}
                      className="border border-slate-200 rounded-lg px-3 py-2 text-sm flex-1" />
                    <button onClick={lookupStudentDate} className="text-sm px-4 py-2 bg-amber-500 text-white rounded-lg font-medium">Check</button>
                  </div>
                  {lookupResult && (
                    <div className="mt-2 bg-slate-50 rounded-lg px-3 py-2 text-sm flex items-center justify-between">
                      <span className={`font-semibold capitalize ${
                        lookupResult.status === "present" ? "text-emerald-600" : lookupResult.status === "late" ? "text-amber-600" :
                        lookupResult.status === "absent" ? "text-rose-600" : "text-slate-400"
                      }`}>
                        {lookupResult.status === "not_marked" ? "Not marked" : lookupResult.status}
                      </span>
                      {lookupResult.reason && <span className="text-xs text-slate-400">{lookupResult.reason}</span>}
                    </div>
                  )}
                </div>

                {breakdown && breakdown.months.length > 0 && (
                  <div className="mt-5">
                    <h3 className="text-xs uppercase font-semibold text-slate-400 mb-2">Month by month</h3>
                    <div className="bg-slate-50 rounded-lg divide-y divide-white">
                      {breakdown.months.map((m) => (
                        <div key={m.month} className="flex items-center justify-between px-3 py-2 text-sm">
                          <div>
                            <p className="font-medium text-slate-700">{new Date(m.month + "-01").toLocaleDateString(undefined, { month: "long", year: "numeric" })}</p>
                            <p className="text-xs text-slate-400">{m.absent} absent · {m.late} late · {m.total} lectures</p>
                          </div>
                          <span className="font-semibold text-slate-700">{m.percent == null ? "—" : `${m.percent}%`}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {breakdown && breakdown.absences.length > 0 && (
                  <div className="mt-5">
                    <h3 className="text-xs uppercase font-semibold text-slate-400 mb-2">Every absence / late</h3>
                    <div className="bg-slate-50 rounded-lg divide-y divide-white">
                      {breakdown.absences.map((a, i) => (
                        <div key={i} className="flex items-center gap-3 px-3 py-2 text-sm">
                          {a.photoUrl && <img src={a.photoUrl} alt="note" className="w-10 h-10 rounded-lg object-cover border border-slate-200 flex-none" />}
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-slate-700">{prettyDate(a.date)}</p>
                            <p className="text-xs text-slate-400 truncate">{a.reason || "No reason recorded"}</p>
                          </div>
                          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${a.status === "absent" ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-700"}`}>
                            {a.status === "absent" ? "Absent" : "Late"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
