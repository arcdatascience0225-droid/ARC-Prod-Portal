import { useEffect, useState } from "react";
import { api } from "../../services/api";
import ArcLoader from "../../components/ArcLoader";

interface Assignment {
  id: string; title: string; description: string | null;
  dueDate: string | null; maxMarks: number;
}

interface Submission {
  id: string; studentName: string; studentEmail: string;
  submissionType: string; fileUrl: string | null; repoLink: string | null;
  status: string; facultyFeedback: string | null; marksObtained: number | null;
  submittedAt: string;
}

export default function EvaluateAssignmentsPage() {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", dueDate: "", maxMarks: "100" });
  const [attachFile, setAttachFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const [selected, setSelected] = useState<Assignment | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loadingSubs, setLoadingSubs] = useState(false);
  const [gradeDraft, setGradeDraft] = useState<Record<string, { marks: string; feedback: string }>>({});
  const [saving, setSaving] = useState<string | null>(null);

  const loadAssignments = () => {
    setLoading(true);
    api.get<Assignment[]>("/api/v1/performance/assignments/mine").then((r) => setAssignments(r.data)).finally(() => setLoading(false));
  };

  useEffect(() => { loadAssignments(); }, []);

  const createAssignment = async () => {
    if (!form.title.trim()) return;
    setCreating(true);
    try {
      let fileUrl: string | undefined;
      if (attachFile) {
        setUploading(true);
        const fd = new FormData();
        fd.append("file", attachFile);
        const up = await api.post("/api/v1/uploads/file", fd, { headers: { "Content-Type": "multipart/form-data" } });
        fileUrl = up.data.url;
        setUploading(false);
      }
      await api.post("/api/v1/performance/assignments", {
        title: form.title, description: form.description || undefined,
        dueDate: form.dueDate || undefined, maxMarks: Number(form.maxMarks) || 100,
        fileUrl,
      });
      setForm({ title: "", description: "", dueDate: "", maxMarks: "100" });
      setAttachFile(null);
      loadAssignments();
    } finally {
      setCreating(false);
    }
  };

  const openSubmissions = async (a: Assignment) => {
    setSelected(a);
    setLoadingSubs(true);
    try {
      const r = await api.get<Submission[]>(`/api/v1/performance/assignments/${a.id}/submissions`);
      setSubmissions(r.data);
      const drafts: Record<string, { marks: string; feedback: string }> = {};
      r.data.forEach((s) => {
        drafts[s.id] = {
          marks: s.marksObtained != null ? String(s.marksObtained) : "",
          feedback: s.status === "reviewed" ? (s.facultyFeedback || "") : "",
        };
      });
      setGradeDraft(drafts);
    } finally {
      setLoadingSubs(false);
    }
  };

  const saveGrade = async (submissionId: string) => {
    const draft = gradeDraft[submissionId];
    if (!draft || draft.marks === "") return;
    setSaving(submissionId);
    try {
      await api.post(`/api/v1/performance/assignments/submissions/${submissionId}/grade`, {
        marks: Number(draft.marks), feedback: draft.feedback || undefined,
      });
      if (selected) openSubmissions(selected);
    } finally {
      setSaving(null);
    }
  };

  if (loading) return <ArcLoader label="Loading assignments" />;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <h1 className="text-2xl font-semibold text-slate-800">Assignments</h1>

      <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
        <h2 className="font-semibold text-slate-700">Create New Assignment</h2>
        <input
          placeholder="Title"
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
        />
        <textarea
          placeholder="Description / instructions"
          rows={3}
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
        />
        <div className="flex gap-3 flex-wrap">
          <input
            type="date"
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm"
            value={form.dueDate}
            onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
          />
          <input
            type="number"
            placeholder="Max marks"
            className="w-32 border border-slate-300 rounded-lg px-3 py-2 text-sm"
            value={form.maxMarks}
            onChange={(e) => setForm({ ...form, maxMarks: e.target.value })}
          />
          <input
            type="file"
            className="text-sm"
            onChange={(e) => setAttachFile(e.target.files?.[0] || null)}
          />
        </div>
        <button
          onClick={createAssignment}
          disabled={!form.title.trim() || creating}
          className="bg-indigo-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
        >
          {uploading ? "Uploading attachment…" : creating ? "Creating…" : "+ Create Assignment"}
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100">
          <h2 className="font-semibold text-slate-800">My Assignments</h2>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3 text-left">Title</th>
              <th className="px-4 py-3 text-left">Due Date</th>
              <th className="px-4 py-3 text-left">Max Marks</th>
              <th className="px-4 py-3 text-left"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {assignments.map((a) => (
              <tr key={a.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-medium text-slate-800">{a.title}</td>
                <td className="px-4 py-3 text-slate-500">{a.dueDate ? new Date(a.dueDate).toLocaleDateString() : "—"}</td>
                <td className="px-4 py-3 text-slate-500">{a.maxMarks}</td>
                <td className="px-4 py-3">
                  <button onClick={() => openSubmissions(a)} className="text-indigo-600 text-xs font-medium hover:underline">
                    View Submissions →
                  </button>
                </td>
              </tr>
            ))}
            {assignments.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-6 text-center text-slate-400">No assignments created yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setSelected(null)}>
          <div className="bg-white rounded-xl w-full max-w-3xl max-h-[85vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-slate-800 text-lg">{selected.title} — Submissions</h2>
              <button onClick={() => setSelected(null)} className="text-slate-400 hover:text-slate-600 text-xl leading-none">✕</button>
            </div>

            {loadingSubs ? (
              <ArcLoader label="Loading submissions" />
            ) : submissions.length === 0 ? (
              <p className="text-sm text-slate-400">No submissions yet.</p>
            ) : (
              <div className="space-y-4">
                {submissions.map((s) => (
                  <div key={s.id} className="border border-slate-100 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="text-sm font-medium text-slate-800">{s.studentName}</p>
                        <p className="text-xs text-slate-400">{s.studentEmail}</p>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                        s.status === "reviewed" ? "bg-emerald-50 text-emerald-700" :
                        s.status === "ai_checked" ? "bg-indigo-50 text-indigo-700" : "bg-amber-50 text-amber-700"
                      }`}>
                        {s.status === "ai_checked" ? "AI pre-checked" : s.status}
                      </span>
                    </div>

                    {s.fileUrl && (
                      <a href={s.fileUrl} target="_blank" rel="noreferrer" className="text-xs text-indigo-600 hover:underline block mb-1">
                        📎 View submitted file
                      </a>
                    )}
                    {s.repoLink && (
                      <a href={s.repoLink} target="_blank" rel="noreferrer" className="text-xs text-indigo-600 hover:underline block mb-1">
                        🔗 {s.repoLink}
                      </a>
                    )}

                    {s.status === "ai_checked" && s.facultyFeedback && (
                      <div className="bg-indigo-50 rounded-md p-2.5 mt-2 mb-2">
                        <p className="text-xs text-indigo-700">{s.facultyFeedback}</p>
                      </div>
                    )}

                    <div className="flex gap-2 mt-3 flex-wrap items-start">
                      <input
                        type="number"
                        placeholder={`Marks (/${selected.maxMarks})`}
                        className="w-32 border border-slate-300 rounded-md px-2 py-1.5 text-sm"
                        value={gradeDraft[s.id]?.marks ?? ""}
                        onChange={(e) => setGradeDraft({ ...gradeDraft, [s.id]: { ...gradeDraft[s.id], marks: e.target.value, feedback: gradeDraft[s.id]?.feedback ?? "" } })}
                      />
                      <input
                        placeholder="Feedback"
                        className="flex-1 min-w-[200px] border border-slate-300 rounded-md px-2 py-1.5 text-sm"
                        value={gradeDraft[s.id]?.feedback ?? ""}
                        onChange={(e) => setGradeDraft({ ...gradeDraft, [s.id]: { ...gradeDraft[s.id], marks: gradeDraft[s.id]?.marks ?? "", feedback: e.target.value } })}
                      />
                      <button
                        onClick={() => saveGrade(s.id)}
                        disabled={!gradeDraft[s.id]?.marks || saving === s.id}
                        className="bg-slate-800 text-white px-3 py-1.5 rounded-md text-xs disabled:opacity-40"
                      >
                        {saving === s.id ? "Saving…" : s.status === "reviewed" ? "Update" : "Grade"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
