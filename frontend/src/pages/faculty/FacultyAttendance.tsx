import { useEffect, useState } from "react";
import {
  getStaffOnDate, DateLookupResult,
  getStaffBreakdown, StaffAttendanceBreakdown,
} from "../../api/facultyApi";
import ArcLoader from "../../components/ArcLoader";
import { AttendanceStatus } from "../../types";
import { api } from "../../services/api";

function prettyDate(iso: string) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
}
const todayIso = () => new Date().toISOString().slice(0, 10);

export default function FacultyAttendancePage() {
  const [staffList, setStaffList] = useState<{ id: string; name: string; email: string }[]>([]);
  const [staffDate, setStaffDate] = useState<string>(todayIso());
  const [staffStatuses, setStaffStatuses] = useState<Record<string, AttendanceStatus>>({});
  const [staffReasons, setStaffReasons] = useState<Record<string, string>>({});
  const [savingStaff, setSavingStaff] = useState(false);
  const [staffDetailId, setStaffDetailId] = useState<string | null>(null);
  const [staffBreakdown, setStaffBreakdown] = useState<StaffAttendanceBreakdown | null>(null);
  const [staffDetailLoading, setStaffDetailLoading] = useState(false);
  const [staffLookupDate, setStaffLookupDate] = useState(todayIso());
  const [staffLookupResult, setStaffLookupResult] = useState<DateLookupResult | null>(null);

  useEffect(() => {
    api.get<{ id: string; name: string; email: string }[]>("/api/v1/attendance/staff-list").then((r) => setStaffList(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    api.get<{ staffId: string; status: AttendanceStatus; reason: string | null }[]>("/api/v1/attendance/staff", { params: { for_date: staffDate } })
      .then((r) => {
        const map: Record<string, AttendanceStatus> = {};
        const reasonMap: Record<string, string> = {};
        r.data.forEach((row) => { map[row.staffId] = row.status; if (row.reason) reasonMap[row.staffId] = row.reason; });
        setStaffStatuses(map);
        setStaffReasons(reasonMap);
      })
      .catch(() => {});
  }, [staffDate]);

  const setStaffStatus = (staffId: string, status: AttendanceStatus) => {
    setStaffStatuses((prev) => ({ ...prev, [staffId]: status }));
    if (status === "present") setStaffReasons((prev) => { const n = { ...prev }; delete n[staffId]; return n; });
  };
  const setStaffReason = (staffId: string, reason: string) => setStaffReasons((prev) => ({ ...prev, [staffId]: reason }));

  const saveStaffAttendance = async () => {
    setSavingStaff(true);
    try {
      await Promise.all(
        staffList.map((s) =>
          api.post("/api/v1/attendance/staff", {
            staffId: s.id, date: staffDate, status: staffStatuses[s.id] || "present",
            reason: staffReasons[s.id] || undefined,
          })
        )
      );
    } finally {
      setSavingStaff(false);
    }
  };

  const openStaffDetail = async (staffId: string) => {
    setStaffDetailId(staffId);
    setStaffDetailLoading(true);
    setStaffLookupResult(null);
    try {
      const b = await getStaffBreakdown(staffId);
      setStaffBreakdown(b);
    } finally {
      setStaffDetailLoading(false);
    }
  };
  const closeStaffDetail = () => { setStaffDetailId(null); setStaffBreakdown(null); setStaffLookupResult(null); };
  const lookupStaffDate = async () => {
    if (!staffDetailId) return;
    const r = await getStaffOnDate(staffDetailId, staffLookupDate);
    setStaffLookupResult(r);
  };

  const exportStaffToExcel = () => {
    const header = ["Name", "Email", "Date", "Status"];
    const lines = staffList.map((s) => [
      s.name, s.email, staffDate, staffStatuses[s.id] || "not marked",
    ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","));
    const csv = [header.join(","), ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `faculty_attendance_${staffDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <h1 className="text-2xl font-semibold text-slate-800">Faculty Attendance</h1>
        <div className="flex items-center gap-2">
          <input type="date" className="border border-slate-300 rounded-lg px-3 py-2 text-sm"
            value={staffDate} onChange={(e) => setStaffDate(e.target.value)} />
          <button onClick={exportStaffToExcel} disabled={staffList.length === 0}
            className="bg-slate-100 text-slate-700 px-3 py-2 rounded-lg text-sm font-medium hover:bg-slate-200 disabled:opacity-50">
            ⬇ Export
          </button>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
        {staffList.map((s) => (
          <div key={s.id} className="px-4 py-3">
            <div className="flex items-center justify-between">
              <button onClick={() => openStaffDetail(s.id)} className="text-left hover:underline">
                <p className="text-sm font-medium text-slate-800">{s.name}</p>
                <p className="text-xs text-slate-400">{s.email}</p>
              </button>
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
            {(staffStatuses[s.id] === "absent" || staffStatuses[s.id] === "late") && (
              <input placeholder="Reason (optional)" value={staffReasons[s.id] || ""}
                onChange={(e) => setStaffReason(s.id, e.target.value)}
                className="mt-2 w-full border border-slate-200 rounded-lg px-3 py-1.5 text-xs" />
            )}
          </div>
        ))}
        {staffList.length === 0 && <p className="px-4 py-3 text-sm text-slate-400">No faculty/trainer accounts found.</p>}
      </div>
      <p className="text-xs text-slate-400">Tap a name to see their full attendance history.</p>
      {staffList.length > 0 && (
        <button onClick={saveStaffAttendance} disabled={savingStaff}
          className="bg-indigo-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
          {savingStaff ? "Saving…" : "Save Faculty Attendance"}
        </button>
      )}

      {/* ── Staff detail modal ───────────────────────────────────────────── */}
      {(staffDetailId || staffDetailLoading) && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={closeStaffDetail}>
          <div className="bg-white rounded-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            {staffDetailLoading || !staffBreakdown ? (
              <ArcLoader label="Loading attendance history" />
            ) : (
              <>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-semibold text-slate-800 text-lg">
                    {staffList.find((s) => s.id === staffDetailId)?.name || "Faculty"}
                  </h2>
                  <button onClick={closeStaffDetail} className="text-slate-400 hover:text-slate-600 text-xl leading-none">✕</button>
                </div>

                <div className="bg-slate-50 rounded-xl p-4 mb-4 flex items-center justify-between">
                  <div className="grid grid-cols-3 gap-4 flex-1">
                    <div><p className="text-[10px] text-slate-400 uppercase font-semibold">Present</p><p className="text-lg font-bold text-emerald-600">{staffBreakdown.present}</p></div>
                    <div><p className="text-[10px] text-slate-400 uppercase font-semibold">Absent</p><p className="text-lg font-bold text-rose-600">{staffBreakdown.absent}</p></div>
                    <div><p className="text-[10px] text-slate-400 uppercase font-semibold">Late</p><p className="text-lg font-bold text-amber-600">{staffBreakdown.late}</p></div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-black text-slate-800">{staffBreakdown.percent == null ? "—" : `${staffBreakdown.percent}%`}</p>
                    <p className="text-xs text-slate-400">{staffBreakdown.total} days</p>
                  </div>
                </div>

                <h3 className="text-xs uppercase font-semibold text-slate-400 mb-2">Check a specific date</h3>
                <div className="flex gap-2 mb-4">
                  <input type="date" value={staffLookupDate} onChange={(e) => setStaffLookupDate(e.target.value)}
                    className="border border-slate-200 rounded-lg px-3 py-2 text-sm flex-1" />
                  <button onClick={lookupStaffDate} className="text-sm px-4 py-2 bg-amber-500 text-white rounded-lg font-medium">Check</button>
                </div>
                {staffLookupResult && (
                  <div className="mb-4 bg-slate-50 rounded-lg px-3 py-2 text-sm flex items-center justify-between">
                    <span className={`font-semibold capitalize ${
                      staffLookupResult.status === "present" ? "text-emerald-600" : staffLookupResult.status === "late" ? "text-amber-600" :
                      staffLookupResult.status === "absent" ? "text-rose-600" : "text-slate-400"
                    }`}>
                      {staffLookupResult.status === "not_marked" ? "Not marked" : staffLookupResult.status}
                    </span>
                    {staffLookupResult.reason && <span className="text-xs text-slate-400">{staffLookupResult.reason}</span>}
                  </div>
                )}

                {staffBreakdown.months.length > 0 && (
                  <div className="mb-5">
                    <h3 className="text-xs uppercase font-semibold text-slate-400 mb-2">Month by month</h3>
                    <div className="bg-slate-50 rounded-lg divide-y divide-white">
                      {staffBreakdown.months.map((m) => (
                        <div key={m.month} className="flex items-center justify-between px-3 py-2 text-sm">
                          <div>
                            <p className="font-medium text-slate-700">{new Date(m.month + "-01").toLocaleDateString(undefined, { month: "long", year: "numeric" })}</p>
                            <p className="text-xs text-slate-400">{m.absent} absent · {m.late} late · {m.total} days</p>
                          </div>
                          <span className="font-semibold text-slate-700">{m.percent == null ? "—" : `${m.percent}%`}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {staffBreakdown.absences.length > 0 && (
                  <div>
                    <h3 className="text-xs uppercase font-semibold text-slate-400 mb-2">Every absence / late</h3>
                    <div className="bg-slate-50 rounded-lg divide-y divide-white">
                      {staffBreakdown.absences.map((a, i) => (
                        <div key={i} className="flex items-center gap-3 px-3 py-2 text-sm">
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
