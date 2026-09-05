import React, { useState } from "react";
import { Link } from "react-router-dom";
import { AuthLayout } from "../../components/AuthLayout";
import { Field, PrimaryButton, ErrorBanner, SuccessBanner, extractErrorMessage } from "../../components/FormControls";
import { authApi } from "../../services/authApi";

export const ForgotPasswordPage: React.FC = () => {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await authApi.forgotPassword(email);
      setSuccess("If that email is registered, a reset link has been sent.");
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title="Reset your password" subtitle="We'll email you a link to reset it">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <ErrorBanner message={error} />
        <SuccessBanner message={success} />
        <Field label="Email address" id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <PrimaryButton type="submit" disabled={loading} className="w-full">
          {loading ? (<span className="inline-flex items-center gap-2"><span className="w-3.5 h-3.5 border-2 border-white/70 border-t-transparent rounded-full animate-spin" /> Sending…</span>) : "Send reset link"}
        </PrimaryButton>
        <p className="text-center text-sm text-slate-500">
          <Link to="/login" className="font-medium text-brand-600 hover:text-brand-700">
            Back to sign in
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
};
