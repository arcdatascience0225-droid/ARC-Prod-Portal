import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { codingApi } from "../../api/studentApi";
import { apiClient } from "../../api/client";
import CodeEditor from "../../components/CodeEditor";
import ArcLoader from "../../components/ArcLoader";
import type { CodingQuestion, CodeRunResult, CodeSubmitResult } from "../../types";

interface CodingListItem { id: string; questionText: string; language: string; marks: number }

export default function CodingLab() {
  const { codingQuestionId } = useParams<{ codingQuestionId: string }>();
  const navigate = useNavigate();

  // ── Picker (no question selected yet) ────────────────────────────────
  const [list, setList] = useState<CodingListItem[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);

  // ── Selected question ────────────────────────────────────────────────
  const [question, setQuestion] = useState<CodingQuestion | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [customInput, setCustomInput] = useState("");
  const [runResult, setRunResult] = useState<CodeRunResult | null>(null);
  const [submitResult, setSubmitResult] = useState<CodeSubmitResult | null>(null);
  const [running, setRunning] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    // Pre-warm the backend (Render free tier sleeps after ~15 min idle) —
    // fired as soon as this page loads, so by the time the student clicks
    // "Run", the backend is hopefully already awake.
    apiClient.get("/api/v1/health").catch(() => {});
  }, []);

  useEffect(() => {
    if (codingQuestionId) return;
    setList(null);
    setListError(null);
    codingApi.list()
      .then(setList)
      .catch(() => setListError("Couldn't load coding questions. Please try again."));
  }, [codingQuestionId]);

  useEffect(() => {
    if (!codingQuestionId) return;
    setQuestion(null);
    setLoadError(null);
    codingApi.get(codingQuestionId)
      .then((q) => {
        setQuestion(q);
        setCode(q.starterCode || "");
      })
      .catch(() => setLoadError("This coding question couldn't be loaded. It may have been removed."));
  }, [codingQuestionId]);

  const handleRun = async () => {
    if (!question) return;
    setRunning(true);
    setRunResult(null);
    try {
      const res = await codingApi.run({
        codingQuestionId: question.id,
        code,
        language: question.language,
        customInput,
      });
      setRunResult(res);
    } finally {
      setRunning(false);
    }
  };

  const handleSubmit = async () => {
    if (!question) return;
    setSubmitting(true);
    setSubmitResult(null);
    try {
      const res = await codingApi.submit({ codingQuestionId: question.id, code, language: question.language });
      setSubmitResult(res);
    } finally {
      setSubmitting(false);
    }
  };

  // ── Picker view: no question ID in the URL ───────────────────────────
  if (!codingQuestionId) {
    return (
      <div className="max-w-3xl mx-auto space-y-4">
        <h1 className="text-lg font-bold text-gray-800">Coding Lab</h1>
        <p className="text-sm text-gray-500">Pick a question to practice.</p>

        {listError && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-4">
            {listError}
          </div>
        )}
        {!listError && list === null && <ArcLoader label="Loading coding questions" />}
        {!listError && list !== null && list.length === 0 && (
          <p className="text-sm text-gray-400">No coding questions are available yet. Check back later.</p>
        )}
        {!listError && list !== null && list.length > 0 && (
          <div className="space-y-2">
            {list.map((q) => (
              <button
                key={q.id}
                onClick={() => navigate(`/student/coding-lab/${q.id}`)}
                className="w-full text-left bg-white rounded-xl border border-gray-200 p-4 hover:border-primary hover:shadow-sm transition"
              >
                <p className="text-sm font-medium text-gray-800">{q.questionText}</p>
                <p className="text-xs text-gray-400 mt-1">{q.language} · {q.marks} marks</p>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── Selected question failed to load ──────────────────────────────────
  if (loadError) {
    return (
      <div className="max-w-lg mx-auto text-center py-16 space-y-3">
        <p className="text-red-600">{loadError}</p>
        <Link to="/student/coding-lab" className="text-sm text-primary font-medium hover:underline">
          ← Back to Coding Lab
        </Link>
      </div>
    );
  }

  if (!question) return <ArcLoader label="Loading coding question" />;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="space-y-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-lg font-bold text-gray-800">Coding Lab</h1>
            <Link to="/student/coding-lab" className="text-xs text-primary font-medium hover:underline">← All questions</Link>
          </div>
          <p className="text-sm text-gray-600 whitespace-pre-wrap">{question.questionText}</p>
          <p className="text-xs text-gray-400 mt-2">Language: {question.language} · {question.marks} marks</p>
        </div>

        {question.sampleTestCases.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="font-semibold text-gray-800 mb-2 text-sm">Sample Test Cases</h2>
            <div className="space-y-2">
              {question.sampleTestCases.map((tc) => (
                <div key={tc.id} className="text-xs bg-gray-50 rounded p-2 font-mono">
                  <div>Input: {tc.input}</div>
                  <div>Expected: {tc.expectedOutput}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-800 mb-2 text-sm">Custom Input (for Run)</h2>
          <textarea className="input h-20 font-mono" value={customInput} onChange={(e) => setCustomInput(e.target.value)} />
        </div>
      </div>

      <div className="space-y-4">
        <CodeEditor language={question.language} value={code} onChange={setCode} />

        <div className="flex gap-2">
          <button onClick={handleRun} disabled={running} className="px-4 py-2 bg-gray-800 text-white rounded-lg text-sm disabled:opacity-50">
            {running ? "Running..." : "Run"}
          </button>
          <button onClick={handleSubmit} disabled={submitting} className="px-4 py-2 bg-primary text-white rounded-lg text-sm disabled:opacity-50">
            {submitting ? "Submitting..." : "Submit"}
          </button>
        </div>

        {runResult && (
          <div className="bg-white rounded-xl border border-gray-200 p-4 text-sm">
            <p className="font-medium text-gray-700 mb-1">Run Result — {runResult.status}</p>
            <pre className="bg-gray-900 text-green-400 p-3 rounded text-xs overflow-auto">{runResult.stdout || runResult.stderr || "(no output)"}</pre>
          </div>
        )}

        {submitResult && (
          <div className="bg-white rounded-xl border border-gray-200 p-4 text-sm space-y-2">
            <p className="font-medium text-gray-700">
              {submitResult.status.toUpperCase()} — {submitResult.passedTestCases}/{submitResult.totalTestCases} test cases passed — Score: {submitResult.score}
            </p>
            <ul className="space-y-1">
              {submitResult.testCaseResults.map((r) => (
                <li key={r.testCaseId} className={`text-xs px-2 py-1 rounded ${r.passed ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
                  {r.isHidden ? "Hidden test case" : `Input/Output check`} — {r.passed ? "Passed" : "Failed"}
                </li>
              ))}
            </ul>
            {submitResult.aiReview && (
              <div className="bg-gray-50 rounded p-3 text-xs text-gray-600">
                <p className="font-medium mb-1">AI Code Review</p>
                <p>{submitResult.aiReview}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
