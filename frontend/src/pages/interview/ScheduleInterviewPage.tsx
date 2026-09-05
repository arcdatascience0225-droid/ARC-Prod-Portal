import React, { useState } from "react";
import { interviewApi } from "../../api/placementApi";

export default function ScheduleInterviewPage() {
  const [form, setForm] = useState({
    applicationId: "",
    roundName: "Technical Round 1",
    scheduledAt: "",
    durationMinutes: 30,
    mode: "online",
    meetingLink: "",
    interviewerId: "",
  });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setMessage("");
    try {
      await interviewApi.schedule({
        applicationId: form.applicationId,
        roundName: form.roundName,
        scheduledAt: new Date(form.scheduledAt).toISOString(),
        durationMinutes: Number(form.durationMinutes),
        mode: form.mode,
        meetingLink: form.meetingLink || undefined,
        interviewerId: form.interviewerId || undefined,
      });
      setMessage("Interview scheduled successfully.");
      setForm({ ...form, applicationId: "", meetingLink: "" });
    } catch (e: any) {
      setError(e.message);
    }
  };

  return (
    <div className="p-6 max-w-xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Schedule Interview</h1>
      <form onSubmit={submit} className="space-y-3 bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
        <div>
          <label className="text-xs font-medium text-gray-600">Application ID</label>
          <input
            required
            value={form.applicationId}
            onChange={(e) => setForm({ ...form, applicationId: e.target.value })}
            placeholder="Paste application UUID"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-1"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600">Round Name</label>
          <select
            value={form.roundName}
            onChange={(e) => setForm({ ...form, roundName: e.target.value })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-1"
          >
            <option>HR Screening</option>
            <option>Technical Round 1</option>
            <option>Technical Round 2</option>
            <option>Managerial Round</option>
            <option>Final Round</option>
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-gray-600">Date & Time</label>
            <input
              required
              type="datetime-local"
              value={form.scheduledAt}
              onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-1"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600">Duration (min)</label>
            <input
              type="number"
              value={form.durationMinutes}
              onChange={(e) => setForm({ ...form, durationMinutes: Number(e.target.value) })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-1"
            />
          </div>
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600">Mode</label>
          <select
            value={form.mode}
            onChange={(e) => setForm({ ...form, mode: e.target.value })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-1"
          >
            <option value="online">Online (video call)</option>
            <option value="offline">Offline / In-person</option>
            <option value="mock_video">Mock Recorded Interview</option>
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600">Meeting Link (optional)</label>
          <input
            value={form.meetingLink}
            onChange={(e) => setForm({ ...form, meetingLink: e.target.value })}
            placeholder="https://meet.example.com/..."
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-1"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600">Interviewer ID (optional)</label>
          <input
            value={form.interviewerId}
            onChange={(e) => setForm({ ...form, interviewerId: e.target.value })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-1"
          />
        </div>

        {message && <p className="text-green-600 text-sm">{message}</p>}
        {error && <p className="text-red-600 text-sm">{error}</p>}

        <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded-lg text-sm font-medium">
          Schedule Interview
        </button>
      </form>
    </div>
  );
}
