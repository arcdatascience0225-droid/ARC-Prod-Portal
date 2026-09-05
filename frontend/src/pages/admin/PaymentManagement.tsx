import { useEffect, useState } from "react";
import { adminApi } from "../../api/adminPlatformApi";
import type { PaymentOut } from "../../types";

const STATUSES = ["pending", "paid", "failed", "refunded"];

export default function PaymentManagement() {
  const [payments, setPayments] = useState<PaymentOut[]>([]);
  const [filter, setFilter] = useState("");
  const [error, setError] = useState("");

  const load = () => adminApi.listPayments(filter || undefined).then(setPayments).catch((e) => setError(e.message));
  useEffect(() => { load(); }, [filter]);

  const updateStatus = async (id: string, status: string) => {
    try {
      await adminApi.updatePaymentStatus(id, status);
      load();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">Payments & Fee Records</h1>
        <select className="border rounded-md px-3 py-2 text-sm" value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="">All statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      {error && <div className="bg-red-50 text-red-700 p-3 rounded-md text-sm">{error}</div>}
      <div className="bg-white rounded-xl shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              <th className="text-left p-3">User ID</th>
              <th className="text-left p-3">Amount</th>
              <th className="text-left p-3">Status</th>
              <th className="text-left p-3">Method</th>
              <th className="text-left p-3">Date</th>
            </tr>
          </thead>
          <tbody>
            {payments.map((p) => (
              <tr key={p.id} className="border-t">
                <td className="p-3">{p.user_id}</td>
                <td className="p-3">{p.currency} {p.amount}</td>
                <td className="p-3">
                  <select className="border rounded-md px-2 py-1" value={p.status} onChange={(e) => updateStatus(p.id, e.target.value)}>
                    {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </td>
                <td className="p-3">{p.payment_method ?? "-"}</td>
                <td className="p-3">{p.created_at.slice(0, 10)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
