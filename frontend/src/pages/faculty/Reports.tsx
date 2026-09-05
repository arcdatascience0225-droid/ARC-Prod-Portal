import { useEffect, useState } from "react";
import { getMyBatches, downloadBatchReport } from "../../api/facultyApi";
import { FacultyBatch } from "../../types";

export default function ReportsPage() {
  const [batches, setBatches] = useState<FacultyBatch[]>([]);
  const [batchId, setBatchId] = useState("");
  const [downloading, setDownloading] = useState<"excel" | "pdf" | null>(null);

  useEffect(() => {
    getMyBatches().then(setBatches);
  }, []);

  const download = async (format: "excel" | "pdf") => {
    if (!batchId) return;
    setDownloading(format);
    await downloadBatchReport(batchId, format);
    setDownloading(null);
  };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-semibold text-slate-800 mb-6">Export Reports</h1>

      <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-4">
        <select
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
          value={batchId}
          onChange={(e) => setBatchId(e.target.value)}
        >
          <option value="">Select batch</option>
          {batches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>

        <div className="flex gap-3">
          <button
            onClick={() => download("excel")}
            disabled={!batchId || downloading === "excel"}
            className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50"
          >
            {downloading === "excel" ? "Preparing…" : "Download Excel"}
          </button>
          <button
            onClick={() => download("pdf")}
            disabled={!batchId || downloading === "pdf"}
            className="bg-rose-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-rose-700 disabled:opacity-50"
          >
            {downloading === "pdf" ? "Preparing…" : "Download PDF"}
          </button>
        </div>
      </div>
    </div>
  );
}
