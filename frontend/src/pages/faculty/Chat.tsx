import { useEffect, useState } from "react";
import { getMyBatches, getBatchStudents, getChatThread, sendChatMessage } from "../../api/facultyApi";
import { FacultyBatch, StudentInBatch, ChatMessage } from "../../types";

export default function ChatPage() {
  const [batches, setBatches] = useState<FacultyBatch[]>([]);
  const [batchId, setBatchId] = useState("");
  const [students, setStudents] = useState<StudentInBatch[]>([]);
  const [studentId, setStudentId] = useState("");
  const [thread, setThread] = useState<ChatMessage[]>([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    getMyBatches().then(setBatches);
  }, []);

  useEffect(() => {
    setStudentId("");
    setStudents([]);
    if (batchId) getBatchStudents(batchId).then(setStudents);
  }, [batchId]);

  useEffect(() => {
    // Clear the previous student's thread immediately so stale messages can't
    // be read as belonging to the newly selected student while the fetch is
    // in flight.
    setThread([]);
    if (studentId) getChatThread(studentId).then(setThread);
  }, [studentId]);

  const send = async () => {
    if (!message.trim() || !studentId) return;
    await sendChatMessage(studentId, message);
    setMessage("");
    getChatThread(studentId).then(setThread);
  };

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-semibold text-slate-800 mb-6">Chat with Students</h1>

      <div className="flex gap-3 mb-4">
        <select className="border border-slate-300 rounded-lg px-3 py-2 text-sm" value={batchId} onChange={(e) => setBatchId(e.target.value)}>
          <option value="">Select batch</option>
          {batches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <select className="border border-slate-300 rounded-lg px-3 py-2 text-sm" value={studentId} onChange={(e) => setStudentId(e.target.value)}>
          <option value="">Select student</option>
          {students.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>

      {studentId && (
        <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col h-96">
          <div className="flex-1 overflow-y-auto space-y-2 mb-3">
            {thread.map((m) => (
              <div
                key={m.id}
                className={`text-sm rounded-lg px-3 py-2 max-w-[80%] ${
                  m.sentByStudent ? "bg-slate-100 mr-auto" : "bg-indigo-50 ml-auto"
                }`}
              >
                <p className="text-xs font-medium text-slate-500 mb-0.5">{m.sentByStudent ? "Student" : "You"}</p>
                <p className="text-slate-800">{m.message}</p>
                <p className="text-xs text-slate-400 mt-1">{new Date(m.createdAt).toLocaleString()}</p>
              </div>
            ))}
            {thread.length === 0 && <p className="text-sm text-slate-400">No messages yet.</p>}
          </div>
          <div className="flex gap-2">
            <input
              className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm"
              placeholder="Type a message…"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
            />
            <button onClick={send} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700">
              Send
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
