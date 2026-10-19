// Trust, Pricing, FAQ, final call to action and footer (specifications/landing/04 §5.8–§5.13, 05 §4.8–§4.11).
import { EngineScene } from "../../illustrations/EngineScene";
import { DotHome } from "../../illustrations/DotHome";
import { NAME_MEANING, SIGN_IN_HREF, SIGN_UP_HREF, type FaqGroups, type FaqItem, type LandingCopy } from "../copy";
import { LandingWordmark, PrimaryCta } from "../parts";

const REPO = "https://github.com/yhtiee/Ifiok-AI-Agent";

export function Trust({ copy }: { copy: LandingCopy }) {
  const rows = [
    {
      t: "The maths engine has the last word",
      p: "Every number you see comes from a maths engine, not the AI's memory. A lesson whose maths doesn't check out isn't published, and a practice question whose answer disagrees with the engine is dropped.",
    },
    {
      t: "You can see where it came from",
      p: "Explanations cite their source. Anything not from a source says so, and marks from AI are labelled estimates.",
    },
    {
      t: "Students can flag a wrong step",
      p: "Every block in a lesson has a flag. Lessons in medicine, nursing, pharmacy and law are checked by a person before anyone sees them.",
    },
    { t: "Your files stay yours", p: copy.trust.files },
    {
      t: "Light on your data",
      p: "Ifiok runs in your phone's browser; there's nothing to install. Lessons are small data files, not video.",
    },
  ];
  return (
    <section id="trust" className="lp-bench-band" aria-labelledby="trust-h">
      <div className="lp-wrap lp-trust-grid">
        <div>
          <h2 className="lp-h2" id="trust-h">
            Every number is computed, not guessed
          </h2>
          <p className="lp-lead">
            AI is good at explaining and bad at arithmetic, so Ifiok doesn&apos;t let it do the maths.
          </p>
          <ul className="lp-trust-rows">
            {rows.map((r) => (
              <li key={r.t}>
                <h3>{r.t}</h3>
                <p>{r.p}</p>
              </li>
            ))}
            {copy.trust.codePublic ? (
              <li>
                <h3>The code is public</h3>
                <p>
                  Ifiok&apos;s code is public on GitHub, so anyone can read how lessons are checked, how AI calls are
                  budgeted and how pay is worked out.{" "}
                  <a className="lp-link" href={REPO}>
                    See the code on GitHub →
                  </a>
                </p>
              </li>
            ) : null}
          </ul>
          <p style={{ marginTop: 8 }}>
            <a className="lp-link lp-link-row" href="/ai">
              Read how Ifiok uses AI
            </a>
          </p>
        </div>
        <div className="lp-trust-side">
          <EngineScene />
        </div>
      </div>
    </section>
  );
}

export function Pricing({ copy }: { copy: LandingCopy }) {
  return (
    <section id="pricing" className="lp-band-surface" aria-labelledby="pricing-h">
      <div className="lp-wrap">
        <h2 className="lp-h2" id="pricing-h">
          Free to learn. Plus for ₦500 a month.
        </h2>
        <p className="lp-lead">{copy.pricing.lead}</p>
        <table className="lp-price-table">
          <caption className="lp-sr">What each plan includes</caption>
          <thead>
            <tr>
              <td />
              <th scope="col">
                Free<small>₦0, for good</small>
              </th>
              <th scope="col" className="lp-plus-col">
                Ifiok Plus<small>₦500 a month or ₦1,500 a semester</small>
              </th>
              <th scope="col">
                Units for extras<small>From ₦500</small>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr className="lp-price-row-mobile">
              <th scope="row">Price</th>
              <td data-label="Free">₦0, for good</td>
              <td data-label="Plus" className="lp-plus-col">
                ₦500 a month or ₦1,500 a semester
              </td>
              <td data-label="Units">From ₦500</td>
            </tr>
            {copy.pricing.rows.map((r) => (
              <tr key={r.feature}>
                <th scope="row">{r.feature}</th>
                <td data-label="Free">{r.free}</td>
                <td data-label="Plus" className="lp-plus-col">
                  {r.plus}
                </td>
                <td data-label="Units" className={r.no ? "lp-no" : undefined}>
                  {r.units}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="lp-price-foot">
          <p className="lp-topup">
            Top up from ₦500: ₦500 → 50 Units · ₦1,000 → 105 Units · ₦2,000 → 220 Units. Units you buy never expire.
            Units pay for extras inside Ifiok; they can&apos;t be cashed out or transferred.
          </p>
          <p>
            Exact allowances are shown in the app and may change. · Units you earn last 90 days. · Prices include any
            tax that applies.
          </p>
        </div>
      </div>
    </section>
  );
}

function FaqList({ items }: { items: FaqItem[] }) {
  return (
    <div className="lp-faq-list">
      {items.map((it) => (
        <details key={it.q}>
          <summary>{it.q}</summary>
          <p>{it.a}</p>
        </details>
      ))}
    </div>
  );
}

export function Faq({ groups }: { groups: FaqGroups }) {
  return (
    <section id="faq" className="lp-band-paper" aria-labelledby="faq-h">
      <div className="lp-wrap lp-faq-grid">
        <div className="lp-faq-head">
          <h2 className="lp-h2" id="faq-h">
            Questions students ask
          </h2>
        </div>
        <div>
          <FaqList items={groups.main} />
          {groups.judges.length ? (
            <>
              <p className="lp-faq-group">For judges and developers</p>
              <FaqList items={groups.judges} />
            </>
          ) : null}
        </div>
      </div>
    </section>
  );
}

export function FinalCta() {
  return (
    <section id="start" className="lp-band-surface" aria-labelledby="start-h">
      <div className="lp-wrap lp-final-grid">
        <div>
          <h2 className="lp-h2" id="start-h">
            Start with one topic tonight
          </h2>
          <p className="lp-lead">
            Type a topic or find your course. If another student has opened it before, your lesson is ready at once; if
            it&apos;s new, it takes about a minute.
          </p>
          <PrimaryCta />
        </div>
        <DotHome />
      </div>
    </section>
  );
}

export function Footer({ privacyEmail, codePublic }: { privacyEmail: string | null; codePublic: boolean }) {
  const links: [string, string][] = [
    ["Create account", SIGN_UP_HREF],
    ["Sign in", SIGN_IN_HREF],
    ["Terms of use", "/terms"],
    ["Privacy notice", "/privacy"],
    ["How Ifiok uses AI", "/ai"],
  ];
  if (privacyEmail) links.push(["Privacy questions", `mailto:${privacyEmail}`]);
  if (codePublic) links.push(["Code on GitHub", REPO]);
  return (
    <footer className="lp-footer">
      <div className="lp-wrap">
        <div className="lp-footer-grid">
          <div>
            <span role="img" aria-label="Ifiok">
              <LandingWordmark />
            </span>
            <p className="lp-meaning">{NAME_MEANING}</p>
            <p className="lp-tagline">See it. Try it. Master it.</p>
            <p className="lp-disclaimer">
              Ifiok is an AI and it can be wrong. Numbers are checked by a maths engine; marks are estimates.
            </p>
          </div>
          <nav aria-label="Footer">
            <ul className="lp-footer-links">
              {links.map(([label, href]) => (
                <li key={label}>
                  <a href={href}>{label}</a>
                </li>
              ))}
            </ul>
          </nav>
        </div>
        <div className="lp-footer-legal">
          <span>© 2026 Ifiok</span>
        </div>
      </div>
    </footer>
  );
}
