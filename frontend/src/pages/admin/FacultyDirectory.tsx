import { useEffect, useState } from "react";
import { api } from "../../services/api";
import { getBatchStudents } from "../../api/facultyApi";
import ArcLoader from "../../components/ArcLoader";
import type { StudentInBatch } from "../../types";

interface FacultyBatchRow { batchId: string; batchName: string; course: string | null; studentCount: number }
interface FacultyRow { facultyId: string; facultyName: string; facultyEmail: string; batches: FacultyBatchRow[] }

export default function FacultyDirectory() {
  const [rows, setRows] = useState<FacultyRow[] | null>(null);
  const [openFaculty, setOpenFaculty] = useState<string | null>(null);
  const [openBatch, setOpenBatch] = useState<{ id: string; name: string } | null>(null);
  const [students, setStudents] = useState<StudentInBatch[]>([]);

  useEffect(() => {
    api.get<FacultyRow[]>("/api/v1/faculty/faculty-directory").then((r) => setRows(r.data)).catch(() => setRows([]));
  }, []);

  const openBatchDetail = async (b: FacultyBatchRow) => {
    setOpenBatch({ id: b.batchId, name: b.batchName });
    const s = await getBatchStudents(b.batchId);
    setStudents(s);
  };

  if (rows === null) return <ArcLoader label="Loading faculty directory" />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Faculty</h1>
        <p className="text-sm text-gray-500 mt-1">Every faculty member and the batches assigned to them.</p>
      </div>

      <div className="space-y-3">
        {rows.map((f) => (
          <div key={f.facultyId} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <button onClick={() => setOpenFaculty(openFaculty === f.facultyId ? null : f.facultyId)}
              className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50">
              <div>
                <p className="font-semibold text-gray-800">{f.facultyName}</p>
                <p className="text-xs text-gray-400">{f.facultyEmail}</p>
              </div>
              <span className="text-xs text-gray-400">{f.batches.length} batch{f.batches.length !== 1 ? "es" : ""}</span>
            </button>
            {openFaculty === f.facultyId && (
              <div className="border-t border-gray-100 divide-y divide-gray-50">
                {f.batches.map((b) => (
                  <button key={b.batchId} onClick={() => openBatchDetail(b)}
                    className="w-full flex items-center justify-between px-5 py-3 text-left hover:bg-gray-50">
                    <div>
                      <p className="text-sm font-medium text-gray-700">{b.batchName}</p>
                      <p className="text-xs text-gray-400">{b.course || "—"}</p>
                    </div>
                    <span className="text-xs text-gray-400">{b.studentCount} students</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
        {rows.length === 0 && <p className="text-sm text-gray-400">No faculty have been assigned batches yet.</p>}
      </div>

      {openBatch && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setOpenBatch(null)}>
          <div className="bg-white rounded-xl w-full max-w-lg max-h-[80vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-800">Students in {openBatch.name}</h2>
              <button onClick={() => setOpenBatch(null)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
            </div>
            <ul className="divide-y divide-gray-100">
              {students.map((s) => (
                <li key={s.id} className="py-2">
                  <p className="text-sm font-medium text-gray-800">{s.name}</p>
                  <p className="text-xs text-gray-400">{s.email}</p>
                </li>
              ))}
              {students.length === 0 && <p className="text-sm text-gray-400 py-3">No students in this batch.</p>}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
