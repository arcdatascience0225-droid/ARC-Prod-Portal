import { useEffect, useState, useRef } from "react";
import { getMyBatches, getBatchAnalytics, getBatchStudentPerformance } from "../../api/facultyApi";
import type { FacultyBatch, BatchAnalytics, StudentPerformanceRow, LeaderboardEntry } from "../../types";

// ─── Medal colours ────────────────────────────────────────────────────────────
const MEDALS = [
  {
    pos: 1,
    ring: "from-yellow-300 via-amber-400 to-yellow-500",
    glow: "shadow-yellow-300/60",
    crown: "text-yellow-500",
    bar: "bg-gradient-to-b from-yellow-400 to-amber-500",
    barH: "h-40",
    label: "1st",
    emoji: "👑",
    textRing: "ring-4 ring-yellow-400/60",
  },
  {
    pos: 2,
    ring: "from-slate-300 via-slate-400 to-slate-500",
    glow: "shadow-slate-300/60",
    crown: "text-slate-400",
    bar: "bg-gradient-to-b from-slate-300 to-slate-500",
    barH: "h-28",
    label: "2nd",
    emoji: "🥈",
    textRing: "ring-4 ring-slate-400/40",
  },
  {
    pos: 3,
    ring: "from-orange-300 via-amber-600 to-orange-700",
    glow: "shadow-orange-400/60",
    crown: "text-orange-500",
    bar: "bg-gradient-to-b from-orange-300 to-orange-600",
    barH: "h-20",
    label: "3rd",
    emoji: "🥉",
    textRing: "ring-4 ring-orange-400/40",
  },
] as const;

// ─── Tiny sparkline bar ───────────────────────────────────────────────────────
function ScoreBar({ score, max }: { score: number; max: number }) {
  const pct = max > 0 ? Math.round((score / max) * 100) : 0;
  const color =
    pct >= 75 ? "bg-emerald-500" : pct >= 50 ? "bg-amber-400" : pct >= 25 ? "bg-orange-400" : "bg-rose-500";
  return (
    <div className="flex items-center gap-2 min-w-0">
      <div className="h-1.5 flex-1 rounded-full bg-slate-100 overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-700 ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-slate-400 w-8 text-right">{pct}%</span>
    </div>
  );
}

// ─── Performance band pill ───────────────────────────────────────────────────
function Band({ score }: { score: number }) {
  if (score >= 80) return <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-semibold">Excellent</span>;
  if (score >= 60) return <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-sky-50 text-sky-700 font-semibold">Good</span>;
  if (score >= 40) return <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 font-semibold">Average</span>;
  return <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-rose-50 text-rose-700 font-semibold">Needs Help</span>;
}

// ─── Initials avatar ─────────────────────────────────────────────────────────
function Avatar({ name, size = "md" }: { name: string; size?: "sm" | "md" | "lg" }) {
  const initials = name.trim().split(/\s+/).map(w => w[0]?.toUpperCase() ?? "").join("").slice(0, 2);
  const palette = [
    "bg-violet-500","bg-blue-500","bg-cyan-500","bg-emerald-500",
    "bg-amber-500","bg-orange-500","bg-rose-500","bg-pink-500",
  ];
  const color = palette[name.charCodeAt(0) % palette.length];
  const sz = size === "lg" ? "w-14 h-14 text-lg" : size === "sm" ? "w-7 h-7 text-[10px]" : "w-9 h-9 text-sm";
  return (
    <div className={`${sz} ${color} rounded-full flex items-center justify-center font-bold text-white shrink-0`}>
      {initials}
    </div>
  );
}

