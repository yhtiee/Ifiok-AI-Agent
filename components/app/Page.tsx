import { CaretRightIcon } from "@phosphor-icons/react/ssr";
import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

// Building blocks inside app pages (the page frame itself is AppPage). Layout is full width beside
// the sidebar: no centred narrow column. Lists are rows divided by --line, not cards
// (specifications/design/app-overhaul.md §2, §5.0).

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
    <section className={cn("rounded-[var(--radius-card)] border border-line bg-surface", className)}>
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
export function EmptyState({
  title,
  body,
  action,
  as: Heading = "h2",
}: {
  title: ReactNode;
  body: ReactNode;
  action?: ReactNode;
  as?: "h2" | "h3";
}) {
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
      <Heading className="text-lg font-semibold">{title}</Heading>
      <p className="max-w-[52ch] text-base text-ink-2">{body}</p>
      {action ? <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-2">{action}</div> : null}
    </div>
  );
}

/** A section heading over a plain list (no panel border around it). */
export function SectionHeading({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <h2 id={id} className="text-base font-semibold">
      {children}
    </h2>
  );
}

/** The one list style: full-width rows divided by 1 px --line. */
export function RowList({
  label,
  labelledBy,
  className,
  children,
}: {
  label?: string;
  labelledBy?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <ul
      aria-label={label}
      aria-labelledby={labelledBy}
      className={cn("divide-y divide-line border-y border-line", className)}
    >
      {children}
    </ul>
  );
}

const DISC = {
  course: "bg-quantity-soft text-quantity",
  topic: "bg-built-soft text-built",
  add: "bg-change-soft text-change",
  plain: "bg-paper text-ink-2",
} as const;
export type RowTone = keyof typeof DISC;

/** A 40 px icon disc: blue for courses, green for topics, camwood-soft for "add". */
export function IconDisc({ tone, children }: { tone: RowTone; children: ReactNode }) {
  return (
    <span
      aria-hidden="true"
      className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-full", DISC[tone])}
    >
      {children}
    </span>
  );
}

type RowProps = {
  title: ReactNode;
  meta?: ReactNode;
  icon?: ReactNode;
  tone?: RowTone;
  /** The row opens this page. */
  href?: string;
  /** Or runs this (client components only). */
  onClick?: () => void;
  busy?: boolean;
  disabled?: boolean;
  /** A control at the end of the row (Join, Delete); replaces the caret. */
  trailing?: ReactNode;
};

/** One row: a link or button (≥ 56 px) with an icon disc, a title, a meta line and a caret. */
export function Row({ title, meta, icon, tone = "course", href, onClick, busy, disabled, trailing }: RowProps) {
  const body = (
    <>
      {icon ? <IconDisc tone={tone}>{icon}</IconDisc> : null}
      <span className="grid min-w-0 flex-1 gap-0.5">
        <span className="text-base font-semibold [overflow-wrap:anywhere] group-hover:underline">{title}</span>
        {meta ? <span className="text-sm text-ink-2">{meta}</span> : null}
      </span>
    </>
  );
  const caret = <CaretRightIcon size={18} className="shrink-0 text-ink-2" aria-hidden="true" />;
  const target = "flex min-h-14 min-w-0 flex-1 items-center gap-3 py-2 text-left";

  return (
    <li className="flex items-center gap-2">
      {href ? (
        <Link href={href} className={cn(target, "group")}>
          {body}
          {trailing ? null : caret}
        </Link>
      ) : onClick ? (
        <button
          type="button"
          onClick={onClick}
          disabled={disabled || busy}
          aria-busy={busy || undefined}
          className={cn(target, "group disabled:cursor-wait disabled:opacity-70")}
        >
          {body}
          {trailing ? null : caret}
        </button>
      ) : (
        <div className={target}>{body}</div>
      )}
      {trailing ? <span className="shrink-0">{trailing}</span> : null}
    </li>
  );
}

/**
 * Where a view's one camwood button lives (app-overhaul §5.0). Phones: a bar pinned above the tab
 * bar (or to the bottom of the screen where the tab bar is hidden, `over="screen"`), full-width
 * buttons, 16 px gutters. Desktop: inline, where it sits in the page.
 */
export function ActionBar({
  children,
  over = "nav",
  className,
}: {
  children: ReactNode;
  over?: "nav" | "screen";
  className?: string;
}) {
  return (
    <div
      data-action-bar=""
      className={cn(
        "fixed inset-x-0 z-10 flex gap-3 border-t border-line bg-surface px-4 py-3 *:flex-1 sm:px-6",
        over === "nav"
          ? "bottom-[calc(4rem+env(safe-area-inset-bottom))]"
          : "bottom-0 pb-[calc(0.75rem+env(safe-area-inset-bottom))]",
        "lg:static lg:z-auto lg:border-0 lg:bg-transparent lg:p-0 lg:*:flex-none print:hidden",
        className,
      )}
    >
      {children}
    </div>
  );
}
