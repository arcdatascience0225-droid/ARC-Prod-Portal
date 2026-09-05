import { useState } from "react";
import { addAssignmentFeedback } from "../../api/facultyApi";

export default function EvaluateAssignmentsPage() {
  const [resultId, setResultId] = useState("");
  const [feedbackText, setFeedbackText] = useState("");
  const [scoreOverride, setScoreOverride] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const submit = async () => {
    if (!resultId || !feedbackText) return;
    setSaving(true);
    await addAssignmentFeedback({
      resultId,
      feedbackText,
      scoreOverride: scoreOverride ? Number(scoreOverride) : undefined,
    });
    setSaving(false);
    setMessage("Feedback submitted.");
    setResultId(""); setFeedbackText(""); setScoreOverride("");
  };

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-semibold text-slate-800 mb-6">Evaluate Assignment</h1>
      <p className="text-sm text-slate-500 mb-4">
        Look up the student's result ID from Student Performance, then leave written feedback
        and optionally override the auto-graded score.
      </p>

      <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
        <input
          placeholder="Result ID"
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
          value={resultId}
          onChange={(e) => setResultId(e.target.value)}
        />
        <textarea
          placeholder="Written feedback"
          rows={5}
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
          value={feedbackText}
          onChange={(e) => setFeedbackText(e.target.value)}
        />
        <input
          type="number"
          placeholder="Score override (optional)"
          className="w-48 border border-slate-300 rounded-lg px-3 py-2 text-sm"
          value={scoreOverride}
          onChange={(e) => setScoreOverride(e.target.value)}
        />
        <button
          onClick={submit}
          disabled={saving}
          className="bg-indigo-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
        >
          {saving ? "Submitting…" : "Submit Feedback"}
        </button>
        {message && <p className="text-sm text-emerald-600">{message}</p>}
      </div>
    </div>
  );
}
