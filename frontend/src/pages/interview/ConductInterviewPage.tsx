import React, { useEffect, useState } from "react";
import ArcLoader from "../../components/ArcLoader";
import { interviewApi } from "../../api/placementApi";
import { Interview } from "../../types/placement";
import StatusBadge from "../../components/StatusBadge";

export default function ConductInterviewPage({ interviewId }: { interviewId: string }) {
  const [interview, setInterview] = useState<Interview | null>(null);
  const [transcript, setTranscript] = useState("");
  const [feedback, setFeedback] = useState("");
  const [rating, setRating] = useState(3);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const data = await interviewApi.get(interviewId);
      setInterview(data);
      setTranscript(data.transcript || "");
      setFeedback(data.interviewerFeedback || "");
      setRating(data.interviewerRating || 3);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interviewId]);

  const runAnalysis = async () => {
    setAnalyzing(true);
    setError("");
    try {
      const updated = await interviewApi.analyze(interviewId, transcript);
      setInterview(updated);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setAnalyzing(false);
    }
  };

  const submitFeedback = async () => {
    setError("");
    try {
      const updated = await interviewApi.submitFeedback(interviewId, feedback, rating);
      setInterview(updated);
    } catch (e: any) {
      setError(e.message);
    }
  };

  if (loading) return <ArcLoader />;
  if (!interview) return <div className="p-6 text-red-600">{error || "Interview not found."}</div>;

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{interview.roundName}</h1>
          <p className="text-sm text-gray-500">
            {new Date(interview.scheduledAt).toLocaleString()} · {interview.mode.replace("_", " ")}
          </p>
        </div>
        <StatusBadge status={interview.status} />
      </div>

      {interview.meetingLink && (
        <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4">
          <p className="text-sm text-gray-700 mb-2">
            Video call integration is mocked in this phase — plug in your real provider (e.g. Zoom/Meet SDK) here.
          </p>
          <a href={interview.meetingLink} target="_blank" rel="noreferrer" className="text-indigo-600 text-sm font-medium hover:underline">
            Join meeting link →
          </a>
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
        <h2 className="font-semibold text-gray-800 mb-2">Interview Transcript</h2>
        <textarea
          rows={8}
          value={transcript}
          onChange={(e) => setTranscript(e.target.value)}
          placeholder="Paste or type the interview transcript here (or auto-captured recording transcript)..."
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
        />
        <button
          onClick={runAnalysis}
          disabled={analyzing || !transcript.trim()}
          className="mt-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium"
        >
          {analyzing ? "Analyzing with AI..." : "Run AI Analysis (Gemini)"}
        </button>
      </div>

      {interview.aiAnalysis && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
          <div className="flex justify-between items-center mb-2">
            <h2 className="font-semibold text-gray-800">AI Objective Analysis</h2>
            <span className="text-lg font-bold text-indigo-600">{interview.aiScore?.toFixed(1)}/100</span>
          </div>
          <p className="text-sm text-gray-600 mb-3">{interview.aiAnalysis.summary}</p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-medium text-green-700 mb-1">Strengths</p>
              <ul className="text-xs text-gray-600 list-disc list-inside space-y-0.5">
                {interview.aiAnalysis.strengths.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-xs font-medium text-red-700 mb-1">Weaknesses</p>
              <ul className="text-xs text-gray-600 list-disc list-inside space-y-0.5">
                {interview.aiAnalysis.weaknesses.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
        <h2 className="font-semibold text-gray-800 mb-2">Interviewer Feedback</h2>
        <textarea
          rows={4}
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          placeholder="Write your feedback about the candidate..."
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
        />
        <div className="flex items-center gap-3 mt-3">
          <label className="text-xs font-medium text-gray-600">Rating (1-5)</label>
          <select
            value={rating}
            onChange={(e) => setRating(Number(e.target.value))}
            className="border border-gray-300 rounded-lg px-2 py-1 text-sm"
          >
            {[1, 2, 3, 4, 5].map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <button
            onClick={submitFeedback}
            className="ml-auto bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
          >
            Submit Feedback & Mark Completed
          </button>
        </div>
      </div>

      {error && <p className="text-red-600 text-sm">{error}</p>}
    </div>
  );
}
