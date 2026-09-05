import { useEffect, useState } from "react";
import { getMyBatches, broadcastAnnouncement, getMyAnnouncements } from "../../api/facultyApi";
import { FacultyBatch, Announcement } from "../../types";

export default function AnnouncementsPage() {
  const [batches, setBatches] = useState<FacultyBatch[]>([]);
  const [batchIds, setBatchIds] = useState<Set<string>>(new Set());
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [sentInfo, setSentInfo] = useState("");

  useEffect(() => {
    getMyBatches().then(setBatches);
    refresh();
  }, []);

  const refresh = () => getMyAnnouncements().then(setAnnouncements);

  const toggleBatch = (id: string) => {
    const next = new Set(batchIds);
    next.has(id) ? next.delete(id) : next.add(id);
    setBatchIds(next);
  };

  const send = async () => {
    setError("");
    setSentInfo("");
    if (!title || !message) { setError("Title and message are required."); return; }
    if (batchIds.size === 0) { setError("Select at least one batch to broadcast to."); return; }
    setSending(true);
    try {
      const created = await broadcastAnnouncement({ title, message, batchIds: [...batchIds] });
      // The backend now returns how many people actually got a notification,
      // which makes silent no-delivery (e.g. an empty batch) visible.
      const count = created?.recipientCount ?? 0;
      setSentInfo(
        count > 0
          ? `Announcement delivered to ${count} recipient${count === 1 ? "" : "s"}.`
          : "Announcement saved, but no one is enrolled in the selected batch(es) — nobody was notified."
      );
      setTitle(""); setMessage(""); setBatchIds(new Set());
      refresh();
    } catch (e: any) {
      setError(e.message || "Failed to send announcement.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-semibold text-slate-800 mb-6">Announcements</h1>

      <div className="bg-white border border-slate-200 rounded-xl p-4 mb-6 space-y-3">
        <input
          placeholder="Title"
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <textarea
          placeholder="Message"
          rows={4}
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
        <div className="flex flex-wrap gap-2">
          {batches.map((b) => (
            <button
              key={b.id}
              onClick={() => toggleBatch(b.id)}
              className={`text-xs px-3 py-1.5 rounded-full ${
                batchIds.has(b.id) ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600"
              }`}
            >
              {b.name}
            </button>
          ))}
          {batches.length === 0 && (
            <p className="text-xs text-slate-400">No batches found. Create a batch under Courses & Batches first.</p>
          )}
        </div>
        {error && <p className="text-xs text-red-600">{error}</p>}
        {sentInfo && <p className="text-xs text-emerald-700">{sentInfo}</p>}
        <button
          onClick={send}
          disabled={sending}
          className="bg-indigo-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
        >
          {sending ? "Sending…" : "Broadcast"}
        </button>
      </div>

      <h2 className="font-medium text-slate-700 mb-2">Sent Announcements</h2>
      <div className="space-y-3">
        {announcements.map((a) => (
          <div key={a.id} className="bg-white border border-slate-200 rounded-xl p-4">
            <p className="font-medium text-slate-800">{a.title}</p>
            <p className="text-sm text-slate-600 mt-1">{a.message}</p>
            <p className="text-xs text-slate-400 mt-2">
              {new Date(a.createdAt).toLocaleString()}
              {a.batchIds?.length ? ` · ${a.batchIds.length} batch(es)` : ""}
            </p>
          </div>
        ))}
        {announcements.length === 0 && <p className="text-sm text-slate-400">No announcements sent yet.</p>}
      </div>
    </div>
  );
}
