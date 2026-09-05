import React, { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { ErrorBoundary } from "./ErrorBoundary";

type IconProps = { className?: string };
const icon = (path: React.ReactNode) => ({ className = "h-5 w-5" }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className}>{path}</svg>
);

const Icons = {
  dashboard: icon(<><rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" /></>),
  userPlus: icon(<><path d="M13 20a5 5 0 0 0-10 0" /><circle cx="8" cy="8" r="4" /><path d="M19 8v6M22 11h-6" /></>),
  book: icon(<><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15Z" /></>),
  code: icon(<><polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" /></>),
  briefcase: icon(<><rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" /></>),
  chat: icon(<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5Z" />),
  users: icon(<><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></>),
  clipboard: icon(<><rect x="8" y="2" width="8" height="4" rx="1" /><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" /></>),
  building: icon(<><rect x="3" y="3" width="7" height="18" /><rect x="14" y="8" width="7" height="13" /><line x1="7" y1="7" x2="7" y2="7.01" /><line x1="7" y1="11" x2="7" y2="11.01" /></>),
  target: icon(<><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" /></>),
  chart: icon(<><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></>),
  settings: icon(<><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09A1.65 1.65 0 0 0 15 4.6a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9c.36.14.68.36 1 .51H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" /></>),
  bell: icon(<><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" /></>),
  logs: icon(<><line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" /></>),
  card: icon(<><rect x="1" y="4" width="22" height="16" rx="2" /><line x1="1" y1="10" x2="23" y2="10" /></>),
  megaphone: icon(<><path d="M3 11v3a1 1 0 0 0 1 1h1l3 6 1-1v-5h6l4 3V6l-4 3H9V4l-1-1-3 6H4a1 1 0 0 0-1 1Z" /></>),
  sun: icon(<><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>),
  moon: icon(<path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8Z" />),
  logout: icon(<><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></>),
  bot: icon(<><rect x="3" y="8" width="18" height="12" rx="2" /><circle cx="8.5" cy="14" r="1.2" /><circle cx="15.5" cy="14" r="1.2" /><path d="M12 8V4M9 4h6" /></>),
  menu: icon(<><line x1="4" y1="7" x2="20" y2="7" /><line x1="4" y1="12" x2="20" y2="12" /><line x1="4" y1="17" x2="20" y2="17" /></>),
  close: icon(<><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></>),
  chevronsLeft: icon(<><polyline points="11 17 6 12 11 7" /><polyline points="18 17 13 12 18 7" /></>),
  chevronsRight: icon(<><polyline points="13 17 18 12 13 7" /><polyline points="6 17 11 12 6 7" /></>),
  chevronDown: icon(<polyline points="6 9 12 15 18 9" />),
};

interface NavItem { to: string; label: string; roles: string[]; icon: React.FC<IconProps>; }
interface NavGroup { label: string; items: NavItem[]; collapsible?: boolean; }

// ── Collapsed by default for Super Admin to reduce visual noise ───────────
const NAV_GROUPS: NavGroup[] = [
  {
    label: "Overview",
    items: [{ to: "/dashboard", label: "Dashboard", roles: ["super_admin","admin","hr","placement_coordinator","counsellor","manager","guest"], icon: Icons.dashboard }],
  },
  {
    label: "Registration",
    collapsible: true,
    items: [
      { to: "/registration/staff",  label: "Register Student", roles: ["super_admin","admin","faculty","trainer","hr","placement_coordinator"], icon: Icons.userPlus },
      { to: "/registration/invite", label: "Invite Links",      roles: ["super_admin","admin","faculty","trainer","hr","placement_coordinator"], icon: Icons.userPlus },
    ],
  },
  {
    label: "Learning",
    items: [
      { to: "/student/dashboard",         label: "Dashboard",          roles: ["student"], icon: Icons.dashboard },
      { to: "/student/profile",           label: "My Profile",         roles: ["student"], icon: Icons.users },
      { to: "/student/learning",          label: "Learning",           roles: ["student"], icon: Icons.book },
      { to: "/student/assignments",       label: "Assignments",        roles: ["student"], icon: Icons.clipboard },
      { to: "/student/coding-lab",        label: "Coding Lab",         roles: ["student"], icon: Icons.code },
      { to: "/student/assessments/history", label: "Assessment History", roles: ["student"], icon: Icons.chart },
      { to: "/student/mock-interview",    label: "Mock Interview",     roles: ["student"], icon: Icons.chat },
    ],
  },
  {
    label: "Jobs & Career",
    items: [
      { to: "/student/jobs/recommended",  label: "Recommended Jobs",   roles: ["student"], icon: Icons.briefcase },
      { to: "/student/jobs/applications", label: "My Applications",    roles: ["student"], icon: Icons.briefcase },
      { to: "/student/jobs/offers",       label: "My Offers",          roles: ["student"], icon: Icons.briefcase },
      { to: "/chatbot",                   label: "AI Career Assistant", roles: ["student"], icon: Icons.bot },
      { to: "/chatbot/resume-builder",    label: "Resume Builder",     roles: ["student"], icon: Icons.clipboard },
      { to: "/chatbot/career-guidance",   label: "Career Guidance",    roles: ["student"], icon: Icons.target },
    ],
  },
  {
    label: "Faculty Portal",
    collapsible: true,
    items: [
      { to: "/faculty/dashboard",      label: "Faculty Dashboard",    roles: ["faculty","trainer","super_admin"], icon: Icons.dashboard },
      { to: "/faculty/announcements",  label: "Announcements",        roles: ["faculty","trainer","super_admin"], icon: Icons.megaphone },
      { to: "/faculty/attendance",     label: "Attendance",           roles: ["faculty","trainer","super_admin","manager"], icon: Icons.clipboard },
      { to: "/faculty/question-bank",  label: "Question Bank",        roles: ["faculty","trainer","super_admin"], icon: Icons.book },
      { to: "/faculty/assessments",    label: "My Assessments",       roles: ["faculty","trainer","super_admin"], icon: Icons.clipboard },
      { to: "/faculty/assessments/new","label": "Create Assessment",  roles: ["faculty","trainer","super_admin"], icon: Icons.clipboard },
      { to: "/faculty/evaluate",       label: "Evaluate Assignments",  roles: ["faculty","trainer","super_admin"], icon: Icons.clipboard },
      { to: "/faculty/performance",    label: "Student Performance",  roles: ["faculty","trainer","super_admin"], icon: Icons.chart },
      { to: "/faculty/mock-interviews","label": "Mock Interviews",    roles: ["faculty","trainer","super_admin"], icon: Icons.chat },
      { to: "/faculty/reports",        label: "Reports",              roles: ["faculty","trainer","super_admin"], icon: Icons.chart },
      { to: "/faculty/chat",           label: "Chat with Students",   roles: ["faculty","trainer","super_admin"], icon: Icons.chat },
    ],
  },
  {
    label: "Counsellor",
    collapsible: true,
    items: [
      { to: "/counsellor/leads", label: "Leads", roles: ["counsellor","super_admin"], icon: Icons.users },
    ],
  },
  {
    label: "HR / Placement",
    collapsible: true,
    items: [
      { to: "/hr/companies",        label: "Companies",           roles: ["hr","placement_coordinator","super_admin"], icon: Icons.building },
      { to: "/hr/jobs",             label: "Jobs",                roles: ["hr","placement_coordinator","super_admin"], icon: Icons.briefcase },
      { to: "/hr/candidate-match",  label: "Candidate Matching",  roles: ["hr","placement_coordinator","super_admin"], icon: Icons.target },
      { to: "/hr/offers",           label: "Offers",              roles: ["hr","placement_coordinator","super_admin"], icon: Icons.card },
      { to: "/hr/analytics",        label: "Placement Analytics", roles: ["hr","placement_coordinator","super_admin"], icon: Icons.chart },
      { to: "/interview/schedule",  label: "Schedule Interview",  roles: ["hr","placement_coordinator","faculty","trainer","super_admin"], icon: Icons.chat },
      { to: "/interview/conduct",   label: "Conduct Interview",   roles: ["hr","placement_coordinator","faculty","trainer","super_admin"], icon: Icons.chat },
    ],
  },
  {
    label: "Administration",
    collapsible: true,
    items: [
      { to: "/admin/user-management",  label: "Manage Users",        roles: ["super_admin"], icon: Icons.users },
      { to: "/admin/sign-in-logs",     label: "Sign-In Activity",    roles: ["super_admin"], icon: Icons.logs },
      { to: "/admin/courses-batches",  label: "Courses & Batches",   roles: ["super_admin","admin"], icon: Icons.book },
      { to: "/admin/students",         label: "Students",            roles: ["super_admin","admin","hr"], icon: Icons.users },
      { to: "/admin/faculty",          label: "Faculty",             roles: ["super_admin","admin"], icon: Icons.users },
      { to: "/admin/payments",         label: "Payments",            roles: ["super_admin","admin","manager"], icon: Icons.card },
      { to: "/admin/fees",             label: "Fees",                roles: ["super_admin","admin","manager"], icon: Icons.card },
      { to: "/admin/settings",         label: "Platform Settings",   roles: ["super_admin"], icon: Icons.settings },
      { to: "/admin/audit-log",        label: "Audit Log",           roles: ["super_admin"], icon: Icons.logs },
      { to: "/admin/ai-usage",         label: "AI Usage Dashboard",  roles: ["super_admin"], icon: Icons.bot },
      { to: "/admin/notifications",    label: "Notifications",       roles: ["super_admin","admin"], icon: Icons.bell },
    ],
  },
  {
    label: "Analytics",
    items: [{ to: "/analytics", label: "Analytics", roles: ["super_admin","admin","faculty","trainer","hr","placement_coordinator"], icon: Icons.chart }],
  },
];

const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super Admin", admin: "Admin", faculty: "Faculty",
  trainer: "Trainer", hr: "HR", placement_coordinator: "Placement Coordinator",
  student: "Student", guest: "Guest",
};

// Roles that see many sections — collapse groups by default for them
const POWER_ROLES = ["super_admin", "admin"];

function initialsOf(name?: string) {
  if (!name) return "?";
  const p = name.trim().split(/\s+/);
  return ((p[0]?.[0] || "") + (p[1]?.[0] || "")).toUpperCase() || name[0]?.toUpperCase() || "?";
}

// ── Collapsible group component ───────────────────────────────────────────────
function NavGroupSection({
  group, collapsed: sidebarCollapsed, defaultOpen,
}: { group: NavGroup; collapsed: boolean; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);

  if (!group.collapsible) {
    return (
      <div>
        <p className={`px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500 ${sidebarCollapsed ? "md:hidden" : ""}`}>
          {group.label}
        </p>
        <div className="space-y-0.5">
          {group.items.map((item) => (
            <NavItem key={item.to} item={item} sidebarCollapsed={sidebarCollapsed} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <button
        onClick={() => setOpen((v) => !v)}
        className={`flex w-full items-center gap-2 px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400 hover:text-slate-200 transition ${sidebarCollapsed ? "md:hidden" : ""}`}
      >
        <span className="flex-1 text-left">{group.label}</span>
        <Icons.chevronDown className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="space-y-0.5">
          {group.items.map((item) => (
            <NavItem key={item.to} item={item} sidebarCollapsed={sidebarCollapsed} />
          ))}
        </div>
      )}
    </div>
  );
}

function NavItem({ item, sidebarCollapsed }: { item: NavItem; sidebarCollapsed: boolean }) {
  return (
    <NavLink
      to={item.to}
      title={sidebarCollapsed ? item.label : undefined}
      className={({ isActive }) =>
        `flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition ${sidebarCollapsed ? "md:justify-center" : ""} ${
          isActive ? "bg-white/10 text-white shadow-inner" : "text-slate-300 hover:bg-white/5 hover:text-white"
        }`
      }
    >
      <item.icon className="h-4 w-4 shrink-0" />
      <span className={`truncate ${sidebarCollapsed ? "md:hidden" : ""}`}>{item.label}</span>
    </NavLink>
  );
}

// ── Main AppShell ─────────────────────────────────────────────────────────────
export const AppShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem("arc-nav-collapsed") === "1");

  const toggleCollapsed = () => {
    setCollapsed((v) => { localStorage.setItem("arc-nav-collapsed", !v ? "1" : "0"); return !v; });
  };

  const isPowerRole = user ? POWER_ROLES.includes(user.role) : false;
  const isStudent = user?.role === "student";
  const brandTitle = isStudent ? "ARC Students Portal" : "ARC Technologies & Institutions";
  const brandSubtitle = isStudent ? "Learning, Assessments & Placement" : "AI Learning & Placement Platform";

  const groups = NAV_GROUPS.map((g) => ({
    ...g,
    items: g.items.filter((item) => {
      if (!user) return false;
      // A Super Admin-set custom permission list overrides the role
      // default entirely — only show items explicitly granted.
      if (user.permissions) return user.permissions.includes(item.to);
      return item.roles.includes(user.role);
    }),
  })).filter((g) => g.items.length > 0);

  const handleLogout = async () => { await logout(); navigate("/login"); };
  const sidebarWidth = collapsed ? "md:w-20" : "md:w-72";

  const sidebarInner = (
    <>
      {/* Brand */}
      <div className={`flex items-center gap-3 border-b border-white/10 px-5 py-5 ${collapsed ? "md:justify-center md:px-3" : ""}`}>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-500 font-display text-sm font-extrabold text-white shadow-lg shadow-brand-900/40">
          ARC
        </div>
        <div className={`min-w-0 ${collapsed ? "md:hidden" : ""}`}>
          <p className="truncate font-display text-sm font-bold text-white">{brandTitle}</p>
          <p className="truncate text-[11px] text-slate-400">{brandSubtitle}</p>
        </div>
        <button onClick={() => setMobileNavOpen(false)} className="ml-auto flex h-8 w-8 items-center justify-center rounded-lg text-slate-300 hover:bg-white/10 md:hidden">
          <Icons.close className="h-4 w-4" />
        </button>
      </div>

      {/* Nav — FIX: overflow-y-auto on the nav itself, NOT on the page */}
      <nav className="flex-1 space-y-4 overflow-y-auto overflow-x-hidden px-3 py-5 scrollbar-thin scrollbar-thumb-white/10">
        {groups.map((group) => (
          <NavGroupSection
            key={group.label}
            group={group}
            collapsed={collapsed}
            // Power roles (admin/super_admin) see collapsible groups collapsed by default
            // to reduce visual noise; single-section roles see them open
            defaultOpen={!isPowerRole || !group.collapsible}
          />
        ))}
      </nav>

      {/* User footer */}
      <div className="border-t border-white/10 px-4 py-4 shrink-0">
        <div className={`flex items-center gap-3 ${collapsed ? "md:justify-center" : ""}`}>
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-500/20 text-sm font-bold text-brand-200">
            {initialsOf(user?.name)}
          </div>
          <div className={`min-w-0 ${collapsed ? "md:hidden" : ""}`}>
            <p className="truncate text-sm font-semibold text-white">{user?.name}</p>
            <p className="truncate text-[11px] text-slate-400">{user ? ROLE_LABELS[user.role] : ""}</p>
          </div>
        </div>
        <button onClick={handleLogout} className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm font-medium text-slate-200 transition hover:bg-white/10">
          <Icons.logout className="h-4 w-4" />
          <span className={collapsed ? "md:hidden" : ""}>Sign out</span>
        </button>
        <button onClick={toggleCollapsed} className="mt-2 hidden w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-slate-400 transition hover:bg-white/10 hover:text-white md:flex">
          {collapsed ? <Icons.chevronsRight className="h-4 w-4" /> : <><Icons.chevronsLeft className="h-4 w-4" /> Collapse</>}
        </button>
      </div>
    </>
  );

  return (
    /* ─── KEY FIX: h-screen + overflow-hidden on the root, NOT min-h-screen ───
       Previously both the sidebar and the main column had `min-h-screen` which
       made the entire page (including the sidebar) scroll together. Now the root
       is exactly viewport-height, the sidebar scrolls internally via its own
       overflow-y-auto nav, and the main content area scrolls independently. */
    <div className="flex h-screen overflow-hidden bg-slate-50 dark:bg-slate-950">
      {/* Mobile overlay */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-30 bg-black/50 md:hidden" onClick={() => setMobileNavOpen(false)} />
      )}

      {/* Sidebar — fixed height, internal scroll */}
      <aside className={`fixed inset-y-0 left-0 z-40 flex w-72 flex-col bg-gradient-to-b from-brand-900 via-[#161c40] to-ink-900 text-slate-200 transition-transform duration-200 md:static md:z-auto md:translate-x-0 ${sidebarWidth} ${mobileNavOpen ? "translate-x-0" : "-translate-x-full"}`}>
        {sidebarInner}
      </aside>

      {/* Main column — also fixed height, only content area scrolls */}
      <div className="flex flex-1 flex-col overflow-hidden md:min-w-0">
        <header className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 py-4 dark:border-slate-800 dark:bg-slate-900 sm:px-8">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={() => setMobileNavOpen(true)} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 md:hidden">
              <Icons.menu className="h-4 w-4" />
            </button>
            <div className="min-w-0">
              <p className="truncate font-display text-sm font-bold text-ink-900 dark:text-white">{brandTitle}</p>
              <p className="hidden truncate text-xs text-slate-400 dark:text-slate-500 sm:block">
                Signed in as <span className="font-medium capitalize">{user ? ROLE_LABELS[user.role] : ""}</span>
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <button onClick={toggleTheme} className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">
              {theme === "dark" ? <Icons.sun className="h-4 w-4" /> : <Icons.moon className="h-4 w-4" />}
            </button>
            <div className="relative">
              <button onClick={() => setMenuOpen((v) => !v)} className="flex items-center gap-2 rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm font-medium text-ink-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-100 text-[11px] font-bold text-brand-700 dark:bg-brand-900 dark:text-brand-200">
                  {initialsOf(user?.name)}
                </span>
                <span className="hidden sm:inline">{user?.name}</span>
              </button>
              {menuOpen && (
                <div className="absolute right-0 z-10 mt-2 w-44 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-700 dark:bg-slate-900" onMouseLeave={() => setMenuOpen(false)}>
                  <button onClick={handleLogout} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-ink-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800">
                    <Icons.logout className="h-4 w-4" /> Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Content — this is the only scrolling area */}
        <main className="flex-1 overflow-y-auto bg-slate-50 px-4 py-6 dark:bg-slate-950 sm:px-8 sm:py-8">
          <ErrorBoundary>{children}</ErrorBoundary>
        </main>
      </div>
    </div>
  );
};

export const AppShellLayout: React.FC = () => <AppShell><Outlet /></AppShell>;
