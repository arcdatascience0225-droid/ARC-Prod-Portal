import { useEffect, useState } from "react";
import { learningApi } from "../../api/studentApi";
import type { Assignment, AssignmentSubmissionCreate } from "../../types";

export default function Assignments() {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [submissionType, setSubmissionType] = useState<AssignmentSubmissionCreate["submissionType"]>("repo_link");
  const [fileUrl, setFileUrl] = useState("");
  const [repoLink, setRepoLink] = useState("");
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    learningApi.listAssignments().then(setAssignments);
  }, []);

  const handleSubmit = async (assignmentId: string) => {
    setStatus(null);
    try {
      await learningApi.submitAssignment({
        assignmentId,
        submissionType,
        fileUrl: submissionType === "repo_link" ? undefined : fileUrl,
        repoLink: submissionType === "repo_link" ? repoLink : undefined,
      });
      setStatus("Submitted successfully!");
      const updated = await learningApi.listAssignments();
      setAssignments(updated);
      setActiveId(null);
    } catch {
      setStatus("Submission failed. Please check the fields and try again.");
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">Assignments</h1>
      <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
        {assignments.map((a) => (
          <div key={a.id} className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-800">{a.title}</p>
                <p className="text-xs text-gray-400">
                  Due: {a.dueDate ? new Date(a.dueDate).toLocaleDateString() : "No due date"} · {a.maxMarks} marks
                </p>
              </div>
              <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-600">
                {a.mySubmissionStatus ?? "not submitted"}
              </span>
            </div>
            {a.description && <p className="text-sm text-gray-500 mt-2">{a.description}</p>}

            {activeId === a.id ? (
              <div className="mt-3 space-y-2 bg-gray-50 p-3 rounded-lg">
                <select
                  className="input"
                  value={submissionType}
                  onChange={(e) => setSubmissionType(e.target.value as AssignmentSubmissionCreate["submissionType"])}
                >
                  <option value="repo_link">Repository Link</option>
                  <option value="document">Document</option>
                  <option value="archive">Archive (zip)</option>
                  <option value="notebook">Notebook</option>
                </select>
                {submissionType === "repo_link" ? (
                  <input className="input" placeholder="https://github.com/..." value={repoLink} onChange={(e) => setRepoLink(e.target.value)} />
                ) : (
                  <input className="input" placeholder="File URL (upload via Azure Blob first)" value={fileUrl} onChange={(e) => setFileUrl(e.target.value)} />
                )}
                <div className="flex gap-2">
                  <button onClick={() => handleSubmit(a.id)} className="px-3 py-1.5 bg-primary text-white rounded-lg text-sm">
                    Submit
                  </button>
                  <button onClick={() => setActiveId(null)} className="px-3 py-1.5 bg-gray-200 rounded-lg text-sm">
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button onClick={() => setActiveId(a.id)} className="mt-3 text-sm text-primary font-medium">
                Submit assignment →
              </button>
            )}
          </div>
        ))}
        {assignments.length === 0 && <p className="p-5 text-sm text-gray-400">No assignments yet.</p>}
      </div>
      {status && <p className="text-sm text-gray-500">{status}</p>}
    </div>
  );
}
