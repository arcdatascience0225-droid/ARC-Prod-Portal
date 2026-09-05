import React from "react";

const STATUS_STYLES: Record<string, string> = {
  applied: "bg-blue-100 text-blue-700",
  shortlisted: "bg-indigo-100 text-indigo-700",
  interview: "bg-amber-100 text-amber-700",
  offer: "bg-purple-100 text-purple-700",
  rejected: "bg-red-100 text-red-700",
  placed: "bg-green-100 text-green-700",
  withdrawn: "bg-gray-100 text-gray-600",
  open: "bg-green-100 text-green-700",
  closed: "bg-gray-100 text-gray-600",
  on_hold: "bg-amber-100 text-amber-700",
  scheduled: "bg-blue-100 text-blue-700",
  completed: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
  no_show: "bg-red-100 text-red-700",
  pending: "bg-amber-100 text-amber-700",
  accepted: "bg-green-100 text-green-700",
  declined: "bg-red-100 text-red-700",
};

export default function StatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLES[status] || "bg-gray-100 text-gray-600";
  const label = status.replace(/_/g, " ");
  return (
    <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium capitalize ${style}`}>
      {label}
    </span>
  );
}
