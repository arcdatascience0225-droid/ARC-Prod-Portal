import { useState } from "react";
import { aiAssistantApi } from "../../api/aiAssistantApi";

export default function CareerGuidance() {
  const [question, setQuestion] = useState("");
  const [interestArea, setInterestArea] = useState("");
  const [guidance, setGuidance] = useState("");

  const [goal, setGoal] = useState("");
  const [hours, setHours] = useState(5);
  const [plan, setPlan] = useState<any>(null);

  const [sw, setSw] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const askGuidance = async () => {
    if (!question.trim()) return;
    setLoading(true);
    try {
      const res = await aiAssistantApi.careerGuidance(question, interestArea || undefined);
      setGuidance(res.response);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const buildPlan = async () => {
    if (!goal.trim()) return;
    setLoading(true);
    try {
      const res: any = await aiAssistantApi.generateStudyPlan(goal, undefined, hours);
      setPlan(res.planData);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const runAnalysis = async () => {
    setLoading(true);
    try {
      const res = await aiAssistantApi.strengthWeakness();
      setSw(res);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <h1 className="text-2xl font-bold text-slate-800">Career Guidance & Study Plan</h1>
      {error && <div className="bg-red-50 text-red-700 p-3 rounded-md text-sm">{error}</div>}

      <div className="bg-white rounded-xl shadow p-5 space-y-3">
        <h2 className="font-semibold text-slate-700">Interview Prep / Career Chat</h2>
        <input className="border rounded-md px-3 py-2 w-full" placeholder="Interest area (e.g. backend, data science)" value={interestArea} onChange={(e) => setInterestArea(e.target.value)} />
        <textarea className="border rounded-md px-3 py-2 w-full" rows={3} placeholder="Your question" value={question} onChange={(e) => setQuestion(e.target.value)} />
        <button onClick={askGuidance} disabled={loading} className="bg-slate-800 text-white px-4 py-2 rounded-md text-sm">Ask</button>
        {guidance && <p className="text-sm whitespace-pre-line pt-2">{guidance}</p>}
      </div>

      <div className="bg-white rounded-xl shadow p-5 space-y-3">
        <h2 className="font-semibold text-slate-700">Personal Study Roadmap</h2>
        <input className="border rounded-md px-3 py-2 w-full" placeholder="Goal (e.g. become job-ready in DSA)" value={goal} onChange={(e) => setGoal(e.target.value)} />
        <input type="number" className="border rounded-md px-3 py-2 w-full" placeholder="Hours/week" value={hours} onChange={(e) => setHours(Number(e.target.value))} />
        <button onClick={buildPlan} disabled={loading} className="bg-slate-800 text-white px-4 py-2 rounded-md text-sm">Generate Plan</button>
        {plan?.weeks && (
          <ul className="text-sm space-y-2 pt-2">
            {plan.weeks.map((w: any) => (
              <li key={w.week}><span className="font-semibold">Week {w.week}: {w.focus}</span> — {(w.tasks || []).join("; ")}</li>
            ))}
          </ul>
        )}
      </div>

      <div className="bg-white rounded-xl shadow p-5 space-y-3">
        <h2 className="font-semibold text-slate-700">Strength / Weakness Analysis</h2>
        <button onClick={runAnalysis} disabled={loading} className="bg-slate-800 text-white px-4 py-2 rounded-md text-sm">Analyze My Performance</button>
        {sw && (
          <div className="text-sm space-y-2 pt-2">
            <p><span className="font-semibold">Career Readiness Score:</span> {sw.careerReadinessScore}</p>
            <p><span className="font-semibold">Strengths:</span> {sw.strengths.join(", ") || "-"}</p>
            <p><span className="font-semibold">Weaknesses:</span> {sw.weaknesses.join(", ") || "-"}</p>
            <p className="whitespace-pre-line"><span className="font-semibold">Recommendation:</span> {sw.recommendation}</p>
          </div>
        )}
      </div>
    </div>
  );
}
