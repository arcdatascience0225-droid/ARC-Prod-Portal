import { useEffect, useState } from "react";
import { assessmentApi } from "../../api/studentApi";
import { api } from "../../services/api";
import type { AssessmentHistoryItem } from "../../types";

interface ReviewQuestion {
  questionId: string;
  questionText: string;
  type: string;
  marks: number;
  options?: string[] | null;
  correctOption?: string | null;
  studentAnswer?: string | null;
  isCorrect?: boolean | null;
  marksAwarded: number;
}

interface Review {
  resultId: string;
  score: number;
  status: string;
  submittedAt?: string;
  questions: ReviewQuestion[];
}

export default function AssessmentHistory() {
  const [items, setItems] = useState<AssessmentHistoryItem[]>([]);
  const [review, setReview] = useState<Review | null>(null);
  const [reviewTitle, setReviewTitle] = useState("");
  const [loadingReview, setLoadingReview] = useState(false);

  useEffect(() => {
    assessmentApi.history().then(setItems);
  }, []);

  const openReview = async (item: AssessmentHistoryItem) => {
    if (item.status !== "completed") return;
    setLoadingReview(true);
    setReviewTitle(item.assessmentTitle);
    try {
      const { data } = await api.get<Review>(`/api/v1/student/assessments/history/${item.resultId}/review`);
      setReview(data);
    } catch {
      setReview(null);
    } finally {
      setLoadingReview(false);
    }
  };

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
              <tr key={item.resultId}
                onClick={() => openReview(item)}
                className={item.status === "completed" ? "cursor-pointer hover:bg-gray-50" : ""}>
                <td className="px-4 py-3 font-medium text-gray-700">{item.assessmentTitle}</td>
                <td className="px-4 py-3 uppercase text-xs text-gray-500">{item.type}</td>
                <td className="px-4 py-3">{item.score}{item.maxScore != null ? ` / ${item.maxScore}` : ""}</td>
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

      {(review || loadingReview) && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setReview(null)}>
          <div className="bg-white rounded-xl w-full max-w-2xl max-h-[85vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-800 text-lg">{reviewTitle} — Review</h2>
              <button onClick={() => setReview(null)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
            </div>

            {loadingReview ? (
              <p className="text-sm text-gray-400">Loading…</p>
            ) : review ? (
              <div className="space-y-4">
                {review.questions.map((q, i) => (
                  <div key={q.questionId} className="border border-gray-100 rounded-lg p-4">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <p className="text-sm font-medium text-gray-800">
                        Q{i + 1}. {q.questionText}
                      </p>
                      <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-semibold ${
                        q.isCorrect === true ? "bg-green-50 text-green-700" :
                        q.isCorrect === false ? "bg-red-50 text-red-700" : "bg-gray-100 text-gray-500"
                      }`}>
                        {q.marksAwarded}/{q.marks}
                      </span>
                    </div>

                    {q.type === "mcq" && q.options ? (
                      <div className="space-y-1">
                        {q.options.map((opt) => {
                          const isStudentPick = opt === q.studentAnswer;
                          const isCorrectOpt = opt === q.correctOption;
                          return (
                            <div key={opt} className={`text-xs px-3 py-1.5 rounded-md ${
                              isCorrectOpt ? "bg-green-50 text-green-700 font-medium" :
                              isStudentPick ? "bg-red-50 text-red-700" : "bg-gray-50 text-gray-600"
                            }`}>
                              {opt}
                              {isCorrectOpt && " ✓ Correct answer"}
                              {isStudentPick && !isCorrectOpt && " ← Your answer"}
                            </div>
                          );
                        })}
                        {!q.studentAnswer && <p className="text-xs text-gray-400 italic">Not answered</p>}
                      </div>
                    ) : (
                      <div className="bg-gray-50 rounded-md p-3 text-xs font-mono whitespace-pre-wrap text-gray-700">
                        {q.studentAnswer || <span className="text-gray-400 italic">Not answered</span>}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400">Couldn't load this attempt's answers.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
