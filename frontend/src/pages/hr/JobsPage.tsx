import React, { useEffect, useState } from "react";
import ArcLoader from "../../components/ArcLoader";
import { hrApi } from "../../api/placementApi";
import { registrationApi } from "../../services/registrationApi";
import { Job, Company } from "../../types/placement";
import type { Batch } from "../../types";
import StatusBadge from "../../components/StatusBadge";

const emptyForm = {
  companyId: "",
  title: "",
  description: "",
  requiredSkills: "",
  minExperienceYears: 0,
  minScorePercent: 0,
  jobType: "full_time",
  location: "",
  salaryMin: "",
  salaryMax: "",
  openings: 1,
  targetBatchIds: [] as string[],
};

export default function JobsPage({ onViewJob }: { onViewJob?: (jobId: string) => void }) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [statusFilter, setStatusFilter] = useState("");
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const [jobList, companyList] = await Promise.all([
        hrApi.listJobs(statusFilter ? { status: statusFilter } : {}),
        hrApi.listCompanies(),
      ]);
      setJobs(jobList);
      setCompanies(companyList);
      // Load all batches for batch targeting
      registrationApi.listBatches().then(r => setBatches(r.data)).catch(() => {});
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      await hrApi.createJob({
        companyId: form.companyId,
        title: form.title,
        description: form.description,
        requiredSkills: form.requiredSkills
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        minExperienceYears: Number(form.minExperienceYears),
        minScorePercent: Number(form.minScorePercent),
        jobType: form.jobType,
        location: form.location,
        salaryMin: form.salaryMin ? Number(form.salaryMin) : undefined,
        salaryMax: form.salaryMax ? Number(form.salaryMax) : undefined,
        openings: Number(form.openings),
        targetBatchIds: form.targetBatchIds.length ? form.targetBatchIds : undefined,
      });
      setShowForm(false);
      setForm(emptyForm);
      load();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const closeJob = async (id: string) => {
    await hrApi.closeJob(id);
    load();
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Job Postings</h1>
        <button
          onClick={() => setShowForm(true)}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
        >
          + Post New Job
        </button>
      </div>

      <div className="flex gap-2 mb-4">
        {["", "open", "closed", "on_hold"].map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-sm ${
              statusFilter === s ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-700"
            }`}
          >
            {s === "" ? "All" : s.replace("_", " ")}
          </button>
        ))}
      </div>

      {error && <div className="mb-4 text-red-600 text-sm">{error}</div>}

      {loading ? (
        <ArcLoader />
      ) : (
        <div className="space-y-3">
          {jobs.map((j) => (
            <div key={j.id} className="border border-gray-200 rounded-xl p-4 bg-white shadow-sm">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-semibold text-gray-900">{j.title}</h3>
                  <p className="text-sm text-gray-500">
                    {j.companyName} · {j.location || "Remote"} · {j.jobType.replace("_", " ")}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={j.status} />
                </div>
              </div>
              <div className="flex flex-wrap gap-1 mt-2">
                {j.requiredSkills.map((s) => (
                  <span key={s} className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full">
                    {s}
                  </span>
                ))}
              </div>
              <div className="flex justify-between items-center mt-3">
                <p className="text-xs text-gray-500">
                  Openings: {j.openings} · Min score: {j.minScorePercent}% · Min exp:{" "}
                  {j.minExperienceYears}y
                </p>
                <div className="flex gap-3 text-xs">
                  <button
                    onClick={() => onViewJob && onViewJob(j.id)}
                    className="text-indigo-600 hover:underline font-medium"
                  >
                    View Candidates / Match
                  </button>
                  {j.status === "open" && (
                    <button onClick={() => closeJob(j.id)} className="text-gray-500 hover:underline">
                      Close Job
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
          {jobs.length === 0 && <p className="text-gray-500">No jobs found.</p>}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-semibold mb-4">Post New Job</h2>
            <form onSubmit={submit} className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-600">Company</label>
                <select
                  required
                  value={form.companyId}
                  onChange={(e) => setForm({ ...form, companyId: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-1"
                >
                  <option value="">Select company</option>
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">Job Title</label>
                <input
                  required
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-1"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">Description</label>
                <textarea
                  required
                  rows={3}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-1"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">Required Skills (comma separated)</label>
                <input
                  value={form.requiredSkills}
                  onChange={(e) => setForm({ ...form, requiredSkills: e.target.value })}
                  placeholder="python, react, sql"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-1"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600">Min Experience (yrs)</label>
                  <input
                    type="number"
                    min={0}
                    value={form.minExperienceYears}
                    onChange={(e) => setForm({ ...form, minExperienceYears: Number(e.target.value) })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Min Assessment Score %</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={form.minScorePercent}
                    onChange={(e) => setForm({ ...form, minScorePercent: Number(e.target.value) })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-1"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600">Location</label>
                  <input
                    value={form.location}
                    onChange={(e) => setForm({ ...form, location: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Job Type</label>
                  <select
                    value={form.jobType}
                    onChange={(e) => setForm({ ...form, jobType: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-1"
                  >
                    <option value="full_time">Full Time</option>
                    <option value="internship">Internship</option>
                    <option value="contract">Contract</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600">Salary Min</label>
                  <input
                    type="number"
                    value={form.salaryMin}
                    onChange={(e) => setForm({ ...form, salaryMin: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Salary Max</label>
                  <input
                    type="number"
                    value={form.salaryMax}
                    onChange={(e) => setForm({ ...form, salaryMax: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Openings</label>
                  <input
                    type="number"
                    min={1}
                    value={form.openings}
                    onChange={(e) => setForm({ ...form, openings: Number(e.target.value) })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-1"
                  />
                </div>
              </div>
              {error && <p className="text-red-600 text-sm">{error}</p>}
              <div>
                <label className="text-xs font-medium text-gray-600">
                  Target Batches <span className="text-gray-400">(leave empty = visible to all students)</span>
                </label>
                <div className="mt-1 flex flex-wrap gap-2 p-2 border border-gray-200 rounded-lg min-h-[44px]">
                  {batches.map((b) => {
                    const sel = form.targetBatchIds.includes(b.id);
                    return (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() =>
                          setForm({
                            ...form,
                            targetBatchIds: sel
                              ? form.targetBatchIds.filter((id) => id !== b.id)
                              : [...form.targetBatchIds, b.id],
                          })
                        }
                        className={`text-xs px-3 py-1 rounded-full border transition font-medium ${
                          sel
                            ? "bg-indigo-600 text-white border-indigo-600"
                            : "bg-white text-gray-600 border-gray-300 hover:border-indigo-400"
                        }`}
                      >
                        {(b as any).name || b.id}
                      </button>
                    );
                  })}
                  {batches.length === 0 && (
                    <span className="text-xs text-gray-400 py-1">No batches found. Create batches first.</span>
                  )}
                </div>
                {form.targetBatchIds.length > 0 && (
                  <p className="text-xs text-indigo-600 mt-1">
                    ✓ Job will only show to students in {form.targetBatchIds.length} selected batch(es)
                  </p>
                )}
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 rounded-lg text-sm bg-gray-100 hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 rounded-lg text-sm bg-indigo-600 text-white hover:bg-indigo-700">
                  Post Job
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
