import { useEffect, useState } from "react";
import { api } from "../../services/api";
import ArcLoader from "../../components/ArcLoader";

interface Lead {
  id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  courseInterested?: string | null;
  requirement?: string | null;
  source?: string | null;
  status: string;
  notes?: string | null;
  createdAt: string;
}

const EMPTY_FORM = { name: "", phone: "", email: "", courseInterested: "", requirement: "", source: "", notes: "" };
const STATUSES = ["new", "contacted", "follow_up", "converted", "lost"];
const STATUS_COLORS: Record<string, string> = {
  new: "bg-blue-50 text-blue-700",
  contacted: "bg-amber-50 text-amber-700",
  follow_up: "bg-violet-50 text-violet-700",
  converted: "bg-emerald-50 text-emerald-700",
  lost: "bg-red-50 text-red-700",
};

export default function Leads() {
  const [leads, setLeads] = useState<Lead[] | null>(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = () => {
    api.get<Lead[]>("/api/v1/leads", { params: { status: statusFilter || undefined, search: search || undefined } })
      .then((r) => setLeads(r.data))
      .catch(() => setError("Failed to load leads."));
  };

  useEffect(() => { load(); }, [statusFilter]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { setError("Name is required."); return; }
    setSaving(true);
    setError("");
    try {
      await api.post("/api/v1/leads", form);
      setForm(EMPTY_FORM);
      setShowForm(false);
      load();
    } catch {
      setError("Failed to save the enquiry.");
    } finally {
      setSaving(false);
    }
  };

  const updateStatus = async (id: string, status: string) => {
    try {
      await api.put(`/api/v1/leads/${id}`, { status });
      load();
    } catch {
      setError("Failed to update status.");
    }
  };

  const deleteLead = async (id: string) => {
    if (!confirm("Delete this lead?")) return;
    try {
      await api.delete(`/api/v1/leads/${id}`);
      load();
    } catch {
      setError("Failed to delete lead.");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Leads</h1>
          <p className="text-sm text-gray-500 mt-1">Enquiries and prospective student requirements.</p>
        </div>
        <button onClick={() => setShowForm((v) => !v)}
          className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-semibold">
          {showForm ? "Cancel" : "+ New Enquiry"}
        </button>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3">{error}</div>}

      {showForm && (
        <form onSubmit={handleCreate} className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
          <h2 className="text-sm font-semibold text-gray-700">Enquiry Form</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input className="input" placeholder="Full name *" value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            <input className="input" placeholder="Phone" value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            <input className="input" placeholder="Email" value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <input className="input" placeholder="Course interested in" value={form.courseInterested}
              onChange={(e) => setForm({ ...form, courseInterested: e.target.value })} />
            <input className="input" placeholder="Source (walk-in, referral, website...)" value={form.source}
              onChange={(e) => setForm({ ...form, source: e.target.value })} />
          </div>
          <textarea className="input min-h-[80px]" placeholder="Requirement / enquiry details"
            value={form.requirement} onChange={(e) => setForm({ ...form, requirement: e.target.value })} />
          <textarea className="input min-h-[60px]" placeholder="Internal notes (optional)"
            value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          <button type="submit" disabled={saving}
            className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-semibold disabled:opacity-50">
            {saving ? "Saving…" : "Save Enquiry"}
          </button>
        </form>
      )}

      <div className="flex gap-3 flex-wrap">
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
          <option value="">All statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
        </select>
        <input type="text" placeholder="Search name/phone/email" value={search}
          onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === "Enter" && load()}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm flex-1 min-w-[180px]" />
        <button onClick={load} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm">Search</button>
      </div>

      {leads === null ? (
        <ArcLoader label="Loading leads" />
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3 text-left">Name</th>
                <th className="px-4 py-3 text-left">Contact</th>
                <th className="px-4 py-3 text-left">Course Interested</th>
                <th className="px-4 py-3 text-left">Requirement</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Added</th>
                <th className="px-4 py-3 text-left"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {leads.map((l) => (
                <tr key={l.id}>
                  <td className="px-4 py-3 font-medium text-gray-800">{l.name}</td>
                  <td className="px-4 py-3 text-gray-500">
                    {l.phone && <div>{l.phone}</div>}
                    {l.email && <div>{l.email}</div>}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{l.courseInterested || "—"}</td>
                  <td className="px-4 py-3 text-gray-500 max-w-[220px] truncate" title={l.requirement || ""}>{l.requirement || "—"}</td>
                  <td className="px-4 py-3">
                    <select value={l.status} onChange={(e) => updateStatus(l.id, e.target.value)}
                      className={`text-xs px-2 py-1 rounded-full font-semibold border-0 ${STATUS_COLORS[l.status] || "bg-gray-50 text-gray-600"}`}>
                      {STATUSES.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-3 text-gray-400">{new Date(l.createdAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => deleteLead(l.id)} className="text-xs text-red-600 hover:underline">Delete</button>
                  </td>
                </tr>
              ))}
              {leads.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-6 text-center text-gray-400">No leads yet. Click "+ New Enquiry" to add one.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
