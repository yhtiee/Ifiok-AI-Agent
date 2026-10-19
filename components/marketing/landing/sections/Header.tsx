import { SIGN_IN_HREF, SIGN_UP_HREF } from "../copy";
import { LandingWordmark } from "../parts";

// 04 §5.0, 05 §4.0. Never camwood in the header: "Start free" is the outline secondary.
export function Header() {
  return (
    <header className="lp-header">
      <div className="lp-wrap">
        <a className="lp-brand" href="#top" aria-label="Ifiok, back to top">
          <LandingWordmark />
          <span className="lp-descriptor" aria-hidden="true">
            the AI learning agent
          </span>
        </a>
        <nav className="lp-nav" aria-label="Page sections">
          <a href="#learn">Learn</a>
          <a href="#prepare">Exam prep</a>
          <a href="#earn">Earn</a>
          <a href="#pricing">Pricing</a>
        </nav>
        <div className="lp-header-actions">
          <a className="lp-signin" href={SIGN_IN_HREF}>
            Sign in
          </a>
          <a className="lp-btn-outline" href={SIGN_UP_HREF}>
            Start free
          </a>
        </div>
      </div>
    </header>
  );
}
