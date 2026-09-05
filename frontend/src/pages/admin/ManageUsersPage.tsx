import React, { useEffect, useState } from "react";
import { ErrorBanner, SuccessBanner, extractErrorMessage } from "../../components/FormControls";
import { adminApi } from "../../services/adminUsersApi";
import { UserListItem } from "../../types";

const ROLES = ["super_admin", "admin", "faculty", "trainer", "hr", "placement_coordinator", "student", "guest"];

export const ManageUsersPage: React.FC = () => {
  const [users, setUsers] = useState<UserListItem[]>([]);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [batches, setBatches] = useState<{ id: string; name: string }[]>([]);
  const [assigning, setAssigning] = useState<string | null>(null); // userId currently being assigned
  const [selectedBatch, setSelectedBatch] = useState<Record<string, string>>({}); // userId -> batchId

  const loadUsers = async () => {
    setLoading(true);
    try {
      const { data } = await adminApi.listUsers({ search: search || undefined, role: roleFilter || undefined, limit: 100 });
      setUsers(data.items);
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
    adminApi.listBatches().then(({ data }) => setBatches(data)).catch(() => { /* dropdown just stays empty */ });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRoleChange = async (userId: string, role: string) => {
    setError(null);
    try {
      await adminApi.changeRole(userId, role);
      setSuccess("Role updated.");
      loadUsers();
    } catch (err) {
      setError(extractErrorMessage(err));
    }
  };

  const handleToggleAccess = async (userId: string, isActive: boolean) => {
    setError(null);
    try {
      await adminApi.setAccess(userId, !isActive);
      setSuccess(!isActive ? "Access restored." : "Access revoked.");
      loadUsers();
    } catch (err) {
      setError(extractErrorMessage(err));
    }
  };

  const handleAssignBatch = async (userId: string, userName: string) => {
    const batchId = selectedBatch[userId];
    if (!batchId) { setError("Pick a batch first."); return; }
    setError(null);
    setAssigning(userId);
    try {
      await adminApi.enrollInBatch(batchId, userId);
      const batchName = batches.find((b) => b.id === batchId)?.name || "the batch";
      setSuccess(`${userName} enrolled in ${batchName}.`);
      loadUsers();
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setAssigning(null);
    }
  };

  return (
    <>
      <h1 className="font-display text-2xl font-bold text-ink-900">Manage users</h1>
      <p className="mt-1 text-sm text-slate-500">Assign roles and control platform access.</p>

      <div className="mt-4 flex gap-3">
        <ErrorBanner message={error} />
        <SuccessBanner message={success} />
      </div>

      <div className="mt-4 flex gap-3">
        <input
          placeholder="Search by name or email"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && loadUsers()}
          className="w-64 rounded-lg border border-slate-300 px-3.5 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
        />
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="rounded-lg border border-slate-300 px-3.5 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
        >
          <option value="">All roles</option>
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {r.replace("_", " ")}
            </option>
          ))}
        </select>
        <button onClick={loadUsers} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">
          Filter
        </button>
      </div>

      <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Batch</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Joined</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-slate-400">
                  <span className="inline-flex items-center gap-1.5"><span className="text-brand-600 font-black text-xs">ARC</span> Loading…</span>
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-slate-400">
                  No users found.
                </td>
              </tr>
            ) : (
              users.map((u) => (
                <tr key={u.id}>
                  <td className="px-4 py-3 font-medium text-ink-900">{u.name}</td>
                  <td className="px-4 py-3 text-slate-600">{u.email}</td>
                  <td className="px-4 py-3">
                    <select
                      value={u.role}
                      onChange={(e) => handleRoleChange(u.id, e.target.value)}
                      className="rounded-md border border-slate-200 px-2 py-1 text-xs"
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>
                          {r.replace("_", " ")}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    {u.role === "student" ? (
                      <div className="space-y-1">
                        {u.batchName ? (
                          <span className="inline-block text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                            {u.batchName}
                          </span>
                        ) : (
                          <span className="inline-block text-xs font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
                            Unassigned
                          </span>
                        )}
                        <div className="flex items-center gap-1.5">
                          <select
                            value={selectedBatch[u.id] || ""}
                            onChange={(e) => setSelectedBatch((prev) => ({ ...prev, [u.id]: e.target.value }))}
                            className="rounded-md border border-slate-200 px-2 py-1 text-xs max-w-[130px]"
                          >
                            <option value="">{u.batchName ? "Change batch" : "Select batch"}</option>
                            {batches.map((b) => (
                              <option key={b.id} value={b.id}>{b.name}</option>
                            ))}
                          </select>
                          <button
                            onClick={() => handleAssignBatch(u.id, u.name)}
                            disabled={assigning === u.id || !selectedBatch[u.id]}
                            className="text-xs font-semibold text-brand-600 hover:text-brand-700 disabled:opacity-40 whitespace-nowrap"
                          >
                            {assigning === u.id ? "…" : "Assign"}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                        u.isActive ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
                      }`}
                    >
                      {u.isActive ? "Active" : "Revoked"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-500">{new Date(u.createdAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleToggleAccess(u.id, u.isActive)}
                      className="text-xs font-medium text-brand-600 hover:text-brand-700"
                    >
                      {u.isActive ? "Revoke access" : "Restore access"}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );
};
