import React, { useEffect, useState } from "react";
import { hrApi } from "../../api/placementApi";
import { Offer, Application } from "../../types/placement";
import StatusBadge from "../../components/StatusBadge";

export default function OffersPage() {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    applicationId: "",
    designation: "",
    salaryOffered: "",
    location: "",
    joiningDate: "",
  });
  const [error, setError] = useState("");

  const load = async () => {
    const [o, a] = await Promise.all([hrApi.listOffers(), hrApi.listAllApplications()]);
    setOffers(o);
    // only applications not yet offered can get a new offer
    setApplications(a.filter((app) => ["shortlisted", "interview"].includes(app.status)));
  };

  useEffect(() => {
    load();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      await hrApi.createOffer({
        applicationId: form.applicationId,
        designation: form.designation,
        salaryOffered: Number(form.salaryOffered),
        location: form.location || undefined,
        joiningDate: form.joiningDate || undefined,
      });
      setShowForm(false);
      setForm({ applicationId: "", designation: "", salaryOffered: "", location: "", joiningDate: "" });
      load();
    } catch (e: any) {
      setError(e.message);
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Offers & Placement Tracking</h1>
        <button
          onClick={() => setShowForm(true)}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
        >
          + Issue Offer
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm border border-gray-200 rounded-xl overflow-hidden">
          <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-2">Designation</th>
              <th className="text-left px-4 py-2">Salary</th>
              <th className="text-left px-4 py-2">Location</th>
              <th className="text-left px-4 py-2">Joining Date</th>
              <th className="text-left px-4 py-2">Status</th>
              <th className="text-left px-4 py-2">Issued</th>
            </tr>
          </thead>
          <tbody>
            {offers.map((o) => (
              <tr key={o.id} className="border-t border-gray-100">
                <td className="px-4 py-2">{o.designation}</td>
                <td className="px-4 py-2">₹{o.salaryOffered.toLocaleString()}</td>
                <td className="px-4 py-2">{o.location || "—"}</td>
                <td className="px-4 py-2">
                  {o.joiningDate ? new Date(o.joiningDate).toLocaleDateString() : "—"}
                </td>
                <td className="px-4 py-2">
                  <StatusBadge status={o.status} />
                </td>
                <td className="px-4 py-2 text-gray-500">{new Date(o.issuedAt).toLocaleDateString()}</td>
              </tr>
            ))}
            {offers.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-gray-500">
                  No offers issued yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg">
            <h2 className="text-lg font-semibold mb-4">Issue Offer</h2>
            <form onSubmit={submit} className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-600">Application</label>
                <select
                  required
                  value={form.applicationId}
                  onChange={(e) => setForm({ ...form, applicationId: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-1"
                >
                  <option value="">Select application</option>
                  {applications.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.jobTitle} @ {a.companyName} — {a.studentId}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">Designation</label>
                <input
                  required
                  value={form.designation}
                  onChange={(e) => setForm({ ...form, designation: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-1"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600">Salary Offered (annual)</label>
                  <input
                    required
                    type="number"
                    value={form.salaryOffered}
                    onChange={(e) => setForm({ ...form, salaryOffered: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Location</label>
                  <input
                    value={form.location}
                    onChange={(e) => setForm({ ...form, location: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-1"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">Joining Date</label>
                <input
                  type="date"
                  value={form.joiningDate}
                  onChange={(e) => setForm({ ...form, joiningDate: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-1"
                />
              </div>
              {error && <p className="text-red-600 text-sm">{error}</p>}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 rounded-lg text-sm bg-gray-100 hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 rounded-lg text-sm bg-indigo-600 text-white hover:bg-indigo-700">
                  Issue Offer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
