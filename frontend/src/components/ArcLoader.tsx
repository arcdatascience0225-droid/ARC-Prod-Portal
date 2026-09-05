/** Branded loading state — used anywhere a page waits on a slow API call,
 * instead of a bare "Loading..." string. */
export default function ArcLoader({ label = "Loading" }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-20 text-gray-400">
      <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center animate-pulse">
        <span className="text-primary font-black text-lg tracking-tight">ARC</span>
      </div>
      <div className="flex items-center gap-2 text-sm">
        <span className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: "0ms" }} />
        <span className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: "150ms" }} />
        <span className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: "300ms" }} />
        <span className="ml-1">{label}…</span>
      </div>
    </div>
  );
}
