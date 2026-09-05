import { useEffect, useRef, useState } from "react";

interface TimerProps {
  durationMinutes: number;
  startedAt: string;
  onExpire: () => void;
}

/**
 * The backend stores `started_at` via SQLite CURRENT_TIMESTAMP, which is UTC
 * but carries no timezone marker ("2026-07-23T14:42:04"). Per the ES spec a
 * date-time string without an offset is parsed as LOCAL time, so in IST the
 * clock started 5.5 hours in the past and the timer rendered 00:00 immediately
 * — and fired onExpire, auto-submitting the test. Treat a missing offset as UTC.
 */
export function parseServerTime(value: string): number {
  if (!value) return Date.now();
  const hasZone = /(?:Z|[+-]\d{2}:?\d{2})$/.test(value.trim());
  const normalised = value.trim().replace(" ", "T");
  return new Date(hasZone ? normalised : `${normalised}Z`).getTime();
}

export default function Timer({ durationMinutes, startedAt, onExpire }: TimerProps) {
  const expiredRef = useRef(false);
  const endTime = useRef(parseServerTime(startedAt) + durationMinutes * 60 * 1000);
  const [remainingMs, setRemainingMs] = useState(() => endTime.current - Date.now());

  useEffect(() => {
    const interval = setInterval(() => {
      const rem = endTime.current - Date.now();
      setRemainingMs(rem);
      if (rem <= 0 && !expiredRef.current) {
        expiredRef.current = true;
        clearInterval(interval);
        onExpire();
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [onExpire]);

  const totalSeconds = Math.max(0, Math.floor(remainingMs / 1000));
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  const isLow = totalSeconds <= 60;

  return (
    <div
      className={`px-4 py-2 rounded-lg font-mono text-lg font-semibold ${
        isLow ? "bg-red-100 text-red-700 animate-pulse" : "bg-primary/10 text-primary"
      }`}
    >
      {String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
    </div>
  );
}
