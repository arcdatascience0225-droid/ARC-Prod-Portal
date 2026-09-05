import { useEffect, useState } from "react";
import { learningApi } from "../../api/studentApi";
import type { SyllabusItem, DailyChallenge } from "../../types";

export default function Learning() {
  const [syllabus, setSyllabus] = useState<SyllabusItem[]>([]);
  const [challenge, setChallenge] = useState<DailyChallenge | null>(null);
  const [answer, setAnswer] = useState("");
  const [challengeMsg, setChallengeMsg] = useState<string | null>(null);

  useEffect(() => {
    learningApi.getSyllabus().then(setSyllabus);
    learningApi
      .getDailyChallenge()
      .then(setChallenge)
      .catch(() => setChallenge(null));
  }, []);

  const toggleStatus = async (item: SyllabusItem) => {
    const next = item.status === "completed" ? "pending" : "completed";
    const updated = await learningApi.updateSyllabusStatus(item.id, next);
    setSyllabus((prev) => prev.map((s) => (s.id === item.id ? { ...s, status: updated.status } : s)));
  };

  const submitChallenge = async () => {
    if (!challenge) return;
    const res = await learningApi.submitDailyChallenge(challenge.id, answer);
    setChallengeMsg(res.isCorrect ? "Correct! 🎉" : "Not quite — try again tomorrow!");
    setChallenge({ ...challenge, alreadyAttempted: true });
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">Learning</h1>

      {challenge && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-800 mb-2">🔥 Daily Challenge</h2>
          <p className="text-sm text-gray-600 mb-3">{challenge.question.questionText}</p>
          {challenge.alreadyAttempted ? (
            <p className="text-sm text-green-600">You've already attempted today's challenge.</p>
          ) : (
            <div className="flex gap-2">
              <input
                className="input flex-1"
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                placeholder="Your answer"
              />
              <button onClick={submitChallenge} className="px-4 py-2 bg-primary text-white rounded-lg text-sm">
                Submit
              </button>
            </div>
          )}
          {challengeMsg && <p className="text-sm text-gray-500 mt-2">{challengeMsg}</p>}
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="font-semibold text-gray-800 mb-3">Syllabus</h2>
        <ul className="divide-y divide-gray-100">
          {syllabus.map((item) => (
            <li key={item.id} className="py-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-700">{item.title}</p>
                {item.module && <p className="text-xs text-gray-400">{item.module}</p>}
              </div>
              <button
                onClick={() => toggleStatus(item)}
                className={`text-xs px-3 py-1.5 rounded-full font-medium ${
                  item.status === "completed"
                    ? "bg-green-100 text-green-700"
                    : "bg-gray-100 text-gray-600"
                }`}
              >
                {item.status === "completed" ? "Completed" : "Mark Complete"}
              </button>
            </li>
          ))}
          {syllabus.length === 0 && <p className="text-sm text-gray-400 py-3">No syllabus items yet.</p>}
        </ul>
      </div>
    </div>
  );
}
