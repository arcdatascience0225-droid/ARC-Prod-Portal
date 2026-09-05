import { useState } from "react";
import { adminApi } from "../../api/adminPlatformApi";

export default function PlatformSettings() {
  const [key, setKey] = useState("");
  const [value, setValue] = useState("{}");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const save = async () => {
    try {
      const parsed = JSON.parse(value);
      await adminApi.upsertSetting(key, parsed);
      setMessage("Setting saved.");
      setError("");
    } catch (e) {
      setError((e as Error).message);
      setMessage("");
    }
  };

  return (
    <div className="p-6 space-y-4 max-w-xl">
      <h1 className="text-2xl font-bold text-slate-800">Platform Settings</h1>
      {message && <div className="bg-green-50 text-green-700 p-3 rounded-md text-sm">{message}</div>}
      {error && <div className="bg-red-50 text-red-700 p-3 rounded-md text-sm">{error}</div>}
      <div className="bg-white rounded-xl shadow p-5 space-y-3">
        <input className="border rounded-md px-3 py-2 w-full" placeholder="Setting key (e.g. max_assessment_duration)" value={key} onChange={(e) => setKey(e.target.value)} />
        <textarea className="border rounded-md px-3 py-2 w-full font-mono text-sm" rows={5} placeholder='{"value": 60}' value={value} onChange={(e) => setValue(e.target.value)} />
        <button onClick={save} className="bg-slate-800 text-white px-4 py-2 rounded-md text-sm">Save Setting</button>
      </div>
    </div>
  );
}
