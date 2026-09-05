import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { assessmentApi } from "../../api/studentApi";
import Timer from "../../components/Timer";
import QuestionNavigator from "../../components/QuestionNavigator";
import type { AssessmentAttempt as AttemptType, AnswerSubmit, AssessmentResult } from "../../types";

const MAX_VIOLATIONS = 3;
const SNAPSHOT_INTERVAL_MS = 37_000; // 37s - staggered to reduce CPU spikes
const API_ROOT = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";
const BASE = `${API_ROOT}/api/v1/student/assessments`;

const isFullscreen = () => Boolean(document.fullscreenElement || (document as any).webkitFullscreenElement);
const enterFullscreen = async () => {
  const el = document.documentElement as any;
  const fn = el.requestFullscreen || el.webkitRequestFullscreen || el.msRequestFullscreen;
  if (fn) await fn.call(el);
};
const exitFullscreen = () => {
  const d = document as any;
  const fn = d.exitFullscreen || d.webkitExitFullscreen || d.msExitFullscreen;
  if (fn && isFullscreen()) fn.call(d).catch(() => {});
};
const authHeader = () => ({ Authorization: `Bearer ${localStorage.getItem("accessToken") || ""}` });

// ── Watermark ─────────────────────────────────────────────────────────────────
function ExamWatermark({ studentName }: { studentName: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current; if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    canvas.width = window.innerWidth; canvas.height = window.innerHeight;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save(); ctx.rotate((-35 * Math.PI) / 180);
    ctx.font = "13px monospace"; ctx.fillStyle = "rgba(100,100,100,0.09)";
    const text = `EXAM PROTECTED | ${studentName} | DO NOT SCREENSHOT`;
    for (let y = -canvas.height; y < canvas.height * 2; y += 65)
      for (let x = -canvas.width; x < canvas.width * 2; x += 280)
        ctx.fillText(text, x, y);
    ctx.restore();
  }, [studentName]);
  return <canvas ref={ref} className="pointer-events-none fixed inset-0 z-40 select-none" style={{ mixBlendMode: "multiply" }} />;
}

