import React, { useEffect, useState } from "react";
import ArcLoader from "../../components/ArcLoader";
import { hrApi } from "../../api/placementApi";
import { Company } from "../../types/placement";

const emptyForm = {
  name: "",
  industry: "",
  website: "",
  hrContactName: "",
  hrContactEmail: "",
  hrContactPhone: "",
  address: "",
};

export default function CompaniesPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const data = await hrApi.listCompanies(search);
      setCompanies(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    load();
  };

  const openCreate = () => {
    setForm(emptyForm);
    setEditingId(null);
    setShowForm(true);
  };

  const openEdit = (c: Company) => {
    setForm({
      name: c.name,
      industry: c.industry || "",
      website: c.website || "",
      hrContactName: c.hrContactName || "",
      hrContactEmail: c.hrContactEmail || "",
      hrContactPhone: c.hrContactPhone || "",
      address: c.address || "",
    });
    setEditingId(c.id);
    setShowForm(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      if (editingId) {
        await hrApi.updateCompany(editingId, form);
      } else {
        await hrApi.createCompany(form);
      }
      setShowForm(false);
      load();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this company? This cannot be undone.")) return;
    await hrApi.deleteCompany(id);
    load();
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Company Records</h1>
        <button
          onClick={openCreate}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
        >
          + Add Company
        </button>
      </div>

      <form onSubmit={handleSearch} className="mb-4 flex gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search companies..."
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-72"
        />
        <button className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm">Search</button>
      </form>

      {error && <div className="mb-4 text-red-600 text-sm">{error}</div>}

      {loading ? (
        <ArcLoader />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {companies.map((c) => (
            <div key={c.id} className="border border-gray-200 rounded-xl p-4 bg-white shadow-sm">
              <div className="flex justify-between items-start">
                <h3 className="font-semibold text-gray-900">{c.name}</h3>
                <div className="flex gap-2 text-xs">
                  <button onClick={() => openEdit(c)} className="text-indigo-600 hover:underline">
                    Edit
                  </button>
                  <button onClick={() => remove(c.id)} className="text-red-600 hover:underline">
                    Delete
                  </button>
                </div>
              </div>
              <p className="text-sm text-gray-500">{c.industry || "—"}</p>
              {c.website && (
                <a href={c.website} target="_blank" rel="noreferrer" className="text-xs text-indigo-500 block mt-1">
                  {c.website}
                </a>
              )}
              <div className="mt-3 text-xs text-gray-600 space-y-0.5">
                {c.hrContactName && <p>Contact: {c.hrContactName}</p>}
                {c.hrContactEmail && <p>{c.hrContactEmail}</p>}
                {c.hrContactPhone && <p>{c.hrContactPhone}</p>}
              </div>
            </div>
          ))}
          {companies.length === 0 && <p className="text-gray-500 col-span-full">No companies found.</p>}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-semibold mb-4">{editingId ? "Edit Company" : "Add Company"}</h2>
            <form onSubmit={submit} className="space-y-3">
              {[
                ["name", "Company Name"],
                ["industry", "Industry"],
                ["website", "Website"],
                ["hrContactName", "HR Contact Name"],
                ["hrContactEmail", "HR Contact Email"],
                ["hrContactPhone", "HR Contact Phone"],
                ["address", "Address"],
              ].map(([key, label]) => (
                <div key={key}>
                  <label className="text-xs font-medium text-gray-600">{label}</label>
                  <input
                    required={key === "name"}
                    value={(form as any)[key]}
                    onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-1"
                  />
                </div>
              ))}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 rounded-lg text-sm bg-gray-100 hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 rounded-lg text-sm bg-indigo-600 text-white hover:bg-indigo-700">
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
