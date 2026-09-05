import { useEffect, useState } from "react";
import {
  listQuestionBank, createQuestion, deleteQuestion, generateQuestionsWithAI,
} from "../../api/facultyApi";
import { Question, QuestionType } from "../../types";

const TYPES: QuestionType[] = ["mcq", "coding", "sql", "descriptive"];

export default function QuestionBankPage() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [filterType, setFilterType] = useState<string>("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<Question>({ questionText: "", type: "mcq", marks: 1 });
  const [mcqOptions, setMcqOptions] = useState<string[]>(["", "", "", ""]);
  const [correctOption, setCorrectOption] = useState("");

  const [showAI, setShowAI] = useState(false);
  const [aiTopic, setAiTopic] = useState("");
  const [aiType, setAiType] = useState<QuestionType>("mcq");
  const [aiCount, setAiCount] = useState(5);
  const [aiDifficulty, setAiDifficulty] = useState("medium");
  const [aiLoading, setAiLoading] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggleExpanded = (id?: string) => {
    if (!id) return;
    const next = new Set(expanded);
    next.has(id) ? next.delete(id) : next.add(id);
    setExpanded(next);
  };

  useEffect(() => {
    refresh();
  }, [filterType]);

  const refresh = async () => {
    const data = await listQuestionBank(filterType || undefined);
    setQuestions(data);
  };

  const submitQuestion = async () => {
    const payload: Question = { ...form };
    if (form.type === "mcq") {
      const filledOptions = mcqOptions.filter(Boolean);
      if (filledOptions.length < 2) {
        alert("Please add at least 2 options for this MCQ question.");
        return;
      }
      if (!correctOption || !filledOptions.includes(correctOption)) {
        alert("Please select the correct option before saving.");
        return;
      }
      payload.data = { options: filledOptions, correctOption };
    }
    await createQuestion(payload);
    setForm({ questionText: "", type: "mcq", marks: 1 });
    setMcqOptions(["", "", "", ""]);
    setCorrectOption("");
    setShowForm(false);
    refresh();
  };

  const remove = async (id?: string) => {
    if (!id) return;
    await deleteQuestion(id);
    refresh();
  };

  const removeAll = async () => {
    if (questions.length === 0) return;
    const label = filterType ? `all ${filterType.toUpperCase()} questions` : "ALL questions in the bank";
    if (!window.confirm(`Delete ${label} (${questions.length})? This cannot be undone.`)) return;
    const results = await Promise.allSettled(
      questions.filter(q => q.id).map(q => deleteQuestion(q.id as string))
    );
    const failed = results.filter(r => r.status === "rejected").length;
    if (failed > 0) {
      alert(`${failed} question(s) could not be deleted. The rest were removed.`);
    }
    refresh();
  };

  const runAIGenerate = async () => {
    setAiLoading(true);
    await generateQuestionsWithAI({
      topic: aiTopic, type: aiType, difficulty: aiDifficulty, count: aiCount, saveToBank: true,
    });
    setAiLoading(false);
    setShowAI(false);
    refresh();
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-slate-800">Question Bank</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setShowAI(!showAI)}
            className="bg-purple-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-purple-700"
          >
            ✨ Generate with AI
          </button>
          <button
            onClick={() => setShowForm(!showForm)}
            className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700"
          >
            + Add Question
          </button>
          {questions.length > 0 && (
            <button
              onClick={removeAll}
              className="bg-red-50 text-red-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-100"
            >
              🗑 Delete All{filterType ? ` (${filterType})` : ""}
            </button>
          )}
        </div>
      </div>

      {showAI && (
        <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 mb-6 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <input
              placeholder="Topic (e.g. Python decorators)"
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm"
              value={aiTopic}
              onChange={(e) => setAiTopic(e.target.value)}
            />
            <select
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm"
              value={aiType}
              onChange={(e) => setAiType(e.target.value as QuestionType)}
            >
              {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <select
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm"
              value={aiDifficulty}
              onChange={(e) => setAiDifficulty(e.target.value)}
            >
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
            <input
              type="number"
              min={1}
              max={20}
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm"
              value={aiCount}
              onChange={(e) => setAiCount(Number(e.target.value))}
            />
          </div>
          <button
            onClick={runAIGenerate}
            disabled={aiLoading || !aiTopic}
            className="bg-purple-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50"
          >
            {aiLoading ? "Generating…" : "Generate & Save to Bank"}
          </button>
        </div>
      )}

      {showForm && (
        <div className="bg-white border border-slate-200 rounded-xl p-4 mb-6 space-y-3">
          <textarea
            placeholder="Question text"
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
            value={form.questionText}
            onChange={(e) => setForm({ ...form, questionText: e.target.value })}
          />
          <div className="flex gap-3">
            <select
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm"
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value as QuestionType })}
            >
              {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <input
              type="number"
              placeholder="Marks"
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm w-24"
              value={form.marks}
              onChange={(e) => setForm({ ...form, marks: Number(e.target.value) })}
            />
          </div>
          {form.type === "mcq" && (
            <div className="space-y-2">
              {mcqOptions.map((opt, i) => (
                <input
                  key={i}
                  placeholder={`Option ${i + 1}`}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                  value={opt}
                  onChange={(e) => {
                    const next = [...mcqOptions];
                    next[i] = e.target.value;
                    setMcqOptions(next);
                  }}
                />
              ))}
              <input
                placeholder="Correct option (exact text)"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                value={correctOption}
                onChange={(e) => setCorrectOption(e.target.value)}
              />
            </div>
          )}
          <button
            onClick={submitQuestion}
            className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-emerald-700"
          >
            Save Question
          </button>
        </div>
      )}

      <div className="flex gap-2 mb-4">
        {["", ...TYPES].map((t) => (
          <button
            key={t}
            onClick={() => setFilterType(t)}
            className={`text-xs px-3 py-1.5 rounded-full capitalize ${
              filterType === t ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-600"
            }`}
          >
            {t || "All"}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {questions.map((q) => {
          const isOpen = q.id ? expanded.has(q.id) : false;
          const data = (q.data || {}) as any;
          return (
            <div key={q.id} className="bg-white border border-slate-200 rounded-xl p-4">
              <div className="flex justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium text-slate-800 whitespace-pre-wrap">{q.questionText}</p>
                  <p className="text-xs text-slate-400 mt-1 capitalize">
                    {q.type} · {q.marks} marks {q.tags?.length ? `· ${q.tags.join(", ")}` : ""}
                  </p>
                </div>
                <div className="flex items-start gap-3 shrink-0">
                  <button onClick={() => toggleExpanded(q.id)} className="text-xs text-indigo-600 hover:underline h-fit">
                    {isOpen ? "Hide answer" : "Show answer"}
                  </button>
                  <button onClick={() => remove(q.id)} className="text-xs text-rose-600 hover:underline h-fit">
                    Delete
                  </button>
                </div>
              </div>

              {isOpen && (
                <div className="mt-3 pt-3 border-t border-slate-100 text-sm">
                  {q.type === "mcq" && Array.isArray(data.options) && (
                    <div className="space-y-1">
                      {data.options.map((opt: string, i: number) => (
                        <div
                          key={i}
                          className={`px-2 py-1 rounded ${
                            opt === data.correctOption ? "bg-emerald-50 text-emerald-700 font-medium" : "text-slate-600"
                          }`}
                        >
                          {opt === data.correctOption ? "✓ " : ""}{opt}
                        </div>
                      ))}
                    </div>
                  )}
                  {q.type === "sql" && (
                    <div className="space-y-1 text-slate-600">
                      {(data.schemaDisplay || data.schema) && (
                        <p className="whitespace-pre-wrap"><span className="font-medium">Schema:</span> {data.schemaDisplay || data.schema}</p>
                      )}
                      {(data.correctQuery || data.expectedQuery) && (
                        <p><span className="font-medium">Correct query:</span> <code className="bg-slate-50 px-1 rounded">{data.correctQuery || data.expectedQuery}</code></p>
                      )}
                    </div>
                  )}
                  {q.type === "descriptive" && data.guidelines && (
                    <p className="text-slate-600"><span className="font-medium">Guidelines:</span> {data.guidelines}</p>
                  )}
                  {q.type === "coding" && (
                    <p className="text-slate-500">Coding question — starter code & test cases are shown when this question is opened in an assessment.</p>
                  )}
                  {!data.options && !data.expectedQuery && !data.correctQuery && !data.guidelines && q.type !== "coding" && (
                    <p className="text-slate-400">No answer key stored for this question.</p>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {questions.length === 0 && <p className="text-sm text-slate-400">No questions in bank yet.</p>}
      </div>
    </div>
  );
}
