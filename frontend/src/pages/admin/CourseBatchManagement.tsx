import { useEffect, useState } from "react";
import { adminApi } from "../../api/adminPlatformApi";
import type { CourseOut, BatchOut, UserOut } from "../../types";

export default function CourseBatchManagement() {
  const [courses, setCourses] = useState<CourseOut[]>([]);
  const [batches, setBatches] = useState<BatchOut[]>([]);
  const [faculty, setFaculty] = useState<UserOut[]>([]);
  const [selectedCourse, setSelectedCourse] = useState("");
  const [form, setForm] = useState({ name: "", code: "", description: "" });
  const [batchForm, setBatchForm] = useState({ name: "", courseId: "", facultyId: "", startDate: "", endDate: "" });
  const [error, setError] = useState("");
  const [savingFacultyFor, setSavingFacultyFor] = useState<string | null>(null);
  const [facultyPick, setFacultyPick] = useState<Record<string, string>>({});

  const loadCourses = () => adminApi.listCourses().then(setCourses).catch((e) => setError(e.message));
  const loadBatches = (courseId?: string) => adminApi.listBatches(courseId).then(setBatches).catch((e) => setError(e.message));
  const loadFaculty = () => adminApi.listUsers("faculty").then(setFaculty).catch(() => {});

  useEffect(() => {
    loadCourses();
    loadBatches();
    loadFaculty();
  }, []);

  const createCourse = async () => {
    try {
      await adminApi.createCourse({ ...form, durationWeeks: 0 });
      setForm({ name: "", code: "", description: "" });
      loadCourses();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const createBatch = async () => {
    if (!batchForm.courseId) return;
    try {
      await adminApi.createBatch({
        courseId: batchForm.courseId, name: batchForm.name,
        facultyId: batchForm.facultyId || undefined,
        startDate: batchForm.startDate || undefined,
        endDate: batchForm.endDate || undefined,
      });
      setBatchForm({ name: "", courseId: "", facultyId: "", startDate: "", endDate: "" });
      loadBatches(selectedCourse || undefined);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const saveFaculty = async (batchId: string) => {
    const facultyId = facultyPick[batchId];
    if (!facultyId) return;
    setSavingFacultyFor(batchId);
    try {
      await adminApi.setBatchFaculty(batchId, facultyId);
      loadBatches(selectedCourse || undefined);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSavingFacultyFor(null);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-slate-800">Courses & Batches</h1>
      {error && <div className="bg-red-50 text-red-700 p-3 rounded-md text-sm">{error}</div>}

      <div className="bg-white rounded-xl shadow p-5 space-y-3">
        <h2 className="font-semibold text-slate-700">New Course</h2>
        <div className="grid grid-cols-2 gap-3">
          <input className="border rounded-md px-3 py-2" placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input className="border rounded-md px-3 py-2" placeholder="Code" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
          <input className="border rounded-md px-3 py-2 col-span-2" placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </div>
        <button onClick={createCourse} className="bg-slate-800 text-white px-4 py-2 rounded-md text-sm">Create Course</button>
      </div>

      <div className="bg-white rounded-xl shadow p-5">
        <h2 className="font-semibold text-slate-700 mb-3">Courses</h2>
        <table className="w-full text-sm">
          <thead className="text-slate-500 text-left border-b">
            <tr><th className="py-2">Name</th><th>Code</th><th></th></tr>
          </thead>
          <tbody>
            {courses.map((c) => (
              <tr key={c.id} className="border-b last:border-0 cursor-pointer hover:bg-slate-50" onClick={() => { setSelectedCourse(c.id); loadBatches(c.id); }}>
                <td className="py-2">{c.name}</td>
                <td>{c.code}</td>
                <td><button onClick={(ev) => { ev.stopPropagation(); adminApi.deleteCourse(c.id).then(loadCourses); }} className="text-red-600 text-xs">Delete</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="bg-white rounded-xl shadow p-5 space-y-3">
        <h2 className="font-semibold text-slate-700">New Batch {selectedCourse && `(for selected course)`}</h2>
        <div className="grid grid-cols-2 gap-3">
          <input className="border rounded-md px-3 py-2" placeholder="Batch name" value={batchForm.name} onChange={(e) => setBatchForm({ ...batchForm, name: e.target.value })} />
          <select className="border rounded-md px-3 py-2" value={batchForm.courseId || selectedCourse} onChange={(e) => setBatchForm({ ...batchForm, courseId: e.target.value })}>
            <option value="">Select course</option>
            {courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select className="border rounded-md px-3 py-2 col-span-2" value={batchForm.facultyId} onChange={(e) => setBatchForm({ ...batchForm, facultyId: e.target.value })}>
            <option value="">Assign faculty (leave blank to assign yourself)</option>
            {faculty.map((f) => <option key={f.id} value={f.id}>{f.name} ({f.email})</option>)}
          </select>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Start Date</label>
            <input type="date" className="border rounded-md px-3 py-2 w-full" value={batchForm.startDate} onChange={(e) => setBatchForm({ ...batchForm, startDate: e.target.value })} />
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Expected End Date</label>
            <input type="date" className="border rounded-md px-3 py-2 w-full" value={batchForm.endDate} onChange={(e) => setBatchForm({ ...batchForm, endDate: e.target.value })} />
          </div>
        </div>
        <button onClick={createBatch} className="bg-slate-800 text-white px-4 py-2 rounded-md text-sm">Create Batch</button>
      </div>

      <div className="bg-white rounded-xl shadow p-5">
        <h2 className="font-semibold text-slate-700 mb-3">Batches</h2>
        <table className="w-full text-sm">
          <thead className="text-slate-500 text-left border-b">
            <tr><th className="py-2">Name</th><th>Faculty</th><th>Status</th><th>Start</th><th>End</th></tr>
          </thead>
          <tbody>
            {batches.map((b) => (
              <tr key={b.id} className="border-b last:border-0">
                <td className="py-2">{b.name}</td>
                <td>
                  {b.facultyName ? (
                    b.facultyName
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <select className="border rounded-md px-1.5 py-1 text-xs max-w-[140px]"
                        value={facultyPick[b.id] || ""}
                        onChange={(e) => setFacultyPick({ ...facultyPick, [b.id]: e.target.value })}>
                        <option value="">Assign faculty</option>
                        {faculty.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                      </select>
                      <button onClick={() => saveFaculty(b.id)} disabled={!facultyPick[b.id] || savingFacultyFor === b.id}
                        className="text-xs text-indigo-600 font-medium disabled:opacity-40">
                        {savingFacultyFor === b.id ? "…" : "Save"}
                      </button>
                    </div>
                  )}
                </td>
                <td>{b.status}</td>
                <td>{b.start_date?.slice(0, 10) ?? "-"}</td>
                <td>{b.end_date?.slice(0, 10) ?? "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
