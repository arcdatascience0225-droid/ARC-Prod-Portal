import { useEffect, useState } from "react";
import { adminApi } from "../../api/adminPlatformApi";
import type { CourseOut, BatchOut, UserOut } from "../../types";

export default function CourseBatchManagement() {
  const [courses, setCourses] = useState<CourseOut[]>([]);
  const [batches, setBatches] = useState<BatchOut[]>([]);
  const [faculty, setFaculty] = useState<UserOut[]>([]);
  const [selectedCourse, setSelectedCourse] = useState("");
  const [form, setForm] = useState({ name: "", code: "", description: "", durationWeeks: 4 });
  const [batchForm, setBatchForm] = useState({ name: "", courseId: "", facultyId: "" });
  const [error, setError] = useState("");

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
      await adminApi.createCourse(form);
      setForm({ name: "", code: "", description: "", durationWeeks: 4 });
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
      });
      setBatchForm({ name: "", courseId: "", facultyId: "" });
      loadBatches(selectedCourse || undefined);
    } catch (e) {
      setError((e as Error).message);
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
          <input type="number" className="border rounded-md px-3 py-2" placeholder="Duration (weeks)" value={form.durationWeeks} onChange={(e) => setForm({ ...form, durationWeeks: Number(e.target.value) })} />
        </div>
        <button onClick={createCourse} className="bg-slate-800 text-white px-4 py-2 rounded-md text-sm">Create Course</button>
      </div>

      <div className="bg-white rounded-xl shadow p-5">
        <h2 className="font-semibold text-slate-700 mb-3">Courses</h2>
        <table className="w-full text-sm">
          <thead className="text-slate-500 text-left border-b">
            <tr><th className="py-2">Name</th><th>Code</th><th>Duration</th><th></th></tr>
          </thead>
          <tbody>
            {courses.map((c) => (
              <tr key={c.id} className="border-b last:border-0 cursor-pointer hover:bg-slate-50" onClick={() => { setSelectedCourse(c.id); loadBatches(c.id); }}>
                <td className="py-2">{c.name}</td>
                <td>{c.code}</td>
                <td>{c.duration_weeks}w</td>
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
            <option value="">Assign faculty (optional — defaults to you)</option>
            {faculty.map((f) => <option key={f.id} value={f.id}>{f.name} ({f.email})</option>)}
          </select>
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
                <td>{b.facultyName || "—"}</td>
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
