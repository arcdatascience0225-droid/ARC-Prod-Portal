import React, { useEffect, useState } from "react";
import ArcLoader from "../../components/ArcLoader";
import { hrApi } from "../../api/placementApi";
import { PlacementAnalytics } from "../../types/placement";

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="border border-gray-200 rounded-xl p-4 bg-white shadow-sm">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
    </div>
  );
}

export default function AnalyticsPage() {
  const [data, setData] = useState<PlacementAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    hrApi
      .getAnalytics()
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <ArcLoader />;
  if (!data) return <div className="p-6 text-gray-500">No data available.</div>;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Placement Analytics</h1>
        <a
          href={hrApi.exportApplicationsCsvUrl()}
          className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium"
        >
          Export CSV Report
        </a>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard label="Total Students" value={data.totalStudents} />
        <StatCard label="Applications" value={data.totalApplications} />
        <StatCard label="Interviews Conducted" value={data.totalInterviews} />
        <StatCard label="Offers Made" value={data.totalOffers} />
        <StatCard label="Students Placed" value={data.totalPlaced} />
        <StatCard label="Placement Rate" value={`${data.placementRatePercent}%`} />
        <StatCard
          label="Avg Salary Offered"
          value={data.avgSalaryOffered ? `₹${data.avgSalaryOffered.toLocaleString()}` : "—"}
        />
        <StatCard
          label="Highest Salary"
          value={data.highestSalaryOffered ? `₹${data.highestSalaryOffered.toLocaleString()}` : "—"}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="border border-gray-200 rounded-xl p-4 bg-white shadow-sm">
          <h2 className="font-semibold text-gray-800 mb-3">Application Status Funnel</h2>
          <div className="space-y-2">
            {Object.entries(data.statusFunnel).map(([status, count]) => (
              <div key={status} className="flex items-center gap-2">
                <span className="text-xs w-24 capitalize text-gray-600">{status}</span>
                <div className="flex-1 bg-gray-100 rounded-full h-3 overflow-hidden">
                  <div
                    className="bg-indigo-500 h-3"
                    style={{
                      width: `${Math.min(
                        100,
                        (count / Math.max(data.totalApplications, 1)) * 100
                      )}%`,
                    }}
                  />
                </div>
                <span className="text-xs text-gray-500 w-8 text-right">{count}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="border border-gray-200 rounded-xl p-4 bg-white shadow-sm">
          <h2 className="font-semibold text-gray-800 mb-3">Company-wise Hires</h2>
          {Object.keys(data.companyWiseHires).length === 0 ? (
            <p className="text-sm text-gray-500">No placements recorded yet.</p>
          ) : (
            <div className="space-y-2">
              {Object.entries(data.companyWiseHires).map(([company, count]) => (
                <div key={company} className="flex justify-between text-sm">
                  <span className="text-gray-700">{company}</span>
                  <span className="font-medium text-gray-900">{count}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
