import { useEffect, useState } from "react";
import { api } from "../../services/api";
import { adminApi } from "../../api/adminPlatformApi";
import ArcLoader from "../../components/ArcLoader";
import type { UserOut } from "../../types";

interface Installment { id: string; installmentNumber: number; amount: number; dueDate: string | null; status: string; paidAt: string | null }
interface FeeStructure {
  id: string; studentId: string; studentName: string; studentEmail: string;
  totalAmount: number; planType: string; paidAmount: number; pendingAmount: number;
  installments: Installment[];
}

const EMPTY_INSTALLMENT = { amount: "", dueDate: "" };

export default function FeesPage() {
  const [fees, setFees] = useState<FeeStructure[] | null>(null);
  const [students, setStudents] = useState<UserOut[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [studentId, setStudentId] = useState("");
  const [totalAmount, setTotalAmount] = useState("");
  const [planType, setPlanType] = useState<"one_time" | "installment">("one_time");
  const [oneTimeDueDate, setOneTimeDueDate] = useState("");
  const [installments, setInstallments] = useState([{ ...EMPTY_INSTALLMENT }]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = () => {
    api.get<FeeStructure[]>("/api/v1/fees").then((r) => setFees(r.data)).catch(() => setFees([]));
  };

  useEffect(() => {
    load();
    adminApi.listUsers("student").then(setStudents).catch(() => {});
  }, []);

  const addInstallmentRow = () => setInstallments([...installments, { ...EMPTY_INSTALLMENT }]);
  const updateInstallment = (i: number, field: "amount" | "dueDate", value: string) => {
    const next = [...installments];
    next[i] = { ...next[i], [field]: value };
    setInstallments(next);
  };
  const removeInstallmentRow = (i: number) => setInstallments(installments.filter((_, idx) => idx !== i));

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentId || !totalAmount) { setError("Student and total amount are required."); return; }
    setSaving(true);
    setError("");
    try {
      const body: any = { studentId, totalAmount: Number(totalAmount), planType };
      if (planType === "one_time") {
        body.installments = [{ amount: Number(totalAmount), dueDate: oneTimeDueDate || null }];
      } else {
        body.installments = installments
          .filter((i) => i.amount)
          .map((i) => ({ amount: Number(i.amount), dueDate: i.dueDate || null }));
      }
      await api.post("/api/v1/fees", body);
      setShowForm(false);
      setStudentId(""); setTotalAmount(""); setPlanType("one_time"); setOneTimeDueDate("");
      setInstallments([{ ...EMPTY_INSTALLMENT }]);
      load();
    } catch {
      setError("Failed to create fee structure.");
    } finally {
      setSaving(false);
    }
  };

  const markPaid = async (installmentId: string) => {
    try {
      await api.put(`/api/v1/fees/installments/${installmentId}/status`, { status: "paid" });
      load();
    } catch {
      setError("Failed to update installment.");
    }
  };

  const installmentSum = installments.reduce((sum, i) => sum + (Number(i.amount) || 0), 0);

  if (fees === null) return <ArcLoader label="Loading fees" />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Fees</h1>
          <p className="text-sm text-gray-500 mt-1">Student fee structures — one-time or installment plans.</p>
        </div>
        <button onClick={() => setShowForm((v) => !v)} className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-semibold">
          {showForm ? "Cancel" : "+ New Fee Structure"}
        </button>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3">{error}</div>}

      {showForm && (
        <form onSubmit={handleCreate} className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <select value={studentId} onChange={(e) => setStudentId(e.target.value)} className="input" required>
              <option value="">Select student</option>
              {students.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.email})</option>)}
            </select>
            <input type="number" className="input" placeholder="Total amount *" value={totalAmount}
              onChange={(e) => setTotalAmount(e.target.value)} required />
          </div>

          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input type="radio" checked={planType === "one_time"} onChange={() => setPlanType("one_time")} />
              One-time
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="radio" checked={planType === "installment"} onChange={() => setPlanType("installment")} />
              Installment
            </label>
          </div>

          {planType === "one_time" ? (
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Due date (optional)</label>
              <input type="date" className="input" value={oneTimeDueDate} onChange={(e) => setOneTimeDueDate(e.target.value)} />
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-gray-500">
                Installments (sum: ₹{installmentSum}{totalAmount && Number(totalAmount) !== installmentSum ? ` — total is ₹${totalAmount}` : ""})
              </p>
              {installments.map((inst, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <input type="number" placeholder={`Installment ${i + 1} amount`} className="input flex-1" value={inst.amount}
                    onChange={(e) => updateInstallment(i, "amount", e.target.value)} />
                  <input type="date" className="input flex-1" value={inst.dueDate}
                    onChange={(e) => updateInstallment(i, "dueDate", e.target.value)} />
                  {installments.length > 1 && (
                    <button type="button" onClick={() => removeInstallmentRow(i)} className="text-red-600 text-xs">Remove</button>
                  )}
                </div>
              ))}
              <button type="button" onClick={addInstallmentRow} className="text-xs text-primary font-medium">+ Add installment</button>
            </div>
          )}

          <button type="submit" disabled={saving} className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-semibold disabled:opacity-50">
            {saving ? "Saving…" : "Save Fee Structure"}
          </button>
        </form>
      )}

      <div className="space-y-4">
        {fees.map((f) => (
          <div key={f.id} className="bg-white border border-gray-200 rounded-xl p-5">
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <div>
                <p className="font-semibold text-gray-800">{f.studentName}</p>
                <p className="text-xs text-gray-400">{f.studentEmail}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-400 uppercase font-semibold">{f.planType.replace("_", " ")}</p>
                <p className="text-sm font-bold text-gray-800">₹{f.paidAmount} / ₹{f.totalAmount}</p>
              </div>
            </div>
            <table className="w-full text-xs">
              <thead className="text-gray-400">
                <tr>
                  <th className="text-left py-1">#</th>
                  <th className="text-left py-1">Amount</th>
                  <th className="text-left py-1">Due</th>
                  <th className="text-left py-1">Status</th>
                  <th className="text-left py-1"></th>
                </tr>
              </thead>
              <tbody>
                {f.installments.map((inst) => (
                  <tr key={inst.id} className="border-t border-gray-50">
                    <td className="py-1.5">{inst.installmentNumber}</td>
                    <td className="py-1.5">₹{inst.amount}</td>
                    <td className="py-1.5">{inst.dueDate ? new Date(inst.dueDate).toLocaleDateString() : "—"}</td>
                    <td className="py-1.5">
                      <span className={`px-2 py-0.5 rounded-full font-semibold ${
                        inst.status === "paid" ? "bg-emerald-50 text-emerald-700" :
                        inst.status === "overdue" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700"
                      }`}>{inst.status}</span>
                    </td>
                    <td className="py-1.5">
                      {inst.status !== "paid" && (
                        <button onClick={() => markPaid(inst.id)} className="text-primary font-medium hover:underline">Mark paid</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
        {fees.length === 0 && <p className="text-sm text-gray-400">No fee structures created yet.</p>}
      </div>
    </div>
  );
}
