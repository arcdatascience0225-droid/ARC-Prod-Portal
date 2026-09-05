import React, { useEffect, useState } from "react";
import { ErrorBanner, extractErrorMessage } from "../../components/FormControls";
import { adminApi } from "../../services/adminUsersApi";
import { SignInLogItem } from "../../types";

export const SignInLogsPage: React.FC = () => {
  const [logs, setLogs] = useState<SignInLogItem[]>([]);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminApi
      .signInLogs({ limit: 100 })
      .then(({ data }) => {
        setLogs(data.items);
        setTotal(data.total);
      })
      .catch((err) => setError(extractErrorMessage(err)))
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      <h1 className="font-display text-2xl font-bold text-ink-900">Sign-in activity</h1>
      <p className="mt-1 text-sm text-slate-500">{total} total sign-in events recorded.</p>

      <div className="mt-4">
        <ErrorBanner message={error} />
      </div>

      <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">User ID</th>
              <th className="px-4 py-3">IP Address</th>
              <th className="px-4 py-3">Device</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Time</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-slate-400">
                  <span className="inline-flex items-center gap-1.5"><span className="text-primary font-black text-xs">ARC</span> Loading…</span>
                </td>
              </tr>
            ) : logs.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-slate-400">
                  No sign-in activity yet.
                </td>
              </tr>
            ) : (
              logs.map((l) => (
                <tr key={l.id}>
                  <td className="px-4 py-3 font-mono text-xs text-ink-700">{l.userId}</td>
                  <td className="px-4 py-3 text-slate-600">{l.ipAddress || "—"}</td>
                  <td className="px-4 py-3 max-w-xs truncate text-slate-500">{l.userAgent || "—"}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                        l.status === "success" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
                      }`}
                    >
                      {l.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-500">{new Date(l.createdAt).toLocaleString()}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );
};
