import React, { useEffect, useState } from "react";
import { PrimaryButton, ErrorBanner, SuccessBanner, extractErrorMessage } from "../../components/FormControls";
import { registrationApi } from "../../services/registrationApi";
import { Course, Batch } from "../../types";

export const BulkUploadPage: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ totalRows: number; successCount: number; failedCount: number; errors: string[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const [courses, setCourses] = useState<Course[]>([]);
  const [batchesByCourse, setBatchesByCourse] = useState<Record<string, Batch[]>>({});

  // Show what the CSV may actually reference. Without this the user has no way
  // to know which course/batch values are valid.
  useEffect(() => {
    registrationApi
      .listCourses()
      .then((res) => {
        setCourses(res.data);
        res.data.forEach((c) => {
          registrationApi
            .listBatches(c.id)
            .then((b) => setBatchesByCourse((prev) => ({ ...prev, [c.id]: b.data })))
            .catch(() => {});
        });
      })
      .catch(() => {});
  }, []);

  const downloadTemplate = () => {
    const first = courses[0];
    const firstBatch = first ? (batchesByCourse[first.id] || [])[0] : undefined;
    const sample = [
      "name,email,phone,course_id,batch_id",
      `Asha Kulkarni,asha@example.com,9876500001,${first?.code ?? "FSD-101"},${firstBatch?.name ?? "FSD-2026-Jan"}`,
    ].join("\n");
    const url = URL.createObjectURL(new Blob([sample], { type: "text/csv" }));
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "students_template.csv");
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;
    setError(null);
    setResult(null);
    setLoading(true);
    try {
      const { data } = await registrationApi.bulkUpload(file);
      setResult(data);
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const allFailed = result && result.totalRows > 0 && result.successCount === 0;

  return (
    <>
      <div className="mx-auto max-w-2xl">
        <h1 className="font-display text-2xl font-bold text-ink-900">Bulk register students</h1>
        <p className="mt-1 text-sm text-slate-500">
          Upload a CSV or Excel file. Required columns: <code>name</code>, <code>email</code>, <code>course_id</code>,{" "}
          <code>batch_id</code>. Optional: <code>phone</code>.
        </p>
        <p className="mt-1 text-sm text-slate-500">
          <code>course_id</code> accepts a course <strong>code</strong>, <strong>name</strong>, or id.{" "}
          <code>batch_id</code> accepts a batch <strong>name</strong> or id — you don't need to look up UUIDs.
        </p>

        {/* Reference table so the values in the sheet can be checked before uploading. */}
        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-ink-900">Accepted values</h2>
            <button type="button" onClick={downloadTemplate} className="text-xs font-medium text-brand-700 underline">
              Download CSV template
            </button>
          </div>
          {courses.length === 0 ? (
            <p className="mt-2 text-xs text-slate-500">
              No courses defined yet. Create a course and a batch first — students can't be registered without one.
            </p>
          ) : (
            <table className="mt-2 w-full text-xs">
              <thead className="text-left text-slate-500">
                <tr>
                  <th className="py-1">course_id (code or name)</th>
                  <th className="py-1">batch_id (name)</th>
                </tr>
              </thead>
              <tbody>
                {courses.map((c) => (
                  <tr key={c.id} className="border-t border-slate-200 align-top">
                    <td className="py-1.5 pr-3">
                      <code>{c.code}</code> <span className="text-slate-500">or</span> <code>{c.name}</code>
                    </td>
                    <td className="py-1.5">
                      {(batchesByCourse[c.id] || []).length === 0 ? (
                        <span className="text-slate-400">no batches yet</span>
                      ) : (
                        (batchesByCourse[c.id] || []).map((b) => (
                          <code key={b.id} className="mr-2 inline-block">
                            {b.name}
                          </code>
                        ))
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4 rounded-2xl border border-slate-200 bg-white p-6">
          <ErrorBanner message={error} />
          <input
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="block w-full rounded-lg border border-dashed border-slate-300 p-6 text-sm text-slate-500 file:mr-4 file:rounded-lg file:border-0 file:bg-brand-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-brand-700"
          />
          <PrimaryButton type="submit" disabled={!file || loading}>
            {loading ? (<span className="inline-flex items-center gap-2"><span className="w-3.5 h-3.5 border-2 border-white/70 border-t-transparent rounded-full animate-spin" /> Uploading…</span>) : "Upload and register"}
          </PrimaryButton>

          {result && (
            <div className="space-y-3">
              {/* A run where nothing succeeded is a failure, not a success. */}
              {allFailed ? (
                <ErrorBanner
                  message={`No students were registered — all ${result.totalRows} rows failed. Check the course_id and batch_id values against the table above.`}
                />
              ) : (
                <SuccessBanner
                  message={`Processed ${result.totalRows} rows: ${result.successCount} succeeded, ${result.failedCount} failed.`}
                />
              )}
              {result.errors.length > 0 && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3.5">
                  <p className="mb-1 text-sm font-semibold text-red-700">Row errors:</p>
                  <ul className="max-h-40 space-y-1 overflow-y-auto text-xs text-red-600">
                    {result.errors.map((e, i) => (
                      <li key={i}>{e}</li>
                    ))}
                  </ul>
                  {result.failedCount > result.errors.length && (
                    <p className="mt-1 text-xs text-red-500">
                      …and {result.failedCount - result.errors.length} more (first {result.errors.length} shown).
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </form>
      </div>
    </>
  );
};
