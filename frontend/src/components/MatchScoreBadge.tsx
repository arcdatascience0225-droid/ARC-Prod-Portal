import React from "react";

export default function MatchScoreBadge({ score }: { score: number }) {
  let color = "bg-red-100 text-red-700";
  if (score >= 80) color = "bg-green-100 text-green-700";
  else if (score >= 60) color = "bg-amber-100 text-amber-700";
  else if (score >= 40) color = "bg-orange-100 text-orange-700";

  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${color}`}>
      {score.toFixed(1)}% match
    </span>
  );
}
