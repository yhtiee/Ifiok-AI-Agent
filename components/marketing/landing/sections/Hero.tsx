import { TangentDot } from "../../demos/TangentDot";
import { H1 } from "../copy";
import { PrimaryCta } from "../parts";

// 04 §5.1, 05 §4.1. The H1 is the LCP; the demo's server render is its resting frame.
export function Hero({ lead }: { lead: string }) {
  return (
    <section id="top" className="lp-hero lp-band-surface" aria-labelledby="hero-h">
      <div className="lp-wrap lp-hero-grid">
        <div>
          <h1 id="hero-h">{H1}</h1>
          <p className="lp-lead">{lead}</p>
          <PrimaryCta id="hero-cta" />
        </div>
        <div>
          <p className="lp-demo-label">Try it: drag the point</p>
          <TangentDot />
          <p className="lp-demo-caption">
            The steepness of y = x² at the point you choose. Drag it, or use the slider.
          </p>
          <p className="lp-demo-foot">This is one screen of a real Ifiok lesson.</p>
        </div>
      </div>
    </section>
  );
}
