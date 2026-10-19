// Brand marks (specifications/07-brand-ui-ux.md §3.1–§3.2). Placeholders until the designer's final logo.

/** Lowercase wordmark "ifiok"; the tittle of the first i is a camwood dot. */
export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span
      role="img"
      aria-label="Ifiok"
      className={`inline-flex items-baseline font-display leading-none font-extrabold tracking-tight ${className}`}
    >
      <span aria-hidden="true" className="relative inline-block">
        {"ı"}
        <span className="absolute top-[0.02em] left-1/2 h-[0.2em] w-[0.2em] -translate-x-1/2 rounded-full bg-change" />
      </span>
      <span aria-hidden="true">fiok</span>
    </span>
  );
}
