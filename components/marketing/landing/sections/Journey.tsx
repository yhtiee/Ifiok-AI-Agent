import type { ReactNode } from "react";
import { JourneyList } from "../../illustrations/JourneyDot";
import type { JourneyStep } from "../copy";
import { Badges } from "../parts";

// 04 §5.2, 05 §4.2: five full-width rows on one Ink Line, status from lib/features.ts.

const NODE_GLYPH: Record<JourneyStep["id"], { fill: string; glyph: ReactNode }> = {
  learn: {
    fill: "var(--path-learn)",
    glyph: (
      <path d="M14 24 Q24 46 34 24" fill="none" stroke="var(--ill-white)" strokeWidth="2.5" strokeLinecap="round" />
    ),
  },
  prepare: {
    fill: "var(--path-prepare)",
    glyph: (
      <>
        <rect
          x="16"
          y="22"
          width="13"
          height="16"
          rx="1.5"
          fill="var(--ill-white)"
          stroke="var(--ill-line)"
          strokeWidth="2"
        />
        <rect
          x="20"
          y="19"
          width="13"
          height="16"
          rx="1.5"
          fill="var(--ill-white)"
          stroke="var(--ill-line)"
          strokeWidth="2"
        />
      </>
    ),
  },
  contribute: {
    fill: "var(--path-contribute)",
    glyph: (
      <>
        <rect
          x="17"
          y="21"
          width="14"
          height="18"
          rx="2"
          fill="var(--ill-white)"
          stroke="var(--ill-line)"
          strokeWidth="2"
        />
        <path d="M20 27 H28 M20 31 H26" stroke="var(--ill-line)" strokeWidth="1.8" strokeLinecap="round" />
      </>
    ),
  },
  teach: {
    fill: "var(--path-teach)",
    glyph: (
      <path
        d="M15 23 h18 a2 2 0 0 1 2 2 v8 a2 2 0 0 1 -2 2 h-10 l-5 4 v-4 h-3 a2 2 0 0 1 -2 -2 v-8 a2 2 0 0 1 2 -2z"
        fill="var(--ill-white)"
        stroke="var(--ill-line)"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    ),
  },
  earn: {
    fill: "var(--path-earn)",
    glyph: (
      <>
        <path
          d="M14 27 H34 C34 39 14 39 14 27Z"
          fill="var(--ill-white)"
          stroke="var(--ill-line)"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <path d="M17 31 l3 -2 l3 2 l3 -2 l3 2 l3 -2" fill="none" stroke="var(--ill-line)" strokeWidth="1.5" />
      </>
    ),
  },
};

export function Journey({ steps }: { steps: JourneyStep[] }) {
  return (
    <section id="journey" className="lp-band-paper" aria-labelledby="journey-h">
      <div className="lp-wrap">
        <h2 className="lp-h2" id="journey-h">
          From your first lesson to getting paid for what you know
        </h2>
        <p className="lp-lead">
          Five steps, in the order most students take them. Anyone can teach and earn from what they know; most students
          start by learning.
        </p>
        <JourneyList>
          <ol className="lp-jrows">
            {steps.map((s, i) => {
              const node = NODE_GLYPH[s.id];
              return (
                <li key={s.id} className="lp-jrow" data-step={i}>
                  <span className="lp-jnode" aria-hidden="true">
                    <svg viewBox="0 0 48 48">
                      <circle cx="24" cy="30" r="17" fill={node.fill} stroke="var(--ill-line)" strokeWidth="2.5" />
                      {node.glyph}
                    </svg>
                  </span>
                  <div>
                    <p className="lp-jlabel">Step {s.step}</p>
                    <h3>{s.title}</h3>
                    <p className="lp-jfor">For: {s.forWho}</p>
                  </div>
                  <p className="lp-jline">{s.line}</p>
                  <div className="lp-jside">
                    <Badges badges={s.badges} className="lp-jstatus" />
                    <a className="lp-link lp-link-row lp-jlink" href={s.link.href}>
                      {s.link.text}
                    </a>
                  </div>
                </li>
              );
            })}
          </ol>
        </JourneyList>
        <p className="lp-open-now-line">
          <b>Open now:</b> find or create your course, add the outline (snap it, type it, or let Ifiok draft one for you
          to check) and open shared lessons for any topic.
        </p>
      </div>
    </section>
  );
}
