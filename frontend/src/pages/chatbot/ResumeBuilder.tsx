import { useState } from "react";
import { aiAssistantApi } from "../../api/aiAssistantApi";

export default function ResumeBuilder() {
  const [profile, setProfile] = useState({ name: "", education: "", skills: "" });
  const [achievements, setAchievements] = useState("");
  const [targetRole, setTargetRole] = useState("");
  const [resumeText, setResumeText] = useState("");
  const [suggestions, setSuggestions] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const generate = async () => {
    setLoading(true);
    setError("");
    try {
      const res: any = await aiAssistantApi.generateResume(
        profile,
        achievements.split("\n").filter(Boolean),
        targetRole || undefined
      );
      setResumeText(res.aiGeneratedText || "");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const improve = async () => {
    if (!resumeText) return;
    setLoading(true);
    try {
      const res = await aiAssistantApi.improveResume(resumeText, targetRole || undefined);
      setSuggestions(res.suggestions);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <h1 className="text-2xl font-bold text-slate-800">AI Resume Builder</h1>
      {error && <div className="bg-red-50 text-red-700 p-3 rounded-md text-sm">{error}</div>}

      <div className="bg-white rounded-xl shadow p-5 space-y-3">
        <input className="border rounded-md px-3 py-2 w-full" placeholder="Full name" value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} />
        <input className="border rounded-md px-3 py-2 w-full" placeholder="Education" value={profile.education} onChange={(e) => setProfile({ ...profile, education: e.target.value })} />
        <input className="border rounded-md px-3 py-2 w-full" placeholder="Skills (comma separated)" value={profile.skills} onChange={(e) => setProfile({ ...profile, skills: e.target.value })} />
        <textarea className="border rounded-md px-3 py-2 w-full" rows={3} placeholder="Achievements (one per line)" value={achievements} onChange={(e) => setAchievements(e.target.value)} />
        <input className="border rounded-md px-3 py-2 w-full" placeholder="Target role (optional)" value={targetRole} onChange={(e) => setTargetRole(e.target.value)} />
        <button onClick={generate} disabled={loading} className="bg-slate-800 text-white px-4 py-2 rounded-md text-sm disabled:opacity-50">
          {loading ? (<span className="inline-flex items-center gap-2"><span className="w-3.5 h-3.5 border-2 border-white/70 border-t-transparent rounded-full animate-spin" /> Generating…</span>) : "Generate Resume"}
        </button>
      </div>

      {resumeText && (
        <div className="bg-white rounded-xl shadow p-5 space-y-3">
          <h2 className="font-semibold text-slate-700">Generated Resume</h2>
          <textarea className="border rounded-md px-3 py-2 w-full font-mono text-xs" rows={14} value={resumeText} onChange={(e) => setResumeText(e.target.value)} />
          <button onClick={improve} disabled={loading} className="bg-slate-100 text-slate-800 px-4 py-2 rounded-md text-sm">
            Get Improvement Suggestions
          </button>
        </div>
      )}

      {suggestions && (
        <div className="bg-white rounded-xl shadow p-5">
          <h2 className="font-semibold text-slate-700 mb-2">Suggestions</h2>
          <p className="text-sm whitespace-pre-line">{suggestions}</p>
        </div>
      )}
    </div>
  );
}
