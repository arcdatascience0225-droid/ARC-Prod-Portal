import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { listQuestionBank, createAssessment, getMyBatches } from "../../api/facultyApi";
import { Question, FacultyBatch } from "../../types";

export default function CreateAssessmentPage() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [batches, setBatches] = useState<FacultyBatch[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [duration, setDuration] = useState(30);
  const [maxViolations, setMaxViolations] = useState(10);
  const [batchIds, setBatchIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    listQuestionBank().then(setQuestions);
    getMyBatches().then(setBatches);
  }, []);

  const toggle = (id?: string) => {
    if (!id) return;
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };

  const toggleBatch = (id: string) => {
    const next = new Set(batchIds);
    next.has(id) ? next.delete(id) : next.add(id);
    setBatchIds(next);
  };

  const selectAll = () => {
    const allIds = questions.map((q) => q.id).filter(Boolean) as string[];
    setSelected(new Set(allIds));
  };
  const clearSelection = () => setSelected(new Set());

  const save = async () => {
    setMessage("");
    if (!title) { setMessage("Title is required."); return; }
    if (selected.size === 0) { setMessage("Select at least one question."); return; }
    setSaving(true);
    const types = new Set(questions.filter((q) => q.id && selected.has(q.id)).map((q) => q.type));
    const assessmentType = types.size === 1 ? [...types][0] : "mixed";
    try {
      await createAssessment({
        title, description, type: assessmentType, questionIds: [...selected],
        duration, batchIds: [...batchIds], maxViolations,
      });
      setMessage("Assessment created successfully. Redirecting...");
      setTitle(""); setDescription(""); setSelected(new Set()); setBatchIds(new Set());
      setTimeout(() => navigate("/faculty/assessments"), 1200);
    } catch (e: any) {
      setMessage(e.message || "Failed to create assessment.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-semibold text-slate-800 mb-6">Create Assessment / Assignment</h1>

      <div className="bg-white border border-slate-200 rounded-xl p-4 mb-6 space-y-3">
        <input
          placeholder="Assessment title"
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <textarea
          placeholder="Description"
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <div className="flex gap-3 items-center">
          <label className="text-xs text-slate-500">Duration (min)</label>
          <input
            type="number"
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm w-24"
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
          />
          <label className="text-xs text-slate-500">Terminate after (violations)</label>
          <input
            type="number"
            min={1}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm w-20"
            value={maxViolations}
            onChange={(e) => setMaxViolations(Math.max(1, Number(e.target.value)))}
          />
        </div>
        <div>
          <p className="text-xs text-slate-500 mb-1">Assign to batches</p>
          <div className="flex flex-wrap gap-2">
            {batches.map((b) => (
              <button
                key={b.id}
                onClick={() => toggleBatch(b.id)}
                className={`text-xs px-3 py-1.5 rounded-full ${
                  batchIds.has(b.id) ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600"
                }`}
              >
                {b.name}
              </button>
            ))}
            {batches.length === 0 && (
              <p className="text-xs text-slate-400">No batches found — leaving this empty makes the assessment visible to all students.</p>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between mb-2">
        <h2 className="font-medium text-slate-700">Select questions from bank ({selected.size} selected)</h2>
        <div className="flex gap-2">
          <button onClick={selectAll} className="text-xs font-medium text-indigo-600 hover:underline">
            Select all ({questions.length})
          </button>
          {selected.size > 0 && (
            <button onClick={clearSelection} className="text-xs font-medium text-slate-500 hover:underline">
              Clear
            </button>
          )}
        </div>
      </div>
      <div className="space-y-2 mb-6">
        {questions.map((q) => (
          <label
            key={q.id}
            className="flex items-start gap-3 bg-white border border-slate-200 rounded-xl p-3 cursor-pointer"
          >
            <input type="checkbox" checked={q.id ? selected.has(q.id) : false} onChange={() => toggle(q.id)} />
            <div>
              <p className="text-sm text-slate-800">{q.questionText}</p>
              <p className="text-xs text-slate-400 capitalize">{q.type} · {q.marks} marks</p>
            </div>
          </label>
        ))}
      </div>

      <button
        onClick={save}
        disabled={saving}
        className="bg-indigo-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
      >
        {saving ? "Creating…" : "Create Assessment"}
      </button>
      {message && <p className="text-sm text-emerald-600 mt-2">{message}</p>}
    </div>
  );
}
