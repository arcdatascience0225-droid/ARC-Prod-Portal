import { useEffect, useState } from "react";
import { analyticsApi } from "../../api/analyticsApi";
import type { PlacementAnalytics } from "../../types";

export default function AnalyticsDashboard() {
  const [placement, setPlacement] = useState<PlacementAnalytics | null>(null);
  const [studentId, setStudentId] = useState("");
  const [studentData, setStudentData] = useState<any>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    analyticsApi.placementAnalytics().then(setPlacement).catch((e) => setError(e.message));
  }, []);

  const lookupStudent = async () => {
    if (!studentId) return;
    try {
      const data = await analyticsApi.studentAnalytics(studentId);
      setStudentData(data);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-slate-800">Analytics</h1>
      {error && <div className="bg-red-50 text-red-700 p-3 rounded-md text-sm">{error}</div>}

      <div className="bg-white rounded-xl shadow p-5">
        <h2 className="font-semibold text-slate-700 mb-3">Placement Outcomes</h2>
        <div className="grid grid-cols-4 gap-4 text-sm">
          <div><p className="text-slate-500">Total Students</p><p className="text-xl font-semibold">{placement?.totalStudents}</p></div>
          <div><p className="text-slate-500">Placed</p><p className="text-xl font-semibold">{placement?.placedStudents}</p></div>
          <div><p className="text-slate-500">Placement Rate</p><p className="text-xl font-semibold">{placement?.placementRate}%</p></div>
          <div><p className="text-slate-500">Avg Offers/Student</p><p className="text-xl font-semibold">{placement?.avgOffersPerStudent}</p></div>
        </div>
        {placement && placement.topHiringCompanies.length > 0 && (
          <div className="mt-4">
            <p className="text-slate-500 text-sm mb-2">Top Hiring Companies</p>
            <ul className="text-sm space-y-1">
              {placement.topHiringCompanies.map((c) => (
                <li key={c.company}>{c.company} — {c.hires} hires</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl shadow p-5 space-y-3">
        <h2 className="font-semibold text-slate-700">Student Performance Lookup</h2>
        <div className="flex gap-2">
          <input className="border rounded-md px-3 py-2 flex-1" placeholder="Student user ID" value={studentId} onChange={(e) => setStudentId(e.target.value)} />
          <button onClick={lookupStudent} className="bg-slate-800 text-white px-4 py-2 rounded-md text-sm">Lookup</button>
        </div>
        {studentData && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm pt-2">
            <div><p className="text-slate-500">Assessments Taken</p><p className="font-semibold">{studentData.assessmentsTaken}</p></div>
            <div><p className="text-slate-500">Average Score</p><p className="font-semibold">{studentData.averageScore}</p></div>
            <div><p className="text-slate-500">Coding Success Rate</p><p className="font-semibold">{studentData.codingSuccessRate}%</p></div>
            <div><p className="text-slate-500">Career Readiness</p><p className="font-semibold">{studentData.careerReadinessScore}</p></div>
            <div className="col-span-2"><p className="text-slate-500">Strengths</p><p>{studentData.strengths.join(", ") || "-"}</p></div>
            <div className="col-span-2"><p className="text-slate-500">Weaknesses</p><p>{studentData.weaknesses.join(", ") || "-"}</p></div>
          </div>
        )}
      </div>
    </div>
  );
}
