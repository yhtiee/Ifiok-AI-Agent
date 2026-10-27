// Path sections 3–7 (specifications/landing/04 §5.3–§5.7, 05 §4.3–§4.7). Copy comes from ../copy.
import { PointsCalculator } from "../../demos/PointsCalculator";
import { LadderScene } from "../../illustrations/LadderScene";
import { NoteScene } from "../../illustrations/NoteScene";
import { PageScene } from "../../illustrations/PageScene";
import { PapersScene } from "../../illustrations/PapersScene";
import type { LandingCopy } from "../copy";
import { Badges, Items, PathItem, PathSection, StatusBadge } from "../parts";

export const PAPERS_EXAMPLE = "Projectile motion · asked in 3 of 4 papers · about 24% of marks";

export function Learn({ copy }: { copy: LandingCopy }) {
  return (
    <PathSection
      path="learn"
      band="surface"
      title="Learn: lessons you can move, for any topic"
      lead="Every lesson starts with something to look at or move, one idea per screen. You try first, then see the explanation, with the reason right under your answer."
      stage={<PageScene />}
    >
      <Items items={copy.learnItems} />
    </PathSection>
  );
}

const PREPARE_ITEMS = [
  {
    title: "What your past papers asked",
    body: "Each topic shows how often it was asked and its share of the marks across the papers you upload, and the question styles that keep coming back. It counts what was asked. It never says what will be asked.",
  },
  {
    title: "A study plan to your exam date",
    body: "Set your exam date. Ifiok puts the topics with the most marks and the most mistakes first, and lays out daily sessions of lessons, practice and past questions up to the day.",
  },
  {
    title: "Worked solutions you can follow",
    body: 'Every step shown, with the method. Numbers are computed by the maths engine; anything it couldn\'t check is labelled "Unchecked".',
  },
  {
    title: "Timed practice papers",
    body: "Sit a timed paper made from your past questions plus similar questions on your weak topics. Multiple choice and numeric answers are marked for you; for theory, you compare with the worked solution and mark yourself: Got it, Partly or Missed. Your plan updates from the result.",
  },
];

export function Prepare({ copy }: { copy: LandingCopy }) {
  return (
    <PathSection
      path="prepare"
      band="paper"
      title="Prepare: get ready for your exam with your past questions"
      afterTitle={copy.prepare.badge ? <Badges badges={[copy.prepare.badge]} className="lp-section-badge" /> : null}
      lead={copy.prepare.lead}
      stage={<PapersScene example={PAPERS_EXAMPLE} />}
    >
      <Items items={PREPARE_ITEMS} />
    </PathSection>
  );
}

const CONTRIBUTE_ITEMS = [
  {
    title: "What you can share",
    body: "Notes you wrote, past questions, lab manuals and worked solutions. Published textbooks can never be shared, and textbook pages you add for yourself stay private.",
  },
  {
    title: "What happens before anyone sees it",
    body: "Ifiok removes names and contact details, checks that it's readable and on the topic, looks for copyright signs and checks for duplicates. Then it's approved, or held with the reason.",
  },
  {
    title: "What other students see",
    body: "Short, cited snippets inside their lessons, never your whole document. Past questions are used for their questions only and never shown as a file.",
  },
];

export function Contribute({ copy }: { copy: LandingCopy }) {
  return (
    <PathSection
      path="contribute"
      band="surface"
      title="Contribute: share notes that help every student on the topic"
      afterTitle={<Badges badges={[copy.contribute.badge]} className="lp-section-badge" />}
      lead="Your notes, past questions, lab manuals and worked solutions can make every student's lessons on a topic better. You choose what to share; everything else stays private."
      stage={<NoteScene />}
    >
      <Items items={CONTRIBUTE_ITEMS}>
        <PathItem title="What you get">
          <p>
            {copy.contribute.whatYouGet}{" "}
            <a className="lp-link" href="#earn">
              See how pay works →
            </a>
          </p>
        </PathItem>
      </Items>
      <p className="lp-after-p">
        <a className="lp-link lp-link-row" href="/terms">
          Read what you can and can&apos;t share
        </a>
      </p>
    </PathSection>
  );
}

