import { useEffect, useState } from "react";
import ArcLoader from "../../components/ArcLoader";
import { adminApi } from "../../api/adminPlatformApi";
import { analyticsApi } from "../../api/analyticsApi";
import type { AIUsageSummary, AIRevenueAnalytics } from "../../types";

export default function AdminDashboard() {
  const [aiUsage, setAiUsage] = useState<AIUsageSummary[]>([]);
  const [revenue, setRevenue] = useState<AIRevenueAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([adminApi.aiUsageDashboard(), analyticsApi.aiRevenueAnalytics()])
      .then(([usage, rev]) => {
        setAiUsage(usage);
        setRevenue(rev);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-slate-800">Admin Dashboard</h1>
      {error && <div className="bg-red-50 text-red-700 p-3 rounded-md text-sm">{error}</div>}
      {loading ? (
        <ArcLoader />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl shadow p-5">
            <p className="text-slate-500 text-sm">Total AI Cost</p>
            <p className="text-2xl font-semibold text-slate-800">${revenue?.totalAiCost.toFixed(4)}</p>
          </div>
          <div className="bg-white rounded-xl shadow p-5">
            <p className="text-slate-500 text-sm">Total AI Tokens</p>
            <p className="text-2xl font-semibold text-slate-800">{revenue?.totalTokens}</p>
          </div>
          <div className="bg-white rounded-xl shadow p-5">
            <p className="text-slate-500 text-sm">Active Modules</p>
            <p className="text-2xl font-semibold text-slate-800">{aiUsage.length}</p>
          </div>
        </div>
      )}
      <div className="bg-white rounded-xl shadow p-5">
        <h2 className="font-semibold text-slate-700 mb-3">AI Usage by Module</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500 border-b">
              <th className="py-2">Module</th>
              <th>Requests</th>
              <th>Tokens</th>
              <th>Cost ($)</th>
            </tr>
          </thead>
          <tbody>
            {aiUsage.map((row) => (
              <tr key={row.module} className="border-b last:border-0">
                <td className="py-2">{row.module}</td>
                <td>{row.requestCount}</td>
                <td>{row.totalTokens}</td>
                <td>{row.totalCost.toFixed(4)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
