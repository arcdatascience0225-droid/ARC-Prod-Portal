import React, { useEffect, useState } from "react";
import { Field, SelectField, PrimaryButton, ErrorBanner, SuccessBanner, extractErrorMessage } from "../../components/FormControls";
import { registrationApi } from "../../services/registrationApi";
import { Course, Batch } from "../../types";

interface GeneratedLink { email: string; inviteLink: string }

export const InviteLinkPage: React.FC = () => {
  const [mode, setMode] = useState<"single" | "multiple">("single");
  const [email, setEmail] = useState("");
  const [emailsBulk, setEmailsBulk] = useState("");
  const [courseId, setCourseId] = useState("");
  const [batchId, setBatchId] = useState("");
  const [courses, setCourses] = useState<Course[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [links, setLinks] = useState<GeneratedLink[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  useEffect(() => {
    registrationApi.listCourses().then((res) => setCourses(res.data)).catch(() => {});
  }, []);

  useEffect(() => {
    setBatchId("");
    if (courseId) {
      registrationApi.listBatches(courseId).then((res) => setBatches(res.data)).catch(() => {});
    } else {
      setBatches([]);
    }
  }, [courseId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLinks([]);

    if (!courseId || !batchId) {
      setError("Select a course and a batch - the invite assigns the student to that batch.");
      return;
    }

    if (mode === "single") {
      setLoading(true);
      try {
        const { data } = await registrationApi.createInvite({
          email: email || undefined, courseId, batchId, expiresInHours: 72,
        });
        setLinks([{ email: email || "(any student)", inviteLink: data.inviteLink }]);
      } catch (err) {
        setError(extractErrorMessage(err));
      } finally {
        setLoading(false);
      }
      return;
    }

    // Multiple students — one invite link per email, all bound to the same batch.
    const emailList = emailsBulk
      .split(/[\n,]/)
      .map((e) => e.trim())
      .filter(Boolean);
    if (emailList.length === 0) {
      setError("Enter at least one student email (one per line, or comma-separated).");
      return;
    }

    setLoading(true);
    const results: GeneratedLink[] = [];
    const failures: string[] = [];
    for (const studentEmail of emailList) {
      try {
        const { data } = await registrationApi.createInvite({
          email: studentEmail, courseId, batchId, expiresInHours: 72,
        });
        results.push({ email: studentEmail, inviteLink: data.inviteLink });
      } catch {
        failures.push(studentEmail);
      }
    }
    setLinks(results);
    if (failures.length > 0) {
      setError(`Failed to generate a link for: ${failures.join(", ")}`);
    }
    setLoading(false);
  };

  const copyLink = (link: string, idx: number) => {
    navigator.clipboard.writeText(link).then(() => {
      setCopiedIdx(idx);
      setTimeout(() => setCopiedIdx(null), 1500);
    });
  };

  const copyAll = () => {
    const text = links.map((l) => `${l.email}: ${l.inviteLink}`).join("\n");
    navigator.clipboard.writeText(text);
  };

  return (
    <>
      <div className="mx-auto max-w-xl">
        <h1 className="font-display text-2xl font-bold text-ink-900">Generate invite link</h1>
        <p className="mt-1 text-sm text-slate-500">Invite students to self-register for a course and batch. Links expire in 72 hours.</p>

        <div className="mt-4 flex gap-2">
          <button type="button" onClick={() => { setMode("single"); setLinks([]); setError(null); }}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${mode === "single" ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-600"}`}>
            Single student
          </button>
          <button type="button" onClick={() => { setMode("multiple"); setLinks([]); setError(null); }}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${mode === "multiple" ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-600"}`}>
            Multiple students
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4 rounded-2xl border border-slate-200 bg-white p-6">
          <ErrorBanner message={error} />
          <SuccessBanner message={links.length > 0 ? `${links.length} invite link${links.length > 1 ? "s" : ""} created below.` : null} />

          {mode === "single" ? (
            <Field
              label="Student email (optional - binds invite to this address)"
              id="inviteEmail"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          ) : (
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">
                Student emails (one per line, or comma-separated)
              </label>
              <textarea
                className="input min-h-[120px] w-full"
                placeholder={"student1@example.com\nstudent2@example.com\nstudent3@example.com"}
                value={emailsBulk}
                onChange={(e) => setEmailsBulk(e.target.value)}
              />
            </div>
          )}

          <SelectField label="Course *" id="inviteCourse" required value={courseId} onChange={(e) => setCourseId(e.target.value)}>
            <option value="">Select course</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.code})
              </option>
            ))}
          </SelectField>
          <SelectField label="Batch *" id="inviteBatch" required disabled={!courseId} value={batchId} onChange={(e) => setBatchId(e.target.value)}>
            <option value="">{courseId ? "Select batch" : "Select a course first"}</option>
            {batches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </SelectField>
          <PrimaryButton type="submit" disabled={loading}>
            {loading ? "Generating..." : mode === "single" ? "Generate invite link" : "Generate invite links"}
          </PrimaryButton>

          {links.length > 0 && (
            <div className="space-y-2">
              {links.length > 1 && (
                <button type="button" onClick={copyAll} className="text-xs text-brand-600 font-medium hover:underline">
                  Copy all as list
                </button>
              )}
              {links.map((l, idx) => (
                <div key={idx} className="rounded-lg border border-slate-200 bg-slate-50 p-3.5">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs font-medium text-slate-500">{l.email}</p>
                    <button type="button" onClick={() => copyLink(l.inviteLink, idx)}
                      className="text-xs text-brand-600 font-medium hover:underline">
                      {copiedIdx === idx ? "Copied!" : "Copy"}
                    </button>
                  </div>
                  <code className="break-all text-sm text-brand-700">{l.inviteLink}</code>
                </div>
              ))}
            </div>
          )}
        </form>
      </div>
    </>
  );
};
