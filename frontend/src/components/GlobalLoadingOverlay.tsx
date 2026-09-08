import { useEffect, useState } from "react";
import { subscribeToLoading } from "../services/api";

/** Mounted once, near the root. Shows a small ARC-branded indicator
 * automatically whenever any API request is in flight — no per-page or
 * per-button wiring needed. A short delay avoids flashing on instant
 * requests; anything slower than that (which is exactly the case that
 * confused users into double-clicking) gets a clear "this is working"
 * signal. */
export default function GlobalLoadingOverlay() {
  const [active, setActive] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    return subscribeToLoading(setActive);
  }, []);

  useEffect(() => {
    if (active) {
      const t = setTimeout(() => setVisible(true), 350);
      return () => clearTimeout(t);
    }
    setVisible(false);
  }, [active]);

  if (!visible) return null;

  return (
    <div className="fixed bottom-5 right-5 z-[999] flex items-center gap-2.5 rounded-full bg-ink-900/95 px-4 py-2.5 shadow-xl backdrop-blur dark:bg-slate-800/95">
      <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-brand-500">
        <span className="text-[8px] font-black text-white">ARC</span>
      </div>
      <div className="flex items-center gap-1">
        <span className="h-1.5 w-1.5 rounded-full bg-brand-400 animate-bounce" style={{ animationDelay: "0ms" }} />
        <span className="h-1.5 w-1.5 rounded-full bg-brand-400 animate-bounce" style={{ animationDelay: "150ms" }} />
        <span className="h-1.5 w-1.5 rounded-full bg-brand-400 animate-bounce" style={{ animationDelay: "300ms" }} />
      </div>
      <span className="text-xs font-medium text-white">Working…</span>
    </div>
  );
}
