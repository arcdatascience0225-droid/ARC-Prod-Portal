import { useEffect, useState } from "react";
import { assessmentApi } from "../../api/studentApi";
import type { AssessmentHistoryItem } from "../../types";

export default function AssessmentHistory() {
  const [items, setItems] = useState<AssessmentHistoryItem[]>([]);

  useEffect(() => {
    assessmentApi.history().then(setItems);
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">Assessment History</h1>
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-left">
            <tr>
              <th className="px-4 py-3">Assessment</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Score</th>
              <th className="px-4 py-3">Rank</th>
              <th className="px-4 py-3">Percentile</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Submitted</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {items.map((item) => (
              <tr key={item.resultId}>
                <td className="px-4 py-3 font-medium text-gray-700">{item.assessmentTitle}</td>
                <td className="px-4 py-3 uppercase text-xs text-gray-500">{item.type}</td>
                <td className="px-4 py-3">{item.score}</td>
                <td className="px-4 py-3">{item.rank ?? "—"}</td>
                <td className="px-4 py-3">{item.percentile != null ? `${item.percentile}%` : "—"}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-1 rounded-full ${item.status === "completed" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>
                    {item.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-500">
                  {item.submittedAt ? new Date(item.submittedAt).toLocaleDateString() : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {items.length === 0 && <p className="p-5 text-sm text-gray-400">No assessments attempted yet.</p>}
      </div>
    </div>
  );
}
