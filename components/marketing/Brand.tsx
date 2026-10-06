// Brand marks (specifications/07-brand-ui-ux.md §3.1–§3.2). Placeholders until the designer's final logo.

/** Lowercase wordmark "ifiok"; the tittle of the first i is a camwood dot. */
export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span
      role="img"
      aria-label="Ifiok"
      className={`inline-flex items-baseline font-display font-extrabold leading-none tracking-tight ${className}`}
    >
      <span aria-hidden="true" className="relative inline-block">
        {"ı"}
        <span className="absolute left-1/2 top-[0.02em] h-[0.2em] w-[0.2em] -translate-x-1/2 rounded-full bg-change" />
      </span>
      <span aria-hidden="true">fiok</span>
    </span>
  );
}

const LOOP_STEPS = ["Read", "Plan", "Teach", "Check", "Adapt"] as const;

/** The agent loop: five dots on an inked ring (read, plan, teach, check, adapt). */
export function AgentLoopMark({ size = 120, active = 2 }: { size?: number; active?: number }) {
  const c = 60;
  const r = 44;
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" aria-hidden="true">
      <path
        d="M60 16 C 85 15, 105 34, 104 60 C 104 86, 84 105, 59 104 C 34 104, 15 85, 16 59 C 17 35, 36 16, 60 16 Z"
        fill="none"
        stroke="var(--ink)"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      {LOOP_STEPS.map((_, i) => {
        const t = -Math.PI / 2 + (i * 2 * Math.PI) / LOOP_STEPS.length;
        return (
          <circle
            key={i}
            cx={c + r * Math.cos(t)}
            cy={c + r * Math.sin(t)}
            r={i === active ? 7 : 5.5}
            fill={i === active ? "var(--change)" : i < active ? "var(--built)" : "var(--surface)"}
            stroke={i === active ? "var(--change)" : i < active ? "var(--built)" : "var(--ink)"}
            strokeWidth="2"
          />
        );
      })}
    </svg>
  );
}

/**
 * A short vertical Ink Line segment for list spines: one slightly uneven brush stroke.
 * `state` colours it: built (green, done), next (camwood), ink (not yet).
 */
export function InkStroke({ state = "ink" }: { state?: "built" | "next" | "ink" }) {
  const stroke = state === "built" ? "var(--built)" : state === "next" ? "var(--change)" : "var(--ink-3)";
  return (
    <svg
      viewBox="0 0 12 100"
      preserveAspectRatio="none"
      className="absolute left-[11px] top-7 h-[calc(100%-4px)] w-3"
      aria-hidden="true"
    >
      <path
        d="M6 0 C 4.6 22, 7.4 40, 5.6 58 C 4.4 74, 7 88, 6 100"
        fill="none"
        stroke={stroke}
        strokeWidth="2.6"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