// ─── Podium card ─────────────────────────────────────────────────────────────
function PodiumCard({ entry, medal, maxScore }: { entry: LeaderboardEntry; medal: typeof MEDALS[number]; maxScore: number }) {
  const pct = maxScore > 0 ? Math.round((entry.totalScore / maxScore) * 100) : 0;
  return (
    <div className="flex flex-col items-center gap-2">
      {/* Avatar + crown */}
      <div className="relative">
        <div
          className={`w-16 h-16 rounded-full bg-gradient-to-br ${medal.ring} p-0.5 shadow-xl ${medal.glow}`}
        >
          <div className="w-full h-full rounded-full bg-white flex items-center justify-center">
            <Avatar name={entry.studentName} size="lg" />
          </div>
        </div>
        <span className={`absolute -top-3 left-1/2 -translate-x-1/2 text-xl ${medal.crown}`}>
          {medal.emoji}
        </span>
        <span className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-white border-2 border-slate-100 flex items-center justify-center text-[10px] font-black text-slate-600`}>
          {medal.pos}
        </span>
      </div>

      {/* Name */}
      <div className="text-center max-w-[110px]">
        <p className="text-sm font-bold text-slate-800 leading-tight truncate">{entry.studentName}</p>
        <p className="text-xs text-slate-400">{entry.totalScore.toFixed(1)} pts · {pct}%</p>
      </div>

      {/* Podium bar */}
      <div className={`w-20 ${medal.barH} ${medal.bar} rounded-t-xl flex items-end justify-center pb-2 shadow-lg`}>
        <span className="text-white font-black text-lg drop-shadow">{medal.label}</span>
      </div>
    </div>
  );
}

// ─── Stat card ───────────────────────────────────────────────────────────────
function StatCard({ icon, label, value, sub, accent }: {
  icon: string; label: string; value: string | number; sub?: string; accent: string;
}) {
  return (
    <div className={`relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm`}>
      <div className={`absolute top-0 right-0 w-24 h-24 rounded-full ${accent} opacity-10 translate-x-6 -translate-y-6`} />
      <div className={`w-9 h-9 rounded-xl ${accent} flex items-center justify-center text-lg mb-3`}>{icon}</div>
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{label}</p>
      <p className="text-2xl font-black text-slate-800 mt-0.5">{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function StudentPerformancePage() {
  const [batches, setBatches] = useState<FacultyBatch[]>([]);
  const [batchId, setBatchId] = useState("");
  const [analytics, setAnalytics] = useState<BatchAnalytics | null>(null);
  const [rows, setRows] = useState<StudentPerformanceRow[]>([]);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<"avg" | "high" | "low" | "taken">("avg");
  const [loading, setLoading] = useState(false);

  useEffect(() => { getMyBatches().then(setBatches); }, []);

  useEffect(() => {
    if (!batchId) return;
    setLoading(true);
    Promise.all([
      getBatchAnalytics(batchId).then(setAnalytics),
      getBatchStudentPerformance(batchId).then(setRows),
    ]).finally(() => setLoading(false));
  }, [batchId]);

  const selectedBatch = batches.find(b => b.id === batchId);
  const top3 = analytics?.topPerformers?.slice(0, 3) ?? [];
  const maxScore = Math.max(...(analytics?.leaderboard?.map(e => e.totalScore) ?? [0]), 1);
  const needsAttention = analytics?.weakStudents?.length ?? 0;

  const filteredRows = rows
    .filter(r => r.studentName.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (sortKey === "avg") return b.averageScore - a.averageScore;
      if (sortKey === "high") return b.highestScore - a.highestScore;
      if (sortKey === "low") return a.lowestScore - b.lowestScore;
      return b.assessmentsTaken - a.assessmentsTaken;
    });

  // Podium order: 2nd | 1st | 3rd
  const podiumOrder = top3.length >= 2
    ? [top3[1], top3[0], top3[2]].filter(Boolean)
    : top3;
  const podiumMedals = top3.length >= 2
    ? [MEDALS[1], MEDALS[0], MEDALS[2]].filter((_, i) => i < podiumOrder.length)
    : [MEDALS[0]];

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-12">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pt-2">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Student Performance</h1>
          {selectedBatch && (
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs font-bold px-2 py-0.5 bg-primary/10 text-primary rounded-full">
                NOW VIEWING
              </span>
              <span className="text-sm font-semibold text-slate-700">{selectedBatch.name}</span>
              {selectedBatch.course && (
                <span className="text-xs text-slate-400">{selectedBatch.course}</span>
              )}
            </div>
          )}
        </div>
        <select
          className="border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-medium bg-white shadow-sm focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none min-w-[180px]"
          value={batchId}
          onChange={e => { setBatchId(e.target.value); setAnalytics(null); setRows([]); }}
        >
          <option value="">Select a batch…</option>
          {batches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-20 text-slate-400">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mr-3" />
          Loading performance data…
        </div>
      )}

      {!loading && batchId && !analytics && (
        <div className="text-center py-20 text-slate-400">No performance data yet for this batch.</div>
      )}

      {analytics && !loading && (
        <>
          {/* ── Stat cards ── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard icon="👥" label="Total Students" value={analytics.totalStudents}
              sub="enrolled in batch" accent="bg-blue-500" />
            <StatCard icon="📊" label="Batch Average"
              value={`${analytics.averageScore.toFixed(1)}`}
              sub="out of assessments taken" accent="bg-violet-500" />
            <StatCard icon="🏆" label="Top Performer"
              value={analytics.topPerformers[0]?.studentName || "—"}
              sub={analytics.topPerformers[0] ? `${analytics.topPerformers[0].totalScore.toFixed(1)} pts` : ""}
              accent="bg-amber-400" />
            <StatCard icon="⚠️" label="Needs Attention"
              value={needsAttention}
              sub="students below average" accent="bg-rose-500" />
          </div>

          {/* ── Podium ── */}
          {top3.length > 0 && (
            <div className="rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-50 via-white to-indigo-50/30 p-8 shadow-sm">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h2 className="text-lg font-black text-slate-800">Top 3 Performers</h2>
                  <p className="text-xs text-slate-400 mt-0.5">This batch's medal table</p>
                </div>
                <span className="text-xs font-semibold text-primary px-3 py-1.5 bg-primary/10 rounded-full flex items-center gap-1">
                  🔄 Live standings
                </span>
              </div>

              {/* Podium: 2nd | 1st | 3rd */}
              <div className="flex items-end justify-center gap-6">
                {podiumOrder.map((entry, i) => entry && (
                  <PodiumCard key={entry.studentId} entry={entry} medal={podiumMedals[i]} maxScore={maxScore} />
                ))}
              </div>
            </div>
          )}

          {/* ── Score spotlight ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top performers */}
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
                <span className="text-base">🌟</span>
                <h3 className="font-bold text-slate-800 text-sm">Score Spotlight</h3>
                <span className="text-xs text-slate-400 ml-auto">Top performers vs. students who need a nudge</span>
              </div>
              <div className="divide-y divide-slate-50">
                {analytics.topPerformers.map((e, i) => (
                  <div key={e.studentId} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50 transition-colors">
                    <span className="text-base w-5 text-center">
                      {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}.`}
                    </span>
                    <Avatar name={e.studentName} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-700 truncate">{e.studentName}</p>
                      <ScoreBar score={e.totalScore} max={maxScore} />
                    </div>
                    <span className="text-sm font-black text-slate-800">{e.totalScore.toFixed(1)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Performance bands */}
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
                <span className="text-base">📉</span>
                <h3 className="font-bold text-slate-800 text-sm">Needs Attention</h3>
                <span className="text-xs text-slate-400 ml-auto">Students who may need extra support</span>
              </div>
              <div className="divide-y divide-slate-50">
                {analytics.weakStudents.length === 0 ? (
                  <div className="px-5 py-8 text-center text-sm text-slate-400">All students are performing well! 🎉</div>
                ) : analytics.weakStudents.map((e) => (
                  <div key={e.studentId} className="flex items-center gap-3 px-5 py-3 hover:bg-rose-50/50 transition-colors">
                    <span className="text-base">⚠️</span>
                    <Avatar name={e.studentName} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-700 truncate">{e.studentName}</p>
                      <ScoreBar score={e.totalScore} max={maxScore} />
                    </div>
                    <span className="text-sm font-black text-rose-600">{e.totalScore.toFixed(1)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── Full leaderboard ── */}
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center gap-3">
              <div>
                <h3 className="font-bold text-slate-800">Full Leaderboard</h3>
                <p className="text-xs text-slate-400 mt-0.5">{analytics.leaderboard.length} students ranked</p>
              </div>
              <div className="sm:ml-auto flex items-center gap-2 flex-wrap">
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search student…"
                  className="border border-slate-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/30 w-40"
                />
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 text-left">
                    <th className="px-5 py-3 text-xs font-bold uppercase tracking-wider text-slate-400 w-14">Rank</th>
                    <th className="px-5 py-3 text-xs font-bold uppercase tracking-wider text-slate-400">Student</th>
                    <th className="px-5 py-3 text-xs font-bold uppercase tracking-wider text-slate-400 text-right">Score</th>
                    <th className="px-5 py-3 text-xs font-bold uppercase tracking-wider text-slate-400 hidden md:table-cell">Progress</th>
                    <th className="px-5 py-3 text-xs font-bold uppercase tracking-wider text-slate-400 hidden sm:table-cell">Band</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {analytics.leaderboard
                    .filter(e => e.studentName.toLowerCase().includes(search.toLowerCase()))
                    .map((e, i) => {
                      const isTop3 = e.rank <= 3;
                      return (
                        <tr key={e.studentId} className={`transition-colors hover:bg-slate-50 ${isTop3 ? "bg-amber-50/30" : ""}`}>
                          <td className="px-5 py-3">
                            <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-black ${
                              e.rank === 1 ? "bg-yellow-100 text-yellow-700" :
                              e.rank === 2 ? "bg-slate-100 text-slate-600" :
                              e.rank === 3 ? "bg-orange-100 text-orange-600" :
                              "text-slate-400"
                            }`}>
                              {e.rank <= 3 ? ["🥇","🥈","🥉"][e.rank - 1] : e.rank}
                            </span>
                          </td>
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-2.5">
                              <Avatar name={e.studentName} size="sm" />
                              <span className="font-semibold text-slate-700">{e.studentName}</span>
                            </div>
                          </td>
                          <td className="px-5 py-3 text-right">
                            <span className="font-black text-slate-800">{e.totalScore.toFixed(1)}</span>
                          </td>
                          <td className="px-5 py-3 hidden md:table-cell w-40">
                            <ScoreBar score={e.totalScore} max={maxScore} />
                          </td>
                          <td className="px-5 py-3 hidden sm:table-cell">
                            <Band score={maxScore > 0 ? (e.totalScore / maxScore) * 100 : 0} />
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── Per-student detail ── */}
          {rows.length > 0 && (
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center gap-3">
                <div>
                  <h3 className="font-bold text-slate-800">Per-student Detail</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Assessment breakdown for each student</p>
                </div>
                <div className="sm:ml-auto flex items-center gap-2">
                  <span className="text-xs text-slate-400">Sort by</span>
                  {(["avg","high","taken"] as const).map(k => (
                    <button key={k} onClick={() => setSortKey(k)}
                      className={`text-xs px-2.5 py-1 rounded-lg font-medium transition ${
                        sortKey === k ? "bg-primary text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                      }`}>
                      {k === "avg" ? "Avg" : k === "high" ? "Best" : "Tests"}
                    </button>
                  ))}
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50">
                      <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-400">Student</th>
                      <th className="px-5 py-3 text-right text-xs font-bold uppercase tracking-wider text-slate-400">Tests</th>
                      <th className="px-5 py-3 text-right text-xs font-bold uppercase tracking-wider text-slate-400">Avg</th>
                      <th className="px-5 py-3 text-right text-xs font-bold uppercase tracking-wider text-slate-400">Best</th>
                      <th className="px-5 py-3 text-right text-xs font-bold uppercase tracking-wider text-slate-400">Lowest</th>
                      <th className="px-5 py-3 hidden md:table-cell text-xs font-bold uppercase tracking-wider text-slate-400">Trend</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {filteredRows.map(r => (
                      <tr key={r.studentId} className="hover:bg-slate-50 transition-colors">
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2.5">
                            <Avatar name={r.studentName} size="sm" />
                            <span className="font-semibold text-slate-700">{r.studentName}</span>
                          </div>
                        </td>
                        <td className="px-5 py-3 text-right text-slate-500">{r.assessmentsTaken}</td>
                        <td className="px-5 py-3 text-right font-bold text-slate-800">{r.averageScore.toFixed(1)}</td>
                        <td className="px-5 py-3 text-right">
                          <span className="text-emerald-600 font-bold">{r.highestScore.toFixed(1)}</span>
                        </td>
                        <td className="px-5 py-3 text-right">
                          <span className="text-rose-500 font-bold">{r.lowestScore.toFixed(1)}</span>
                        </td>
                        <td className="px-5 py-3 hidden md:table-cell w-36">
                          <ScoreBar score={r.averageScore} max={maxScore} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* Empty state */}
      {!batchId && !loading && (
        <div className="text-center py-24">
          <div className="text-5xl mb-4">📊</div>
          <h2 className="text-lg font-bold text-slate-700">Select a batch to view performance</h2>
          <p className="text-sm text-slate-400 mt-1">Leaderboard, medal table and student breakdown will appear here.</p>
        </div>
      )}
    </div>
  );
}
