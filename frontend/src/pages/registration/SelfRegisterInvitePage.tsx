import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AuthLayout } from "../../components/AuthLayout";
import { Field, PrimaryButton, ErrorBanner, SuccessBanner, extractErrorMessage } from "../../components/FormControls";
import { registrationApi } from "../../services/registrationApi";

const emptyForm = {
  name: "",
  email: "",
  password: "",
  phone: "",
  dateOfBirth: "",
  gender: "",
  city: "",
  highestQualification: "",
  institutionName: "",
};

export const SelfRegisterInvitePage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token") || "";
  const [form, setForm] = useState(emptyForm);
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(true);
  const [inviteValid, setInviteValid] = useState(false);

  useEffect(() => {
    if (!token) {
      setValidating(false);
      return;
    }
    registrationApi
      .validateInvite(token)
      .then((res: any) => {
        setInviteValid(true);
        if (res.data.email) setForm((f) => ({ ...f, email: res.data.email }));
      })
      .catch((err) => setError(extractErrorMessage(err)))
      .finally(() => setValidating(false));
  }, [token]);

  const update = (key: keyof typeof emptyForm) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [key]: e.target.value });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await registrationApi.registerViaInvite({
        inviteToken: token,
        ...form,
        dateOfBirth: form.dateOfBirth || undefined,
        photoConsentGiven: consent,
      });
      setSuccess("Registration complete! Redirecting to login...");
      setTimeout(() => navigate("/login"), 1500);
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  if (validating) {
    return (
      <AuthLayout title="Checking invite...">
        <p className="text-center text-sm text-slate-500">Please wait</p>
      </AuthLayout>
    );
  }

  if (!token || !inviteValid) {
    return (
      <AuthLayout title="Invite link invalid">
        <ErrorBanner message={error || "This invite link is invalid or has expired. Please contact your institution."} />
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Complete your registration" subtitle="You've been invited to join a course">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <ErrorBanner message={error} />
        <SuccessBanner message={success} />
        <Field label="Full name" id="name" required value={form.name} onChange={update("name")} />
        <Field label="Email" id="email" type="email" required value={form.email} onChange={update("email")} />
        <Field label="Password" id="password" type="password" minLength={8} required value={form.password} onChange={update("password")} />
        <Field label="Phone" id="phone" value={form.phone} onChange={update("phone")} />
        <Field label="Date of birth" id="dateOfBirth" type="date" value={form.dateOfBirth} onChange={update("dateOfBirth")} />
        <Field label="City" id="city" value={form.city} onChange={update("city")} />
        <Field label="Highest qualification" id="highestQualification" value={form.highestQualification} onChange={update("highestQualification")} />
        <Field label="Institution name" id="institutionName" value={form.institutionName} onChange={update("institutionName")} />

        <label className="flex items-start gap-2.5 rounded-lg border border-slate-200 bg-slate-50 p-3.5 text-sm text-ink-700">
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
          />
          <span>I consent to my photo being captured and stored for identity verification and attendance purposes.</span>
        </label>

        <PrimaryButton type="submit" disabled={loading} className="w-full">
          {loading ? (<span className="inline-flex items-center gap-2"><span className="w-3.5 h-3.5 border-2 border-white/70 border-t-transparent rounded-full animate-spin" /> Submitting…</span>) : "Complete registration"}
        </PrimaryButton>
      </form>
    </AuthLayout>
  );
};
