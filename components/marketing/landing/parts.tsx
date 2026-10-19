// Server building blocks for the landing page (specifications/landing/05 §4–§6).
import type { CSSProperties, ReactNode } from "react";
import { InkLine, type PathId } from "../illustrations/parts";
import { SIGN_IN_HREF, SIGN_UP_HREF, UNDER_CTA, type Badge, type Item } from "./copy";

export function StatusBadge({ badge }: { badge: Badge }) {
  return (
    <span className="lp-badge" data-status={badge.status}>
      {badge.label}
    </span>
  );
}

export function Badges({ badges, className = "" }: { badges: Badge[]; className?: string }) {
  return (
    <div className={`lp-badges ${className}`}>
      {badges.map((b) => (
        <StatusBadge key={b.label} badge={b} />
      ))}
    </div>
  );
}

/** Lowercase wordmark; the tittle of the first i is Dot (camwood). Decorative text inside a labelled parent. */
export function LandingWordmark() {
  return (
    <span className="lp-wordmark" aria-hidden="true">
      <span className="lp-i">ı</span>fiok
    </span>
  );
}

/** The primary action plus its two reassurance lines (04 §5.1, §5.11). */
export function PrimaryCta({ id }: { id?: string }) {
  return (
    <div className="lp-cta">
      <a className="lp-btn-primary" id={id} href={SIGN_UP_HREF}>
        Start learning free
      </a>
      <p className="lp-under-cta">
        {UNDER_CTA}
        <br />
        Already have an account? <a href={SIGN_IN_HREF}>Sign in</a>
      </p>
    </div>
  );
}

const PATH_COLOUR: Record<PathId, string> = {
  learn: "var(--path-learn)",
  prepare: "var(--path-prepare)",
  contribute: "var(--path-contribute)",
  teach: "var(--path-teach)",
  earn: "var(--path-earn)",
};
const PATH_NAME: Record<PathId, string> = {
  learn: "Learn",
  prepare: "Prepare",
  contribute: "Contribute",
  teach: "Teach",
  earn: "Earn",
};
const PATH_STEP: Record<PathId, number> = { learn: 1, prepare: 2, contribute: 3, teach: 4, earn: 5 };

/** Path sections 3–7: rail (desktop) | head then items | sticky stage. */
export function PathSection({
  path,
  band,
  title,
  afterTitle,
  lead,
  stage,
  children,
  below,
}: {
  path: PathId;
  band: "paper" | "surface";
  title: string;
  afterTitle?: ReactNode;
  lead: string;
  stage: ReactNode;
  children?: ReactNode;
  below?: ReactNode;
}) {
  const step = PATH_STEP[path];
  const headingId = `${path}-h`;
  const grid = (
    <div className="lp-path-grid">
      <div className="lp-rail" aria-hidden="true">
        <InkLine variant="rail" seed={step - 1} />
        <svg className="lp-rnode" viewBox="0 0 48 48">
          <circle cx="24" cy="24" r="15" fill={PATH_COLOUR[path]} stroke="var(--ill-line)" strokeWidth="2.5" />
        </svg>
      </div>
      <div className="lp-path-head">
        <p className="lp-step" style={{ "--lp-pc": PATH_COLOUR[path] } as CSSProperties}>
          <span className="lp-pip" aria-hidden="true" />
          Step {step} · {PATH_NAME[path]}
        </p>
        <h2 className="lp-h2" id={headingId}>
          {title}
        </h2>
        {afterTitle}
        <p className="lp-lead">{lead}</p>
      </div>
      <div className="lp-path-stage">{stage}</div>
      {children ? <div className="lp-path-items">{children}</div> : null}
    </div>
  );
  return (
    <section
      id={path}
      className={`lp-path lp-band-${band}`}
      aria-labelledby={headingId}
      data-first={step === 1 ? "" : undefined}
      data-last={step === 5 ? "" : undefined}
    >
      <div className="lp-wrap">
        {grid}
        {below}
      </div>
    </section>
  );
}

export function Items({ items, children }: { items: Item[]; children?: ReactNode }) {
  return (
    <ul className="lp-items">
      {items.map((it) => (
        <PathItem key={it.title} title={it.title} badge={it.badge}>
          <p>{it.body}</p>
        </PathItem>
      ))}
      {children}
    </ul>
  );
}

export function PathItem({ title, badge, children }: { title: string; badge?: Badge; children: ReactNode }) {
  return (
    <li>
      <div className="lp-item-head">
        <h3>{title}</h3>
        {badge ? <StatusBadge badge={badge} /> : null}
      </div>
      {children}
    </li>
  );
}