// ── Webcam ────────────────────────────────────────────────────────────────────
function WebcamMonitor({ resultId, violCount, onCamDenied }: { resultId: string; violCount: number; onCamDenied: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  useEffect(() => {
    let timer: ReturnType<typeof setInterval>;
    let cancelled = false;
    navigator.mediaDevices.getUserMedia({ video: { width: 320, height: 240 } })
      .then((stream) => {
        if (cancelled) {
          // Component already unmounted before permission resolved — stop immediately.
          stream.getTracks().forEach(t => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
        const canvas = document.createElement("canvas"); canvas.width = 320; canvas.height = 240;
        const ctx = canvas.getContext("2d")!;
        const snap = () => {
          if (!videoRef.current) return;
          ctx.drawImage(videoRef.current, 0, 0, 320, 240);
          canvas.toBlob((blob) => {
            if (!blob) return;
            const fd = new FormData(); fd.append("image", blob, "snap.jpg");
            fd.append("result_id", resultId); fd.append("violation_count", String(violCount));
            fetch(`${BASE}/snapshot`, { method: "POST", body: fd, headers: authHeader() }).catch(() => {});
          }, "image/jpeg", 0.7);
        };
        timer = setInterval(snap, SNAPSHOT_INTERVAL_MS);
      })
      .catch(onCamDenied);
    return () => {
      cancelled = true;
      clearInterval(timer);
      streamRef.current?.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    };
  }, [resultId, violCount, onCamDenied]);
  return (
    <div className="fixed bottom-4 right-4 z-50 rounded-lg overflow-hidden border-2 border-red-500 shadow-lg" style={{ width: 120, height: 90 }}>
      <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover" style={{ transform: "scaleX(-1)" }} />
      <div className="absolute bottom-0 left-0 right-0 bg-red-600/80 text-white text-[9px] text-center py-0.5 font-semibold tracking-wide">
        🔴 MONITORED
      </div>
    </div>
  );
}

// ── Inline code editor with run button ───────────────────────────────────────
function CodeEditor({ questionId, value, onChange, language = "python" }:
  { questionId: string; value: string; onChange: (v: string) => void; language?: string }) {
  const [output, setOutput] = useState<{
    status: string; stdout: string; stderr: string; compile_output: string; message?: string;
    testResults?: { test_case_id: string; passed: boolean; is_hidden: boolean; actual_output: string | null; expected_output: string | null; error: string | null }[];
    testsPassed?: number; testsTotal?: number;
  } | null>(null);
  const [running, setRunning] = useState(false);
  const [stdin, setStdin] = useState("");
  const [showStdin, setShowStdin] = useState(false);

  const runCode = async () => {
    setRunning(true); setOutput(null);
    try {
      const r = await fetch(`${BASE}/run-code`, {
        method: "POST",
        headers: { ...authHeader(), "Content-Type": "application/json" },
        body: JSON.stringify({ code: value, language, stdin, questionId }),
      });
      setOutput(await r.json());
    } catch (e: any) {
      setOutput({ status: "error", stdout: "", stderr: e.message, compile_output: "" });
    } finally { setRunning(false); }
  };

  const hasOutput = output && (output.stdout || output.stderr || output.compile_output || output.message);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{language}</span>
        <div className="flex gap-2">
          <button onClick={() => setShowStdin(v => !v)} className="text-xs px-2 py-1 rounded bg-slate-100 text-slate-600 hover:bg-slate-200">
            {showStdin ? "Hide stdin" : "Add stdin"}
          </button>
          <button onClick={runCode} disabled={running || !value.trim()}
            className="text-xs px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-semibold hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-1.5">
            {running ? <><span className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" /> Running…</> : "▶ Run Code"}
          </button>
        </div>
      </div>
      {showStdin && (
        <textarea value={stdin} onChange={e => setStdin(e.target.value)} rows={2}
          placeholder="stdin (optional)"
          className="w-full font-mono text-xs bg-slate-800 text-green-300 rounded p-2 resize-y border border-slate-600 focus:outline-none focus:ring-1 focus:ring-emerald-500" />
      )}
      <textarea value={value} onChange={e => onChange(e.target.value)} rows={14}
        placeholder={`Write your ${language} code here…`} spellCheck={false}
        className="w-full font-mono text-sm bg-slate-900 text-slate-100 rounded-lg p-4 resize-y border border-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 leading-relaxed" />
      {hasOutput && (
        <div className="rounded-lg border overflow-hidden text-xs font-mono">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 text-slate-300">
            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
              output.status?.toLowerCase().includes("accepted") || output.status?.toLowerCase().includes("success")
                ? "bg-emerald-700 text-emerald-100"
                : output.status === "no_compiler" ? "bg-blue-700 text-blue-100"
                : "bg-red-700 text-red-100"
            }`}>{output.status || "Done"}</span>
            <span>Output</span>
          </div>
          {output.message && <div className="px-3 py-2 bg-blue-950 text-blue-300">{output.message}</div>}
          {output.compile_output && <div className="px-3 py-2 bg-red-950 text-red-300 whitespace-pre-wrap">{output.compile_output}</div>}
          {output.stdout && <div className="px-3 py-2 bg-slate-900 text-green-300 whitespace-pre-wrap max-h-40 overflow-y-auto">{output.stdout}</div>}
          {output.stderr && <div className="px-3 py-2 bg-red-950 text-red-300 whitespace-pre-wrap max-h-32 overflow-y-auto">{output.stderr}</div>}
          {!output.stdout && !output.stderr && !output.compile_output && !output.message && (
            <div className="px-3 py-2 bg-slate-900 text-slate-400">(no output)</div>
          )}
        </div>
      )}
      {output?.testResults && output.testResults.length > 0 && (
        <div className="rounded-lg border overflow-hidden text-xs">
          <div className="flex items-center justify-between px-3 py-1.5 bg-slate-800 text-slate-300 font-mono">
            <span>Test Cases</span>
            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
              output.testsPassed === output.testsTotal ? "bg-emerald-700 text-emerald-100" : "bg-amber-700 text-amber-100"
            }`}>{output.testsPassed}/{output.testsTotal} passed</span>
          </div>
          <div className="divide-y divide-slate-700">
            {output.testResults.map((t, i) => (
              <div key={t.test_case_id} className={`px-3 py-2 ${t.passed ? "bg-emerald-950/40" : "bg-red-950/40"}`}>
                <div className="flex items-center gap-2 font-mono">
                  <span>{t.passed ? "✅" : "❌"}</span>
                  <span className="text-slate-300">Test {i + 1}{t.is_hidden ? " (hidden)" : ""}</span>
                </div>
                {!t.is_hidden && !t.passed && (
                  <div className="mt-1 font-mono text-slate-400">
                    <div>Expected: <span className="text-emerald-400">{t.expected_output}</span></div>
                    <div>Got: <span className="text-red-400">{t.actual_output || "(nothing)"}</span></div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function AssessmentAttempt() {
  const { assessmentId } = useParams<{ assessmentId: string }>();
  const navigate = useNavigate();

  const [attempt, setAttempt] = useState<AttemptType | null>(null);
  const [started, setStarted] = useState(false);
  const [locked, setLocked] = useState(false);
  const [terminated, setTerminated] = useState(false);
  const [terminatedHelp, setTerminatedHelp] = useState("");
  const [helpSent, setHelpSent] = useState(false);
  const [camDenied, setCamDenied] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, AnswerSubmit>>({});
  const [result, setResult] = useState<AssessmentResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [violations, setViolations] = useState(0);
  const [warning, setWarning] = useState("");
  const answersRef = useRef(answers);
  answersRef.current = answers;
  const violationsRef = useRef(0);
  const submittedRef = useRef(false);
  const attemptRef = useRef<AttemptType | null>(null);
  attemptRef.current = attempt;

  const studentName = (() => {
    try { return JSON.parse(atob((localStorage.getItem("accessToken") ?? "").split(".")[1] ?? "")).name ?? "Student"; }
    catch { return "Student"; }
  })();

  useEffect(() => {
    if (!assessmentId) return;
    assessmentApi.start(assessmentId)
      .then(a => {
        // Check if this attempt was already terminated (page reload attack prevention)
        fetch(`${BASE}/status/${a.resultId}`, { headers: authHeader() })
          .then(r => r.json())
          .then(st => {
            if (st.isTerminated || st.status === "terminated" || st.status === "completed") {
              setTerminated(true);
            }
            setAttempt(a);
          })
          .catch(() => setAttempt(a));
      })
      .catch((err: any) => {
        // 403 = backend blocked this attempt (terminated or already submitted)
        const detail = err?.response?.data?.detail || err?.detail;
        if (detail?.code === "terminated" || detail?.is_terminated) {
          // Create a minimal attempt object so the terminated screen can show
          setAttempt({ resultId: detail.result_id || "", title: "Assessment", questions: [], duration: 0, startedAt: "", assessmentId: assessmentId || "" } as any);
          setTerminated(true);
        } else if (detail?.code === "completed") {
          // Already submitted - redirect to history
          navigate("/student/assessments/history");
        }
      });
  }, [assessmentId]);

  const currentQuestion = attempt?.questions[currentIndex];

  const updateAnswer = (patch: Partial<AnswerSubmit>) => {
    if (!currentQuestion || !attempt) return;
    const updated: AnswerSubmit = { ...answers[currentQuestion.id], ...patch, questionId: currentQuestion.id };
    setAnswers(prev => ({ ...prev, [currentQuestion.id]: updated }));
    assessmentApi.saveAnswer(attempt.assessmentId, updated).catch(() => {});
  };

  const handleSubmit = useCallback(async () => {
    if (!attempt || submittedRef.current) return;
    submittedRef.current = true;
    setSubmitting(true);
    try {
      const res = await assessmentApi.submit(attempt.resultId, Object.values(answersRef.current));
      setResult(res); exitFullscreen();
    } catch {
      submittedRef.current = false;
      setWarning("Submission failed. Check your connection and press Submit again.");
    } finally { setSubmitting(false); }
  }, [attempt]);

  const handleTerminate = useCallback(async () => {
    const a = attemptRef.current;
    if (!a || submittedRef.current) return;
    submittedRef.current = true;
    // Call terminate endpoint so page reload won't let them back in
    await fetch(`${BASE}/terminate`, {
      method: "POST",
      headers: { ...authHeader(), "Content-Type": "application/json" },
      body: JSON.stringify({ result_id: a.resultId, reason: "max_violations" }),
    }).catch(() => {});
    setTerminated(true);
    exitFullscreen();
  }, []);

  const beginTest = async () => {
    try { await enterFullscreen(); } catch { }
    setStarted(true);
  };

  // ── Lockdown listeners ────────────────────────────────────────────────────
  useEffect(() => {
    if (!attempt || result || !started || terminated) return;
    const flag = (msg: string) => {
      if (submittedRef.current) return;
      violationsRef.current += 1;
      setViolations(violationsRef.current);
      setLocked(true);
      if (violationsRef.current >= MAX_VIOLATIONS) {
        setWarning("Too many violations — your test has been terminated.");
        handleTerminate();
      } else {
        setWarning(`${msg} Violation ${violationsRef.current}/${MAX_VIOLATIONS}. At ${MAX_VIOLATIONS} your test is terminated.`);
      }
    };
    const onVis = () => { if (document.hidden) flag("Tab switched."); };
    const onBlur = () => flag("Window lost focus.");
    const onFs = () => { if (!isFullscreen()) flag("Fullscreen exited."); };
    const block = (e: Event) => e.preventDefault();
    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (e.key === "F12" || (e.ctrlKey && e.shiftKey && ["i","j","c"].includes(k)) ||
          (e.ctrlKey && ["p","s","u"].includes(k))) { e.preventDefault(); e.stopPropagation(); }
    };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("blur", onBlur);
    document.addEventListener("fullscreenchange", onFs);
    document.addEventListener("webkitfullscreenchange", onFs);
    document.addEventListener("keydown", onKey, true);
    document.addEventListener("copy", block);
    document.addEventListener("cut", block);
    document.addEventListener("contextmenu", block);
    window.addEventListener("beforeunload", block);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("blur", onBlur);
      document.removeEventListener("fullscreenchange", onFs);
      document.removeEventListener("webkitfullscreenchange", onFs);
      document.removeEventListener("keydown", onKey, true);
      document.removeEventListener("copy", block);
      document.removeEventListener("cut", block);
      document.removeEventListener("contextmenu", block);
      window.removeEventListener("beforeunload", block);
    };
  }, [attempt, result, started, terminated, handleTerminate]);

  const sendHelp = async () => {
    if (!attempt) return;
    await fetch(`${BASE}/request-help`, {
      method: "POST",
      headers: { ...authHeader(), "Content-Type": "application/json" },
      body: JSON.stringify({ result_id: attempt.resultId, message: terminatedHelp }),
    }).catch(() => {});
    setHelpSent(true);
  };

  // While waiting for faculty, poll for reinstatement and resume automatically
  useEffect(() => {
    if (!terminated || !helpSent || !attempt?.resultId) return;
    const t = setInterval(() => {
      fetch(`${BASE}/status/${attempt.resultId}`, { headers: authHeader() })
        .then(r => r.json())
        .then(st => {
          if (!st.isTerminated && st.status !== "completed") {
            window.location.reload();
          }
        })
        .catch(() => {});
    }, 10000);
    return () => clearInterval(t);
  }, [terminated, helpSent, attempt?.resultId]);

  // ── Terminated screen (shown on reload too) ───────────────────────────────
  if (terminated) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
        <div className="max-w-lg w-full bg-white rounded-2xl p-8 text-center space-y-5 shadow-2xl">
          <div className="text-5xl">🚫</div>
          <h1 className="text-2xl font-black text-red-700">Assessment Terminated</h1>
          <p className="text-sm text-slate-600">
            Your assessment session has been terminated due to security violations.
            You <strong>cannot</strong> resume or restart this attempt.
          </p>
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-700">
            Violation count reached {MAX_VIOLATIONS}/{MAX_VIOLATIONS}. This event has been logged and flagged for review.
          </div>

          {!helpSent ? (
            <div className="space-y-3 text-left">
              <p className="text-sm font-semibold text-slate-700">Need to contact your faculty/admin?</p>
              <textarea
                value={terminatedHelp}
                onChange={e => setTerminatedHelp(e.target.value)}
                rows={3}
                placeholder="Explain your situation (optional)…"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
              />
              <button onClick={sendHelp}
                className="w-full px-4 py-2.5 bg-primary text-white rounded-lg text-sm font-semibold hover:opacity-90">
                📩 Send Help Request to Faculty
              </button>
            </div>
          ) : (
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-sm text-emerald-800 font-medium">
              ✅ Help request sent. Faculty will contact you.
            </div>
          )}

          <button onClick={() => navigate("/student/dashboard")}
            className="w-full px-4 py-2.5 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200">
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (!attempt) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 text-gray-500">
      Loading assessment…
    </div>
  );

  if (!started) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="max-w-xl w-full bg-white rounded-xl border border-gray-200 p-8 space-y-4">
        <h1 className="text-2xl font-bold text-gray-800">{attempt.title}</h1>
        <p className="text-sm text-gray-500">{attempt.questions.length} questions · {attempt.duration} min</p>
        <div className="bg-amber-50 border border-amber-300 rounded-lg p-4 text-sm text-amber-900 space-y-1.5">
          <p className="font-bold">⚠️ Security Notice — Read before starting</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>This test runs in fullscreen and your webcam is recorded.</li>
            <li>Tab switching, window blur, or fullscreen exit = <strong>violation</strong>.</li>
            <li>After <strong>{MAX_VIOLATIONS} violations</strong> your test is <strong>permanently terminated</strong>.</li>
            <li>Terminated attempts <strong>cannot be restarted</strong> — even on page reload.</li>
            <li>Copy, paste, right-click and DevTools are blocked.</li>
          </ul>
        </div>
        {camDenied && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded p-2">⚠️ Camera access denied. Session will be flagged for manual review.</p>}
        <button onClick={beginTest} className="w-full px-4 py-3 bg-primary text-white rounded-lg font-semibold">
          Allow camera & begin — I understand the rules
        </button>
      </div>
    </div>
  );

  if (result) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="max-w-xl w-full bg-white rounded-xl border border-gray-200 p-8 text-center space-y-4">
        <h1 className="text-2xl font-bold text-gray-800">Assessment Submitted ✅</h1>
        <p className="text-4xl font-black text-primary">{result.score} / {result.maxScore}</p>
        {result.percentile != null && <p className="text-gray-500">Percentile: {result.percentile}% · Rank: #{result.rank}</p>}
        {result.aiFeedback && (
          <div className="text-left bg-gray-50 rounded-lg p-4 text-sm text-gray-600">
            <p className="font-semibold mb-1">AI Feedback</p>
            <p>{result.aiFeedback}</p>
          </div>
        )}
        <div className="flex gap-2 justify-center">
          <button onClick={() => navigate("/student/assessments/history")} className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium">View History</button>
          <button onClick={() => navigate("/student/dashboard")} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium">Dashboard</button>
        </div>
      </div>
    </div>
  );

  const answeredIndexes = new Set(attempt.questions.map((q, i) => (answers[q.id] ? i : -1)).filter(i => i >= 0));

  return (
    <>
      <ExamWatermark studentName={studentName} />
      <WebcamMonitor resultId={attempt.resultId} violCount={violations} onCamDenied={() => setCamDenied(true)} />

      {/* Lock overlay */}
      {locked && (
        <div className="fixed inset-0 z-50 bg-slate-950/98 flex items-center justify-center p-6">
          <div className="max-w-md text-center space-y-4">
            <p className="text-5xl">{violations >= MAX_VIOLATIONS ? "🚫" : "🔒"}</p>
            <h2 className="text-xl font-black text-white">
              {violations >= MAX_VIOLATIONS ? "Test Terminated" : "Test Paused"}
            </h2>
            <p className="text-sm text-slate-300">{warning}</p>
            <div className={`text-xs px-3 py-1.5 rounded-full inline-block font-bold ${
              violations >= MAX_VIOLATIONS ? "bg-red-800 text-red-200" : "bg-amber-800 text-amber-200"
            }`}>
              Violation {violations}/{MAX_VIOLATIONS}
            </div>
            {violations < MAX_VIOLATIONS && (
              <button onClick={async () => { try { await enterFullscreen(); } catch {} setLocked(false); }}
                className="block w-full px-5 py-3 bg-primary text-white rounded-xl text-sm font-semibold">
                Return to fullscreen to resume
              </button>
            )}
          </div>
        </div>
      )}

      <div className="min-h-screen bg-slate-50 flex flex-col select-none">
        <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between shrink-0 sticky top-0 z-30">
          <div>
            <h1 className="text-base font-bold text-gray-800 leading-tight">{attempt.title}</h1>
            <p className="text-xs text-gray-400">Q{currentIndex+1}/{attempt.questions.length} · {answeredIndexes.size} answered</p>
          </div>
          <div className="flex items-center gap-3">
            {violations > 0 && (
              <span className="text-xs px-2 py-1 rounded-full bg-amber-100 text-amber-700 font-bold">
                ⚠️ {violations} violation{violations > 1 ? "s" : ""}
              </span>
            )}
            <Timer durationMinutes={attempt.duration} startedAt={attempt.startedAt} onExpire={handleSubmit} />
            <button onClick={handleSubmit} disabled={submitting}
              className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-semibold disabled:opacity-50">
              {submitting ? "Submitting…" : "Submit"}
            </button>
          </div>
        </header>

        <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 gap-6 p-6 max-w-7xl w-full mx-auto">
          <div className="lg:col-span-3 space-y-4">
            {warning && !locked && (
              <div className="bg-amber-50 border border-amber-300 text-amber-800 text-sm rounded-lg px-4 py-2">⚠️ {warning}</div>
            )}
            {currentQuestion && (
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <div className="flex items-center gap-2 mb-2">
                  <p className="text-xs text-gray-400">Question {currentIndex+1} of {attempt.questions.length} · {currentQuestion.marks} marks</p>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold uppercase ${
                    currentQuestion.type === "mcq" ? "bg-blue-50 text-blue-600" :
                    ["coding","sql"].includes(currentQuestion.type) ? "bg-violet-50 text-violet-700" :
                    "bg-slate-50 text-slate-500"
                  }`}>{currentQuestion.type}</span>
                </div>
                <p className={`text-gray-800 font-medium mb-4 whitespace-pre-wrap ${["coding","sql"].includes(currentQuestion.type) ? "font-mono text-sm leading-relaxed" : ""}`}>{currentQuestion.questionText}</p>

                {currentQuestion.type === "mcq" ? (
                  currentQuestion.options?.length ? (
                    <div className="space-y-2">
                      {currentQuestion.options.map((choice, i) => {
                        const sel = answers[currentQuestion.id]?.selectedOption === choice;
                        return (
                          <label key={i} className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition ${sel ? "border-primary bg-primary/5" : "border-gray-200 hover:bg-gray-50"}`}>
                            <input type="radio" name={currentQuestion.id} checked={sel} onChange={() => updateAnswer({ selectedOption: choice })} />
                            <span className="text-xs font-bold text-gray-400 w-4">{String.fromCharCode(65+i)}</span>
                            <span className="text-sm text-gray-700">{choice}</span>
                          </label>
                        );
                      })}
                    </div>
                  ) : <p className="text-sm text-red-600">No options saved. Contact your faculty.</p>
                ) : ["coding", "sql", "python", "javascript", "java", "cpp"].includes(currentQuestion.type) ? (
                  <>
                    {currentQuestion.sampleTestCases && currentQuestion.sampleTestCases.length > 0 && (
                      <div className="mb-4 space-y-2">
                        <p className="text-xs font-semibold text-indigo-700 uppercase">Sample Test Cases</p>
                        {currentQuestion.sampleTestCases.map((tc) => (
                          <div key={tc.id} className="bg-indigo-50 border border-indigo-100 rounded-lg p-3 text-xs font-mono whitespace-pre-wrap">
                            {tc.input && <div><span className="text-indigo-400">Input:</span> {tc.input}</div>}
                            <div><span className="text-indigo-400">Expected Output:</span>{"\n"}{tc.expectedOutput}</div>
                          </div>
                        ))}
                      </div>
                    )}
                    <CodeEditor
                      questionId={currentQuestion.id}
                      language={currentQuestion.type === "coding" ? "python" : currentQuestion.type}
                      value={answers[currentQuestion.id]?.answerText ?? ""}
                      onChange={v => updateAnswer({ answerText: v })}
                    />
                  </>
                ) : (
                  <textarea className="input min-h-[160px]" placeholder="Type your answer here…"
                    value={answers[currentQuestion.id]?.answerText ?? ""}
                    onChange={e => updateAnswer({ answerText: e.target.value })} />
                )}
              </div>
            )}
            <div className="flex justify-between">
              <button disabled={currentIndex === 0} onClick={() => setCurrentIndex(i => Math.max(0, i-1))}
                className="px-4 py-2 bg-gray-100 rounded-lg text-sm disabled:opacity-40">Previous</button>
              {currentIndex < attempt.questions.length-1 ? (
                <button onClick={() => setCurrentIndex(i => Math.min(attempt.questions.length-1, i+1))}
                  className="px-4 py-2 bg-primary text-white rounded-lg text-sm">Next</button>
              ) : (
                <button onClick={handleSubmit} disabled={submitting}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm disabled:opacity-50">
                  {submitting ? "Submitting…" : "Submit Assessment"}
                </button>
              )}
            </div>
          </div>
          <QuestionNavigator totalQuestions={attempt.questions.length} currentIndex={currentIndex}
            answeredIndexes={answeredIndexes} onNavigate={setCurrentIndex} />
        </div>
      </div>
    </>
  );
}
