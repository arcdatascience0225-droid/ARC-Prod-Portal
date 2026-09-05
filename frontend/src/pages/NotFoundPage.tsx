import React from "react";
import { Link } from "react-router-dom";

export const NotFoundPage: React.FC = () => (
  <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-center">
    <p className="font-display text-6xl font-bold text-brand-500">404</p>
    <h1 className="text-lg font-semibold text-ink-900 dark:text-white">Page not found</h1>
    <p className="max-w-sm text-sm text-slate-500 dark:text-slate-400">
      The page you're looking for doesn't exist or you don't have access to it.
    </p>
    <Link
      to="/dashboard"
      className="mt-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700"
    >
      Back to dashboard
    </Link>
  </div>
);
