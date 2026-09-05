import { useEffect, useState } from "react";
import { adminApi } from "../../api/adminPlatformApi";
import type { AuditLogOut } from "../../types";

export default function AuditLog() {
  const [logs, setLogs] = useState<AuditLogOut[]>([]);
  const [module, setModule] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    adminApi.listAuditLogs(module || undefined).then(setLogs).catch((e) => setError(e.message));
  }, [module]);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">Audit Log</h1>
        <input className="border rounded-md px-3 py-2 text-sm" placeholder="Filter by module" value={module} onChange={(e) => setModule(e.target.value)} />
      </div>
      {error && <div className="bg-red-50 text-red-700 p-3 rounded-md text-sm">{error}</div>}
      <div className="bg-white rounded-xl shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              <th className="text-left p-3">Time</th>
              <th className="text-left p-3">Module</th>
              <th className="text-left p-3">Action</th>
              <th className="text-left p-3">Entity</th>
              <th className="text-left p-3">Details</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((l) => (
              <tr key={l.id} className="border-t align-top">
                <td className="p-3 whitespace-nowrap">{l.created_at.slice(0, 19).replace("T", " ")}</td>
                <td className="p-3">{l.module}</td>
                <td className="p-3">{l.action}</td>
                <td className="p-3">{l.entity_type} {l.entity_id ? `#${l.entity_id.slice(0, 8)}` : ""}</td>
                <td className="p-3 font-mono text-xs">{JSON.stringify(l.details)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
