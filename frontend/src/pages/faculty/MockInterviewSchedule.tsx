import { useEffect, useState } from "react";
import { getMyBatches, getBatchStudents, scheduleMockInterview, getMyScheduledInterviews, getInterviewEvaluation } from "../../api/facultyApi";
import { FacultyBatch, StudentInBatch, MockInterview, MockInterviewEvaluation, InterviewMode } from "../../types";

export default function MockInterviewSchedulePage() {
  const [batches, setBatches] = useState<FacultyBatch[]>([]);
  const [batchId, setBatchId] = useState("");
  const [students, setStudents] = useState<StudentInBatch[]>([]);
  const [studentId, setStudentId] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [mode, setMode] = useState<InterviewMode>("text");
  const [interviews, setInterviews] = useState<MockInterview[]>([]);
  const [evaluations, setEvaluations] = useState<Record<string, MockInterviewEvaluation>>({});

  useEffect(() => {
    getMyBatches().then(setBatches);
    refreshInterviews();
  }, []);

  useEffect(() => {
    if (batchId) getBatchStudents(batchId).then(setStudents);
  }, [batchId]);

  const refreshInterviews = async () => {
    const data = await getMyScheduledInterviews();
    setInterviews(data);
    data.filter((i) => i.status === "completed").forEach(async (i) => {
      try {
        const ev = await getInterviewEvaluation(i.id);
        setEvaluations((prev) => ({ ...prev, [i.id]: ev }));
      } catch { /* evaluation not ready */ }
    });
  };

  const schedule = async () => {
    if (!studentId || !scheduledAt) return;
    await scheduleMockInterview({ studentId, batchId: batchId || undefined, scheduledAt, mode });
    setStudentId(""); setScheduledAt("");
    refreshInterviews();
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-semibold text-slate-800 mb-6">Mock Interviews</h1>

      <div className="bg-white border border-slate-200 rounded-xl p-4 mb-6 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <select className="border border-slate-300 rounded-lg px-3 py-2 text-sm" value={batchId} onChange={(e) => setBatchId(e.target.value)}>
            <option value="">Select batch</option>
            {batches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
          <select className="border border-slate-300 rounded-lg px-3 py-2 text-sm" value={studentId} onChange={(e) => setStudentId(e.target.value)}>
            <option value="">Select student</option>
            {students.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <input
            type="datetime-local"
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm"
            value={scheduledAt}
            onChange={(e) => setScheduledAt(e.target.value)}
          />
          <select className="border border-slate-300 rounded-lg px-3 py-2 text-sm" value={mode} onChange={(e) => setMode(e.target.value as InterviewMode)}>
            <option value="text">Text Q&A</option>
            <option value="audio">Audio</option>
            <option value="video">Video</option>
          </select>
        </div>
        <button onClick={schedule} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700">
          Schedule Interview
        </button>
      </div>

      <h2 className="font-medium text-slate-700 mb-2">Scheduled Interviews</h2>
      <div className="space-y-3">
        {interviews.map((i) => {
          const ev = evaluations[i.id];
          return (
            <div key={i.id} className="bg-white border border-slate-200 rounded-xl p-4">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-sm font-medium text-slate-800">
                    {new Date(i.scheduledAt).toLocaleString()} · <span className="capitalize">{i.mode}</span>
                  </p>
                  <p className="text-xs text-slate-400 capitalize">{i.status}</p>
                </div>
                {i.recordingUrl && (
                  <a href={i.recordingUrl} target="_blank" rel="noreferrer" className="text-xs text-indigo-600 underline">
                    Recording
                  </a>
                )}
              </div>
              {ev && (
                <div className="mt-3 grid grid-cols-4 gap-3 text-center">
                  <div><p className="text-xs text-slate-400">Confidence</p><p className="font-semibold">{ev.confidenceScore}</p></div>
                  <div><p className="text-xs text-slate-400">Communication</p><p className="font-semibold">{ev.communicationScore}</p></div>
                  <div><p className="text-xs text-slate-400">Technical</p><p className="font-semibold">{ev.technicalScore}</p></div>
                  <div><p className="text-xs text-slate-400">Overall</p><p className="font-semibold">{ev.overallScore}</p></div>
                </div>
              )}
              {ev?.feedbackText && <p className="text-sm text-slate-600 mt-3">{ev.feedbackText}</p>}
              {ev?.improvementSuggestions && (
                <p className="text-xs text-slate-500 mt-1 whitespace-pre-line">{ev.improvementSuggestions}</p>
              )}
            </div>
          );
        })}
        {interviews.length === 0 && <p className="text-sm text-slate-400">No interviews scheduled yet.</p>}
      </div>
    </div>
  );
}
