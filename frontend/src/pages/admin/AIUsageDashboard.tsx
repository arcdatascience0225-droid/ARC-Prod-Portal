import { useEffect, useState } from "react";
import { adminApi } from "../../api/adminPlatformApi";
import { analyticsApi } from "../../api/analyticsApi";
import type { AIUsageSummary, AIRevenueAnalytics } from "../../types";

export default function AIUsageDashboard() {
  const [usage, setUsage] = useState<AIUsageSummary[]>([]);
  const [revenue, setRevenue] = useState<AIRevenueAnalytics | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([adminApi.aiUsageDashboard(), analyticsApi.aiRevenueAnalytics()])
      .then(([u, r]) => {
        setUsage(u);
        setRevenue(r);
      })
      .catch((e) => setError(e.message));
  }, []);

  const maxTokens = Math.max(1, ...usage.map((u) => u.totalTokens));

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-slate-800">AI / Service Usage Monitoring</h1>
      {error && <div className="bg-red-50 text-red-700 p-3 rounded-md text-sm">{error}</div>}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl shadow p-5">
          <p className="text-slate-500 text-sm">Total Cost</p>
          <p className="text-2xl font-semibold">${revenue?.totalAiCost.toFixed(4) ?? "0.0000"}</p>
        </div>
        <div className="bg-white rounded-xl shadow p-5">
          <p className="text-slate-500 text-sm">Total Tokens</p>
          <p className="text-2xl font-semibold">{revenue?.totalTokens ?? 0}</p>
        </div>
        <div className="bg-white rounded-xl shadow p-5">
          <p className="text-slate-500 text-sm">Modules Tracked</p>
          <p className="text-2xl font-semibold">{usage.length}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow p-5 space-y-3">
        <h2 className="font-semibold text-slate-700">Token Usage by Module</h2>
        {usage.map((u) => (
          <div key={u.module}>
            <div className="flex justify-between text-sm mb-1">
              <span>{u.module}</span>
              <span>{u.totalTokens} tokens · {u.requestCount} req · ${u.totalCost.toFixed(4)}</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-2">
              <div className="bg-slate-800 h-2 rounded-full" style={{ width: `${(u.totalTokens / maxTokens) * 100}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
