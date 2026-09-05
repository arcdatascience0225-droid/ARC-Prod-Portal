import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { adminApi } from "../../api/adminPlatformApi";
import type { UserOut } from "../../types";

// value = canonical role stored in the DB (matches backend RoleEnum);
// label = what's shown in the dropdown.
const ROLES = [
  { value: "super_admin", label: "Super Admin" },
  { value: "admin", label: "Admin" },
  { value: "faculty", label: "Faculty" },
  { value: "trainer", label: "Trainer" },
  { value: "hr", label: "HR" },
  { value: "placement_coordinator", label: "Placement Coordinator" },
  { value: "counsellor", label: "Counsellor" },
  { value: "manager", label: "Manager" },
  { value: "student", label: "Student" },
  { value: "guest", label: "Guest" },
];

const EMPTY_FORM = { name: "", email: "", password: "", role: "faculty" };

interface CatalogItem { path: string; label: string; group: string; defaultRoles: string[] }

export default function UserManagement() {
  const { user: currentUser } = useAuth();
  const isSuperAdmin = currentUser?.role === "super_admin";

  const [users, setUsers] = useState<UserOut[]>([]);
  const [filterRole, setFilterRole] = useState("");
  const [error, setError] = useState("");

  // Create User form state (Super Admin only)
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [createError, setCreateError] = useState("");
  const [creating, setCreating] = useState(false);
  const [createdMessage, setCreatedMessage] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Permissions picker (Super Admin only)
  const [catalog, setCatalog] = useState<CatalogItem[] | null>(null);
  const [permUser, setPermUser] = useState<UserOut | null>(null);
  const [permChecked, setPermChecked] = useState<Set<string>>(new Set());
  const [permIsCustom, setPermIsCustom] = useState(false);
  const [savingPerms, setSavingPerms] = useState(false);

  const load = () => {
    adminApi.listUsers(filterRole || undefined).then(setUsers).catch((e) => setError(e.message));
  };

  useEffect(() => { load(); }, [filterRole]);

  const changeRole = async (userId: string, role: string) => {
    try {
      await adminApi.updateUserRole(userId, role);
      load();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const removeUser = async (userId: string) => {
    if (!confirm("Delete this user?")) return;
    try {
      await adminApi.deleteUser(userId);
      load();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError("");
    setCreatedMessage("");

    if (!form.name.trim() || !form.email.trim() || !form.password) {
      setCreateError("Name, email and password are all required.");
      return;
    }
    if (form.password.length < 8) {
      setCreateError("Password must be at least 8 characters.");
      return;
    }

    setCreating(true);
    try {
      const created = await adminApi.createUser(form);
      setCreatedMessage(`${created.name} was created as ${ROLES.find((r) => r.value === created.role)?.label ?? created.role}.`);
      setForm(EMPTY_FORM);
      setShowCreateForm(false);
      load();
    } catch (e) {
      setCreateError((e as Error).message);
    } finally {
      setCreating(false);
    }
  };

  const openPermissions = async (u: UserOut) => {
    setPermUser(u);
    if (!catalog) {
      const cat = await adminApi.permissionsCatalog();
      setCatalog(cat);
    }
    const current = await adminApi.getUserPermissions(u.id);
    setPermChecked(new Set(current.permissions));
    setPermIsCustom(current.isCustom);
  };

  const togglePerm = (path: string) => {
    setPermChecked((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path); else next.add(path);
      return next;
    });
  };

  const savePermissions = async () => {
    if (!permUser) return;
    setSavingPerms(true);
    try {
      await adminApi.setUserPermissions(permUser.id, Array.from(permChecked));
      setPermUser(null);
      load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSavingPerms(false);
    }
  };

  const resetToDefault = async () => {
    if (!permUser) return;
    setSavingPerms(true);
    try {
      await adminApi.setUserPermissions(permUser.id, null);
      setPermUser(null);
      load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSavingPerms(false);
    }
  };

  const groupedCatalog = (catalog || []).reduce((acc: Record<string, CatalogItem[]>, item) => {
    (acc[item.group] ||= []).push(item);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink-900 dark:text-white">User Management</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Public sign-up only ever creates Student accounts. Staff accounts (Admin, Faculty, HR, etc.) can only be
            created here by a Super Admin.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value)}
          >
            <option value="">All roles</option>
            {ROLES.map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
          {isSuperAdmin && (
            <button
              onClick={() => setShowCreateForm((v) => !v)}
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700"
            >
              {showCreateForm ? "Cancel" : "+ Create User"}
            </button>
          )}
        </div>
      </div>

      {createdMessage && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300">
          {createdMessage}
        </div>
      )}

      {isSuperAdmin && showCreateForm && (
        <form
          onSubmit={handleCreateUser}
          className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
        >
          <h2 className="font-display text-base font-bold text-ink-900 dark:text-white">Create a new user</h2>

          {createError && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
              {createError}
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">
                Full name
              </label>
              <input
                className="input dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Jane Doe"
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">
                Email
              </label>
              <input
                type="email"
                className="input dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="jane@example.com"
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">
                Temporary password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  className="input pr-10 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="At least 8 characters"
                  minLength={8}
                  required
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
                >
                  {showPassword ? (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                      <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-5 0-9.27-3.11-11-8 .87-2.47 2.4-4.55 4.36-6.06M9.9 4.24A10.4 10.4 0 0 1 12 4c5 0 9.27 3.11 11 8a13.16 13.16 0 0 1-1.67 3.19M14.12 14.12a3 3 0 1 1-4.24-4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">
                Role
              </label>
              <select
                className="input dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
              >
                {ROLES.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => { setShowCreateForm(false); setForm(EMPTY_FORM); setCreateError(""); }}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-ink-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={creating}
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
            >
              {creating ? "Creating…" : "Create user"}
            </button>
          </div>
        </form>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {error}
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 dark:bg-slate-950 dark:text-slate-400">
            <tr>
              <th className="p-3 text-left">Name</th>
              <th className="p-3 text-left">Email</th>
              <th className="p-3 text-left">Phone</th>
              <th className="p-3 text-left">Role</th>
              <th className="p-3 text-left">Batch</th>
              <th className="p-3 text-left">Access</th>
              <th className="p-3 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t border-slate-100 dark:border-slate-800">
                <td className="p-3 text-ink-900 dark:text-slate-100">{u.name}</td>
                <td className="p-3 text-ink-700 dark:text-slate-300">{u.email}</td>
                <td className="p-3 text-ink-700 dark:text-slate-300">{u.phone || "—"}</td>
                <td className="p-3">
                  <select
                    className="rounded-md border border-slate-200 px-2 py-1 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                    value={u.role}
                    onChange={(e) => changeRole(u.id, e.target.value)}
                    disabled={!isSuperAdmin}
                  >
                    {ROLES.map((r) => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                </td>
                <td className="p-3">
                  {u.role === "student" ? (
                    u.batchName ? (
                      <span className="inline-block text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full dark:bg-emerald-950 dark:text-emerald-300">
                        {u.batchName}
                      </span>
                    ) : (
                      <span className="inline-block text-xs font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full dark:bg-amber-950 dark:text-amber-300">
                        Unassigned
                      </span>
                    )
                  ) : (
                    <span className="text-xs text-slate-300 dark:text-slate-600">—</span>
                  )}
                </td>
                <td className="p-3">
                  {isSuperAdmin ? (
                    <button onClick={() => openPermissions(u)} className="text-xs text-brand-600 hover:underline font-medium">
                      {u.hasCustomPermissions ? "Custom access" : "Default access"}
                    </button>
                  ) : (
                    <span className="text-xs text-slate-300 dark:text-slate-600">—</span>
                  )}
                </td>
                <td className="p-3">
                  <button
                    onClick={() => removeUser(u.id)}
                    disabled={!isSuperAdmin}
                    className="text-red-600 hover:underline disabled:cursor-not-allowed disabled:text-slate-300 disabled:no-underline dark:text-red-400 dark:disabled:text-slate-600"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Permissions picker modal */}
      {permUser && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setPermUser(null)}>
          <div className="bg-white dark:bg-slate-900 rounded-xl w-full max-w-2xl max-h-[85vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-1">
              <h2 className="font-display text-lg font-bold text-ink-900 dark:text-white">Access for {permUser.name}</h2>
              <button onClick={() => setPermUser(null)} className="text-slate-400 hover:text-slate-600 text-xl leading-none">✕</button>
            </div>
            <p className="text-xs text-slate-400 mb-4">
              {permIsCustom ? "This user has a custom access list." : `Showing default access for role "${permUser.role}". Check/uncheck to customize.`}
            </p>

            {!catalog ? (
              <p className="text-sm text-slate-400">Loading…</p>
            ) : (
              <div className="space-y-4">
                {Object.entries(groupedCatalog).map(([group, items]) => (
                  <div key={group}>
                    <p className="text-xs font-semibold uppercase text-slate-400 mb-1.5">{group}</p>
                    <div className="grid grid-cols-2 gap-1.5">
                      {items.map((item) => (
                        <label key={item.path} className="flex items-center gap-2 text-sm text-ink-700 dark:text-slate-200">
                          <input type="checkbox" checked={permChecked.has(item.path)} onChange={() => togglePerm(item.path)} />
                          {item.label}
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-between mt-6">
              <button onClick={resetToDefault} disabled={savingPerms}
                className="text-xs text-slate-500 hover:underline disabled:opacity-50">
                Reset to role default
              </button>
              <div className="flex gap-2">
                <button onClick={() => setPermUser(null)}
                  className="px-4 py-2 rounded-lg text-sm border border-slate-200 dark:border-slate-700 dark:text-slate-200">
                  Cancel
                </button>
                <button onClick={savePermissions} disabled={savingPerms}
                  className="px-4 py-2 rounded-lg text-sm bg-brand-600 text-white font-semibold hover:bg-brand-700 disabled:opacity-60">
                  {savingPerms ? "Saving…" : "Save access"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
