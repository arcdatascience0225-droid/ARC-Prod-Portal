import { useEffect, useState } from "react";
import { getMyInterviews, submitMockInterview, getMyEvaluation } from "../../api/facultyApi";
import { MockInterview, MockInterviewEvaluation, QnAEntry } from "../../types";

// Text-based Q&A is the baseline mode (per spec); audio/video capture would
// plug into the same submit() call once recorded and uploaded to Azure Blob,
// passing the resulting URL as `recordingUrl`.
const DEFAULT_QUESTIONS = [
  "Tell me about yourself and your technical background.",
  "Describe a challenging project you worked on and how you solved it.",
  "Walk me through how you would approach debugging a production issue.",
  "Why do you want to work in this field?",
  "Where do you see yourself in the next few years?",
];

export default function MockInterviewTakePage() {
  const [interviews, setInterviews] = useState<MockInterview[]>([]);
  const [active, setActive] = useState<MockInterview | null>(null);
  const [answers, setAnswers] = useState<string[]>(Array(DEFAULT_QUESTIONS.length).fill(""));
  const [submitting, setSubmitting] = useState(false);
  const [evaluation, setEvaluation] = useState<MockInterviewEvaluation | null>(null);

  useEffect(() => {
    getMyInterviews().then(setInterviews);
  }, []);

  const startInterview = (interview: MockInterview) => {
    setActive(interview);
    setAnswers(Array(DEFAULT_QUESTIONS.length).fill(""));
    setEvaluation(null);
  };

  const viewEvaluation = async (interview: MockInterview) => {
    setActive(interview);
    const ev = await getMyEvaluation(interview.id);
    setEvaluation(ev);
  };

  const submit = async () => {
    if (!active) return;
    setSubmitting(true);
    const responses: QnAEntry[] = DEFAULT_QUESTIONS.map((q, i) => ({
      questionText: q, answerText: answers[i], sequence: String(i + 1),
    }));
    const result = await submitMockInterview(active.id, responses);
    setEvaluation(result);
    setSubmitting(false);
    getMyInterviews().then(setInterviews);
  };

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-semibold text-slate-800 mb-6">My Mock Interviews</h1>

      {!active && (
        <div className="space-y-3">
          {interviews.map((i) => (
            <div key={i.id} className="bg-white border border-slate-200 rounded-xl p-4 flex justify-between items-center">
              <div>
                <p className="text-sm font-medium text-slate-800">
                  {new Date(i.scheduledAt).toLocaleString()} · <span className="capitalize">{i.mode}</span>
                </p>
                <p className="text-xs text-slate-400 capitalize">{i.status}</p>
              </div>
              {i.status === "scheduled" ? (
                <button
                  onClick={() => startInterview(i)}
                  className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700"
                >
                  Start
                </button>
              ) : i.status === "completed" ? (
                <button
                  onClick={() => viewEvaluation(i)}
                  className="bg-slate-100 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-200"
                >
                  View Feedback
                </button>
              ) : null}
            </div>
          ))}
          {interviews.length === 0 && <p className="text-sm text-slate-400">No interviews scheduled yet.</p>}
        </div>
      )}

      {active && !evaluation && active.status === "scheduled" && (
        <div className="space-y-4">
          {DEFAULT_QUESTIONS.map((q, i) => (
            <div key={i} className="bg-white border border-slate-200 rounded-xl p-4">
              <p className="text-sm font-medium text-slate-800 mb-2">{i + 1}. {q}</p>
              <textarea
                rows={3}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                value={answers[i]}
                onChange={(e) => {
                  const next = [...answers];
                  next[i] = e.target.value;
                  setAnswers(next);
                }}
              />
            </div>
          ))}
          <button
            onClick={submit}
            disabled={submitting}
            className="bg-indigo-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
          >
            {submitting ? "Submitting for AI analysis…" : "Submit Interview"}
          </button>
          <button onClick={() => setActive(null)} className="ml-3 text-sm text-slate-500 hover:underline">
            Cancel
          </button>
        </div>
      )}

      {evaluation && (
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <h2 className="font-semibold text-slate-800 mb-4">Your Interview Feedback</h2>
          <div className="grid grid-cols-4 gap-4 text-center mb-4">
            <div><p className="text-xs text-slate-400">Confidence</p><p className="text-xl font-semibold">{evaluation.confidenceScore}</p></div>
            <div><p className="text-xs text-slate-400">Communication</p><p className="text-xl font-semibold">{evaluation.communicationScore}</p></div>
            <div><p className="text-xs text-slate-400">Technical</p><p className="text-xl font-semibold">{evaluation.technicalScore}</p></div>
            <div><p className="text-xs text-slate-400">Overall</p><p className="text-xl font-semibold">{evaluation.overallScore}</p></div>
          </div>
          <p className="text-sm text-slate-700 mb-2">{evaluation.feedbackText}</p>
          <p className="text-sm text-slate-500 whitespace-pre-line">{evaluation.improvementSuggestions}</p>
          <button onClick={() => { setActive(null); setEvaluation(null); }} className="mt-4 text-sm text-indigo-600 hover:underline">
            Back to list
          </button>
        </div>
      )}
    </div>
  );
}
