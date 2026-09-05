import React, { useEffect, useState } from "react";
import ArcLoader from "../../../components/ArcLoader";
import { studentJobsApi } from "../../../api/placementApi";
import { Offer } from "../../../types/placement";
import StatusBadge from "../../../components/StatusBadge";

export default function StudentOffersPage() {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    const data = await studentJobsApi.myOffers();
    setOffers(data);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const respond = async (offerId: string, status: "accepted" | "declined") => {
    setRespondingId(offerId);
    setError("");
    try {
      await studentJobsApi.respondToOffer(offerId, status);
      load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setRespondingId(null);
    }
  };

  if (loading) return <ArcLoader />;

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">My Offers</h1>

      {error && <p className="text-red-600 text-sm mb-4">{error}</p>}

      <div className="space-y-4">
        {offers.map((o) => (
          <div key={o.id} className="border border-gray-200 rounded-xl p-5 bg-white shadow-sm">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-semibold text-gray-900">{o.designation}</h3>
                <p className="text-sm text-gray-500">{o.location || "Location not specified"}</p>
              </div>
              <StatusBadge status={o.status} />
            </div>
            <div className="grid grid-cols-2 gap-3 mt-3 text-sm">
              <div>
                <p className="text-xs text-gray-500">Salary Offered</p>
                <p className="font-medium text-gray-900">₹{o.salaryOffered.toLocaleString()} / year</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Joining Date</p>
                <p className="font-medium text-gray-900">
                  {o.joiningDate ? new Date(o.joiningDate).toLocaleDateString() : "TBD"}
                </p>
              </div>
            </div>
            {o.offerLetterUrl && (
              <a
                href={o.offerLetterUrl}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-indigo-600 hover:underline mt-2 inline-block"
              >
                View Offer Letter
              </a>
            )}
            {o.status === "pending" && (
              <div className="flex gap-2 mt-4">
                <button
                  onClick={() => respond(o.id, "accepted")}
                  disabled={respondingId === o.id}
                  className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-4 py-1.5 rounded-lg text-sm font-medium"
                >
                  Accept Offer
                </button>
                <button
                  onClick={() => respond(o.id, "declined")}
                  disabled={respondingId === o.id}
                  className="bg-gray-100 hover:bg-gray-200 disabled:opacity-50 text-gray-700 px-4 py-1.5 rounded-lg text-sm font-medium"
                >
                  Decline
                </button>
              </div>
            )}
          </div>
        ))}
        {offers.length === 0 && <p className="text-gray-500">No offers yet. Keep applying!</p>}
      </div>
    </div>
  );
}
