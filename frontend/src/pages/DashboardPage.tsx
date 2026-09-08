import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

/** `/` and `/dashboard` are entry points hit right after login (and on a
 * bare visit to the site) — they should never render their own content,
 * only redirect straight to the role's actual dashboard page. Rendering
 * a generic placeholder here (as this page used to) meant every login
 * flashed a throwaway "Welcome / Portal / Account status" screen before
 * the real dashboard loaded. */
export const DashboardPage: React.FC = () => {
  const { user, loading } = useAuth();

  if (loading || !user) return null;

  if (user.role === "student") return <Navigate to="/student/dashboard" replace />;
  if (["faculty", "trainer"].includes(user.role)) return <Navigate to="/faculty/dashboard" replace />;
  if (["admin", "super_admin"].includes(user.role)) return <Navigate to="/admin/dashboard" replace />;
  if (user.role === "hr") return <Navigate to="/hr/analytics" replace />;
  if (user.role === "placement_coordinator") return <Navigate to="/hr/analytics" replace />;
  if (user.role === "counsellor") return <Navigate to="/counsellor/leads" replace />;

  // No dedicated dashboard for this role — nothing else to redirect to.
  return null;
};