export function Teach({ copy }: { copy: LandingCopy }) {
  return (
    <PathSection
      path="teach"
      band="paper"
      title="Teach: explain topics you know, and tutor them"
      lead="You don't need to have mastered a topic on Ifiok to teach it. When you have, learners see your level: it comes from your answers, checked on our server, so nobody can just claim it."
      stage={<LadderScene />}
    >
      <ul className="lp-items">
        <PathItem title="Explainers in your own words" badge={copy.teach.explainersBadge}>
          <p>
            Write a walkthrough, record a voice note up to 5 minutes, or a short video up to 3 minutes. Every explainer
            is checked before anyone sees it, and voice and video get captions. Videos never play on their own and show
            their size first, and data-saver gives the transcript and audio instead. You earn a point for each student
            who finishes it, once per student a month.
          </p>
        </PathItem>
        <PathItem title="Tutoring">
          <p>
            Tutor students who book you on topics you know well. To tutor, your account must be at least 30 days old,
            with a verified payout account in your own name. You set your price within a range and keep 85% of it.
          </p>
          <p className="lp-status-line">{copy.teach.tutoringStatus}</p>
          <p className="lp-example-line">
            <b>Example price:</b> On a ₦2,000 session you receive ₦1,700 and Ifiok keeps ₦300 (15%). Tutors set their
            own price.
          </p>
        </PathItem>
        <PathItem title="Curating lessons" badge={copy.teach.curatingBadge}>
          <p>
            Check and fix AI lessons in a subject you know. You apply to curate a subject and an admin reviews and
            approves you. ₦1,500 for each accepted review, paid monthly.
          </p>
        </PathItem>
      </ul>
    </PathSection>
  );
}

const FORMULA = [
  {
    b: "A student learns from your work.",
    p: "They finish a lesson screen that cites your upload, answer a question built from it, or finish your explainer. That's one point.",
  },
  {
    b: "Points are counted fairly.",
    p: "One point per student, per item, per month. Your own use never counts. Only active students count: an account at least 3 days old, a verified email and 3 study sessions in the last 14 days.",
  },
  {
    b: "The pool is set at month end.",
    p: "35% of Ifiok's margin for the month (what students paid for what they used, minus payment fees and AI costs). If the margin is zero, the pool is zero, and we say so.",
  },
  {
    b: "The pool is split by points.",
    p: "Your share is your points divided by all contributors' points, up to 20% of the pool. Anything above that stays in the pool for next month.",
  },
  {
    b: "Checks, then a hold.",
    p: "Unusual patterns are held for review, and the month's top earners are checked by hand. Earnings are held for 30 days, then you can withdraw ₦2,000 or more to an account in your own name.",
  },
];

export function Earn({ copy }: { copy: LandingCopy }) {
  return (
    <PathSection
      path="earn"
      band="surface"
      title="Earn: how Ifiok pays students"
      afterTitle={<p className="lp-rates-note">Launch rates, may change.</p>}
      lead="Learning earns Units, which you spend inside Ifiok and can't cash out. Work that other students use earns cash once payouts open. Keeping the two apart means nobody can cash out by grinding lessons."
      stage={<PointsCalculator />}
      below={
        <div className="lp-earn-wide">
          <div>
            <table className="lp-earn-table">
              <caption className="lp-sr">Ways to earn on Ifiok</caption>
              <thead>
                <tr>
                  <th scope="col">Way to earn</th>
                  <th scope="col">What you get</th>
                  <th scope="col">Paid from</th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {copy.earnRows.map((r) => (
                  <tr key={r.way}>
                    <th scope="row">{r.way}</th>
                    <td data-label="What you get">{r.what}</td>
                    <td data-label="Paid from">{r.from}</td>
                    <td data-label="Status">
                      {r.status.length === 1 ? <StatusBadge badge={r.status[0]!} /> : <Badges badges={r.status} />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="lp-cap-note">Earned Units are capped at 40 a month and last 90 days.</p>
          </div>
          <h3 className="lp-h3x" style={{ marginTop: 56 }}>
            How your share of the pool is worked out
          </h3>
          <ol className="lp-formula">
            {FORMULA.map((f) => (
              <li key={f.b}>
                <b>{f.b}</b>
                <p>{f.p}</p>
              </li>
            ))}
          </ol>
          <div className="lp-worked">
            <span className="lp-worked-tag">Example</span>
            30 students learn from your notes this month and 12 finish your voice explainer: 42 points. If all
            contributors have 1,400 points together, your share is 3% of the pool. Your 2 approved uploads earn 10 Units
            and the 30 students earn you 30 more: 40 Units, the monthly cap.
          </div>
          <h3 className="lp-h3x" style={{ marginTop: 48 }}>
            When money starts to move
          </h3>
          <div className="lp-money">
            {copy.moneyLines.map((l) => (
              <p key={l}>{l}</p>
            ))}
          </div>
          <p className="lp-after-p" style={{ marginTop: 12 }}>
            <a className="lp-link lp-link-row" href="/terms">
              Read our terms (contributor rules are added before any money moves)
            </a>
          </p>
        </div>
      }
    />
  );
}
