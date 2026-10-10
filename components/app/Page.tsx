import type { ReactNode } from "react";

// Building blocks for app pages. Layout is full width beside the sidebar: no centred narrow
// column. Content is capped only at very wide sizes, and stays left-aligned.

export function PageHeader({
  title,
  eyebrow,
  description,
  actions,
}: {
  title: ReactNode;
  /** Small line above the title, sentence case (e.g. the date). */
  eyebrow?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4 lg:mb-8">
      <div className="min-w-0">
        {eyebrow ? <p className="text-sm text-ink-2">{eyebrow}</p> : null}
        <h1 className="font-display text-[1.75rem] leading-tight font-semibold lg:text-[2rem]">{title}</h1>
        {description ? <p className="mt-1 max-w-[60ch] text-base text-ink-2">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

/** Page body: wide layouts use the space; the cap only stops lines getting absurdly long on huge screens. */
export function PageBody({ children }: { children: ReactNode }) {
  return <div className="w-full max-w-[90rem]">{children}</div>;
}

/** A bordered section of a page (no shadow, 07 §3.3). Never nest panels inside panels. */
export function Panel({
  title,
  action,
  children,
  className = "",
}: {
  title?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-[var(--radius-card)] border border-line bg-surface ${className}`}>
      {title ? (
        <div className="flex min-h-12 items-center justify-between gap-3 border-b border-line px-4 py-2 sm:px-5">
          <h2 className="text-base font-semibold">{title}</h2>
          {action}
        </div>
      ) : null}
      <div className="px-4 py-4 sm:px-5">{children}</div>
    </section>
  );
}

/** Empty state: the Ink Line drawing a short stroke, one sentence, at most one action (07 §3.3). */
export function EmptyState({ title, body, action }: { title: ReactNode; body: ReactNode; action?: ReactNode }) {
  return (
    <div className="grid justify-items-start gap-3 py-4">
      <svg width="132" height="32" viewBox="0 0 132 32" aria-hidden="true">
        <path
          d="M4 22 C 24 17, 42 24, 64 16 C 82 10, 100 18, 122 11"
          fill="none"
          stroke="var(--built)"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <circle cx="122" cy="11" r="5.5" fill="var(--surface)" stroke="var(--change)" strokeWidth="3" />
      </svg>
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="max-w-[52ch] text-base text-ink-2">{body}</p>
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}
