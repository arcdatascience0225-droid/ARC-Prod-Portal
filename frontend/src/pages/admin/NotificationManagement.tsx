import { useEffect, useState } from "react";
import { notificationApi } from "../../api/notificationApi";
import { adminApi } from "../../api/adminPlatformApi";
import type { NotificationOut, BatchOut } from "../../types";

const ROLES = [
  { value: "super_admin", label: "Super Admin" },
  { value: "admin", label: "Admin" },
  { value: "faculty", label: "Faculty" },
  { value: "trainer", label: "Trainer" },
  { value: "hr", label: "HR" },
  { value: "placement_coordinator", label: "Placement Coordinator" },
  { value: "student", label: "Student" },
  { value: "guest", label: "Guest" },
];
const CHANNELS = ["in_app", "email", "sms", "push"];

export default function NotificationManagement() {
  const [list, setList] = useState<NotificationOut[]>([]);
  const [batches, setBatches] = useState<BatchOut[]>([]);
  const [form, setForm] = useState({
    title: "", message: "", roles: [] as string[], batchIds: [] as string[], channel: "in_app",
  });
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = () => notificationApi.listAll().then(setList).catch((e) => setError(e.message));
  useEffect(() => {
    load();
    adminApi.listBatches().then(setBatches).catch(() => {});
  }, []);

  const toggleRole = (role: string) => {
    setForm((f) => ({
      ...f,
      roles: f.roles.includes(role) ? f.roles.filter((r) => r !== role) : [...f.roles, role],
    }));
  };

  const toggleBatch = (id: string) => {
    setForm((f) => ({
      ...f,
      batchIds: f.batchIds.includes(id) ? f.batchIds.filter((b) => b !== id) : [...f.batchIds, id],
    }));
  };

  const send = async () => {
    if (!form.title.trim() || !form.message.trim()) {
      setError("Title and message are required.");
      return;
    }
    if (form.roles.length === 0 && form.batchIds.length === 0) {
      setError("Select at least one role or batch to send to.");
      return;
    }
    try {
      await notificationApi.broadcast(form);
      setMessage("Broadcast sent.");
      setError("");
      setForm({ title: "", message: "", roles: [], batchIds: [], channel: "in_app" });
      load();
    } catch (e) {
      setError((e as Error).message);
      setMessage("");
    }
  };

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-slate-800">Notification Management</h1>
      {message && <div className="bg-green-50 text-green-700 p-3 rounded-md text-sm">{message}</div>}
      {error && <div className="bg-red-50 text-red-700 p-3 rounded-md text-sm">{error}</div>}

      <div className="bg-white rounded-xl shadow p-5 space-y-3">
        <h2 className="font-semibold text-slate-700">Broadcast to Groups</h2>
        <p className="text-xs text-slate-500">
          Target by role, by batch, or both. Batch targeting reaches every enrolled student in the selected batches and
          lands in their dashboard notifications.
        </p>
        <input className="border rounded-md px-3 py-2 w-full" placeholder="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        <textarea className="border rounded-md px-3 py-2 w-full" rows={3} placeholder="Message" value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} />
        <div className="flex flex-wrap gap-2">
          {ROLES.map((r) => (
            <button
              key={r.value}
              onClick={() => toggleRole(r.value)}
              className={`px-3 py-1 rounded-full text-xs border ${form.roles.includes(r.value) ? "bg-slate-800 text-white" : "bg-white text-slate-600"}`}
            >
              {r.label}
            </button>
          ))}
        </div>
        <div>
          <p className="text-xs font-medium text-slate-500 mb-1">Batches</p>
          <div className="flex flex-wrap gap-2">
            {batches.map((b) => (
              <button
                key={b.id}
                onClick={() => toggleBatch(b.id)}
                className={`px-3 py-1 rounded-full text-xs border ${form.batchIds.includes(b.id) ? "bg-indigo-600 text-white" : "bg-white text-slate-600"}`}
              >
                {b.name}
              </button>
            ))}
            {batches.length === 0 && <span className="text-xs text-slate-400">No batches available.</span>}
          </div>
        </div>
        <select className="border rounded-md px-3 py-2" value={form.channel} onChange={(e) => setForm({ ...form, channel: e.target.value })}>
          {CHANNELS.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <button onClick={send} className="bg-slate-800 text-white px-4 py-2 rounded-md text-sm block">Send Broadcast</button>
      </div>

      <div className="bg-white rounded-xl shadow p-5">
        <h2 className="font-semibold text-slate-700 mb-3">Recent Notifications</h2>
        <table className="w-full text-sm">
          <thead className="text-slate-500 text-left border-b">
            <tr><th className="py-2">Title</th><th>Type</th><th>Channel</th><th>Status</th><th>Sent</th></tr>
          </thead>
          <tbody>
            {list.map((n) => (
              <tr key={n.id} className="border-b last:border-0">
                <td className="py-2">{n.title}</td>
                <td>{n.type}</td>
                <td>{n.channel}</td>
                <td>{n.status}</td>
                <td>{n.created_at.slice(0, 16).replace("T", " ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
