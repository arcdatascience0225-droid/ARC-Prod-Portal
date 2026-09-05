import React, { useEffect, useState } from "react";
import { Field, SelectField, PrimaryButton, ErrorBanner, SuccessBanner, extractErrorMessage } from "../../components/FormControls";
import { registrationApi } from "../../services/registrationApi";
import { Course, Batch } from "../../types";

const emptyForm = {
  name: "",
  email: "",
  phone: "",
  dateOfBirth: "",
  gender: "",
  address: "",
  city: "",
  state: "",
  pincode: "",
  highestQualification: "",
  institutionName: "",
  graduationYear: "",
  percentageOrCgpa: "",
  stream: "",
  courseId: "",
  batchId: "",
};

export const StaffRegisterStudentPage: React.FC = () => {
  const [form, setForm] = useState(emptyForm);
  const [consent, setConsent] = useState(false);
  const [courses, setCourses] = useState<Course[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    registrationApi.listCourses().then((res) => setCourses(res.data)).catch(() => {});
  }, []);

  useEffect(() => {
    // Reset any previously chosen batch so a batch from the old course can't
    // be submitted against the new one.
    setForm((f) => ({ ...f, batchId: "" }));
    if (form.courseId) {
      registrationApi.listBatches(form.courseId).then((res) => setBatches(res.data)).catch(() => {});
    } else {
      setBatches([]);
    }
  }, [form.courseId]);

  const update = (key: keyof typeof emptyForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm({ ...form, [key]: e.target.value });

  const checkDuplicate = async () => {
    if (!form.name || !form.email) return;
    try {
      const { data } = await registrationApi.duplicateCheck(form.name, form.email, form.phone);
      setDuplicateWarning(data.isDuplicate ? "A similar student record already exists. Please verify before continuing." : null);
    } catch {
      // non-blocking
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    // Course + batch are mandatory server-side; block here too so the user
    // gets an inline message instead of a 422.
    if (!form.courseId || !form.batchId) {
      setError("Please select both a course and a batch. Students must be assigned to a batch at registration.");
      return;
    }
    setLoading(true);
    try {
      const payload = {
        ...form,
        graduationYear: form.graduationYear ? Number(form.graduationYear) : undefined,
        dateOfBirth: form.dateOfBirth || undefined,
        photoConsentGiven: consent,
      };
      const { data } = await registrationApi.registerByStaff(payload);
      setSuccess(`Student "${data.name}" registered successfully. A welcome email with temporary credentials has been sent.`);
      setForm(emptyForm);
      setConsent(false);
      setDuplicateWarning(null);
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="mx-auto max-w-3xl">
        <h1 className="font-display text-2xl font-bold text-ink-900">Register a student</h1>
        <p className="mt-1 text-sm text-slate-500">Staff-assisted registration with full profile capture.</p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-6 rounded-2xl border border-slate-200 bg-white p-6">
          <ErrorBanner message={error} />
          <SuccessBanner message={success} />
          {duplicateWarning && <ErrorBanner message={duplicateWarning} />}

          <div>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">Personal details</h2>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Full name" id="name" required value={form.name} onChange={update("name")} onBlur={checkDuplicate} />
              <Field label="Email" id="email" type="email" required value={form.email} onChange={update("email")} onBlur={checkDuplicate} />
              <Field label="Phone" id="phone" value={form.phone} onChange={update("phone")} onBlur={checkDuplicate} />
              <Field label="Date of birth" id="dateOfBirth" type="date" value={form.dateOfBirth} onChange={update("dateOfBirth")} />
              <SelectField label="Gender" id="gender" value={form.gender} onChange={update("gender")}>
                <option value="">Select</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </SelectField>
            </div>
          </div>

          <div>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">Contact details</h2>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Address" id="address" value={form.address} onChange={update("address")} />
              <Field label="City" id="city" value={form.city} onChange={update("city")} />
              <Field label="State" id="state" value={form.state} onChange={update("state")} />
              <Field label="Pincode" id="pincode" value={form.pincode} onChange={update("pincode")} />
            </div>
          </div>

          <div>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">Educational background</h2>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Highest qualification" id="highestQualification" value={form.highestQualification} onChange={update("highestQualification")} />
              <Field label="Institution name" id="institutionName" value={form.institutionName} onChange={update("institutionName")} />
              <Field label="Graduation year" id="graduationYear" type="number" value={form.graduationYear} onChange={update("graduationYear")} />
              <Field label="Percentage / CGPA" id="percentageOrCgpa" value={form.percentageOrCgpa} onChange={update("percentageOrCgpa")} />
              <Field label="Stream" id="stream" value={form.stream} onChange={update("stream")} />
            </div>
          </div>

          <div>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">Course assignment (required)</h2>
            <p className="mb-3 text-xs text-slate-500">
              A student must be enrolled in a batch - attendance, performance reports and announcements are all batch-scoped.
            </p>
            <div className="grid grid-cols-2 gap-4">
              <SelectField label="Course *" id="courseId" required value={form.courseId} onChange={update("courseId")}>
                <option value="">Select course</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.code})
                  </option>
                ))}
              </SelectField>
              <SelectField label="Batch *" id="batchId" required disabled={!form.courseId} value={form.batchId} onChange={update("batchId")}>
                <option value="">{form.courseId ? "Select batch" : "Select a course first"}</option>
                {batches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </SelectField>
            </div>
          </div>

          <label className="flex items-start gap-2.5 rounded-lg border border-slate-200 bg-slate-50 p-3.5 text-sm text-ink-700">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
            />
            <span>
              I confirm the student has given consent for their photo to be captured and stored, for future use in
              face-attendance and identity verification.
            </span>
          </label>

          <PrimaryButton type="submit" disabled={loading}>
            {loading ? (<span className="inline-flex items-center gap-2"><span className="w-3.5 h-3.5 border-2 border-white/70 border-t-transparent rounded-full animate-spin" /> Registering…</span>) : "Register student"}
          </PrimaryButton>
        </form>
      </div>
    </>
  );
};
