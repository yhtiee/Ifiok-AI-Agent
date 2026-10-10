import type { ReactNode } from "react";
import { AgentLoopMark, InkStroke, Wordmark } from "@/components/marketing/Brand";
import { LabPreview, LessonPreview, SnapPreview } from "@/components/marketing/ScreenPreviews";
import { TangentHero } from "@/components/marketing/TangentHero";

// Landing page: specifications/07-brand-ui-ux.md §5.11 and §3.4 (anti-slop rules).
// Facts and numbers come from 00-product, 01-features (P1 quotas), 06-economy and 08-security-privacy.

// Sign-in also creates the account (P0-04).
const START_HREF = "/sign-in";

function Section({
  id,
  title,
  intro,
  children,
}: {
  id?: string;
  title: string;
  intro?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-20 border-t border-line">
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
        <h2 className="max-w-[22ch] font-display text-2xl leading-[1.15] font-semibold sm:text-[2.5rem]">{title}</h2>
        {intro ? <div className="mt-3 max-w-[62ch] text-base text-ink-2 sm:text-lg">{intro}</div> : null}
        <div className="mt-10">{children}</div>
      </div>
    </section>
  );
}

const SCREENS = [
  {
    preview: <LessonPreview />,
    title: "Lessons you can move",
    caption:
      "One idea per screen: drag, predict and check before the explanation, with the why right under your answer.",
  },
  {
    preview: <LabPreview />,
    title: "Practicals you can actually run",
    caption:
      "Wire the circuit, take readings that behave like real meters, plot your graph and get a lab report, with no equipment and no AI bill.",
  },
  {
    preview: <SnapPreview />,
    title: "Snap your working, see the exact line",
    caption:
      "Photograph one question and Ifiok checks every line of your maths, boxes the first slip and gives you three questions to fix it.",
  },
];

const LOOP = [
  {
    title: "Tell Ifiok what you're learning",
    body: "Search your course at your university, or create it in seconds. Snap the course outline, type the topics, or let Ifiok draft one for you to check. No course? Just type a topic.",
    state: "built" as const,
  },
  {
    title: "A lesson is built once, then shared",
    body: "The first student to open a topic gets its lesson in about a minute. Every student after that, at any university, opens it instantly.",
    state: "built" as const,
  },
  {
    title: "See it, then try it",
    body: "Graphs you drag, steps that are checked, practicals on a virtual bench. Explanations cite the page they came from.",
    state: "next" as const,
  },
  {
    title: "Practice comes back at the right time",
    body: "Questions you miss return when you're about to forget them. Each topic climbs a clear ladder: Not started, Familiar, Proficient, Mastered.",
    state: "ink" as const,
  },
  {
    title: "Your plan adapts every day",
    body: "Ifiok plans 15 to 60 minutes a day around your goals and tells you why each task is there. Miss the same idea three times and it goes back to the root of it.",
    state: "ink" as const,
  },
];

const PROMISES = [
  {
    title: "Never a guessed number",
    body: "Every number you see comes from a maths engine, not the AI's memory. Lessons whose maths doesn't check out are never published.",
  },
  {
    title: "Honest about what it is",
    body: "Marks are labelled estimates. Answers not from your course material say so. Anyone can flag a wrong step, and three flags hide it until it's fixed.",
  },
  {
    title: "Light on your data",
    body: "No video. A lesson is a few dozen kilobytes. Pin topics to keep studying offline when the data or the light runs out.",
  },
  {
    title: "Your textbook stays on your phone",
    body: "Ifiok reads your PDF on the device and only uses the pages you confirm, for you alone. The book is never uploaded or shared.",
  },
];

const FAQ: { q: string; a: ReactNode }[] = [
  {
    q: "Is Ifiok free?",
    a: "Yes during the pilot. Published lessons, labs, practice, reviews and your daily plan are always free, with no limit. AI-heavy actions have a daily allowance: in the pilot, 8 tutor messages and 2 snap-and-marks a day.",
  },
  {
    q: "Which courses does it cover?",
    a: "Any course, any topic, any faculty. There's no fixed catalogue: you create your course or type a topic and Ifiok builds what you need. Labs and snap-and-mark start with maths and physics, because those are what our engines can check.",
  },
  {
    q: "Can the AI be wrong?",
    a: "Yes, and we design for it. Maths is computed and checked by an engine, explanations cite their sources, marks are estimates, and every block has a flag button. Lessons in medicine, nursing, pharmacy and law wait for a human reviewer before anyone sees them.",
  },
  {
    q: "Does Ifiok predict exam questions?",
    a: "No. In exam mode it shows how often a topic was asked in past papers and what share of marks it carried, and lets you practise in that style. It never claims a question will come out.",
  },
  {
    q: "Why is it 18+ only?",
    a: "Our AI providers' terms and Nigeria's data protection law both set extra rules for under-18s. We'll support younger students once we can do it safely, with a parent's or guardian's consent.",
  },
  {
    q: "What happens to my data?",
    a: "We ask for the minimum: your birth month and year, no phone number and no photo. You can download your data or delete your account from settings at any time. Ifiok follows the Nigeria Data Protection Act 2023.",
  },
  {
    q: "I'm a lecturer. Why would I join?",
    a: "Share your notes once and every student who needs them gets clear lessons built on them. You see where your class is stuck (aggregated, never individual students), and from the paid launch you're paid under a simple content licence when your materials are used.",
  },
];

export default function LandingPage() {
  return (
    <>
      <header className="sticky top-0 z-10 border-b border-line bg-paper">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
          <a href="#top" className="flex min-h-11 items-center gap-3" aria-label="Ifiok, back to top">
            <Wordmark className="text-[1.75rem]" />
            <span className="hidden text-sm text-ink-2 sm:inline">the AI learning agent</span>
          </a>
          <nav aria-label="Page sections" className="hidden gap-6 text-sm text-ink-2 md:flex">
            <a className="hover:text-ink" href="#how">
              How it works
            </a>
            <a className="hover:text-ink" href="#contributors">
              Contributors
            </a>
            <a className="hover:text-ink" href="#faq">
              Questions
            </a>
          </nav>
        </div>
      </header>

      <main id="top" className="flex-1">
        {/* Hero: a live mini-lesson, not a centred two-button hero (07 §3.4 rule 7). */}
        <section className="mx-auto grid max-w-6xl gap-8 px-4 pt-8 pb-14 sm:px-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:items-center lg:gap-14 lg:pt-14 lg:pb-20">
          <div className="lg:order-1">
            <h1 className="font-display text-[2.75rem] leading-[1.02] font-extrabold tracking-tight sm:text-6xl">
              See it.
              <br />
              Try it.
              <br />
              <span className="text-change">Master it.</span>
            </h1>
            <p className="mt-5 max-w-[34ch] text-lg text-ink-2 sm:text-xl">
              Your course, made easy to see, try and master.
            </p>
            <div className="mt-7 hidden lg:block">
              <StartAction />
            </div>
          </div>
          <div className="lg:order-2">
            <TangentHero />
          </div>
          <div className="lg:hidden">
            <StartAction />
          </div>
        </section>

        <Section
          title="Built for the way you actually study"
          intro="Ifiok is an AI learning agent for Nigerian university students. It teaches whatever you choose to learn, with lessons you can see and move, practicals you can run and practice that adapts."
        >
          <ul className="grid gap-16">
            {SCREENS.map((s, i) => (
              <li key={s.title} className="grid items-center gap-6 md:grid-cols-2 md:gap-12">
                <div className={i % 2 === 1 ? "md:order-2" : ""}>{s.preview}</div>
                <div className={i % 2 === 1 ? "md:order-1" : ""}>
                  <h3 className="font-display text-xl font-semibold sm:text-2xl">{s.title}</h3>
                  <p className="mt-2 max-w-[44ch] text-base text-ink-2 sm:text-lg">{s.caption}</p>
                </div>
              </li>
            ))}
          </ul>
        </Section>

        <Section
          id="how"
          title="Any course. Any topic. One loop."
          intro="Ifiok runs the same loop for every student: read what you're learning, plan your day, teach, check, adapt. You never wait for an admin, a lecturer or a catalogue to catch up."
        >
          <div className="grid gap-10 md:grid-cols-[auto_1fr] md:gap-16">
            <div className="hidden md:block">
              <AgentLoopMark size={180} />
            </div>
            <ol className="grid">
              {LOOP.map((step, i) => (
                <li key={step.title} className="relative pb-8 pl-12 last:pb-0">
                  {i < LOOP.length - 1 ? <InkStroke state={step.state === "next" ? "ink" : step.state} /> : null}
                  <span
                    aria-hidden="true"
                    className={`absolute top-0.5 left-0 flex h-7 w-7 items-center justify-center rounded-full border-2 text-xs font-semibold tabular-nums ${
                      step.state === "built"
                        ? "border-built bg-built text-surface"
                        : step.state === "next"
                          ? "border-change bg-surface text-change"
                          : "border-ink-3 bg-surface text-ink-2"
                    }`}
                  >
                    {i + 1}
                  </span>
                  <h3 className="font-display text-lg font-semibold sm:text-xl">{step.title}</h3>
                  <p className="mt-1 max-w-[60ch] text-base text-ink-2">{step.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </Section>

        <Section title="Trust you can check">
          <dl className="grid border-t border-line md:grid-cols-2 md:border-t-0">
            {PROMISES.map((p, i) => (
              <div
                key={p.title}
                className={`border-b border-line py-6 md:px-0 ${i < 2 ? "md:border-t" : ""} ${
                  i % 2 === 0 ? "md:pr-10" : "md:border-l md:pl-10"
                }`}
              >
                <dt className="font-display text-lg font-semibold">{p.title}</dt>
                <dd className="mt-1 max-w-[52ch] text-base text-ink-2">{p.body}</dd>
              </div>
            ))}
          </dl>
        </Section>

        <Section
          id="contributors"
          title="How Ifiok pays contributors"
          intro="Your notes, past questions, lab manuals and worked solutions make every lesson better. Approved uploads become sources for everyone learning that topic, at any university."
        >
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <ol className="grid gap-0 border-y border-line">
              <ContributorRow
                who="Students"
                what="Earn Units when your upload is approved (+5) and each month another student learns from it (+1 per student). Units pay for extra tutor messages, marking and private lessons."
              />
              <ContributorRow
                who="Lecturers"
                what="Paid in cash under a simple content licence: per published lesson that cites your materials and per student who used them that month."
              />
              <ContributorRow
                who="Everyone, later"
                what="A cash pool for all contributors switches on once it has reached ₦250,000 a month for two months running. It is always 35% of Ifiok's real margin, split by how much your work is used."
              />
            </ol>
            <div className="grid content-start gap-4 text-base text-ink-2">
              <p>
                <span className="font-semibold text-ink">
                  Learning earns credits. Contributions others use earn cash.
                </span>{" "}
                Keeping the two apart means nobody can cash out by grinding lessons.
              </p>
              <p>
                Upload only what you made or have the right to share. Published textbooks aren&apos;t accepted, and past
                papers are used for their questions only, never shown as files.
              </p>
              <p className="rounded-[var(--radius-card)] border border-line bg-surface px-4 py-3 text-sm">
                <span className="font-semibold text-ink">During the pilot</span> uploads are open and reviewed, but
                rewards start at the paid launch.
              </p>
            </div>
          </div>
        </Section>

        <Section id="faq" title="Questions">
          <div className="grid max-w-3xl border-t border-line">
            {FAQ.map((item) => (
              <details key={item.q} className="group border-b border-line">
                <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-3 text-lg font-semibold [&::-webkit-details-marker]:hidden">
                  {item.q}
                  <span
                    aria-hidden="true"
                    className="text-2xl leading-none font-normal text-ink-2 group-open:rotate-45"
                  >
                    +
                  </span>
                </summary>
                <p className="max-w-[62ch] pb-5 text-base text-ink-2">{item.a}</p>
              </details>
            ))}
          </div>
        </Section>

        <Section
          id="pilot"
          title="The pilot is open by invitation"
          intro="Ifiok is starting with students invited through their course reps, at one or two universities first. Once you're in, you can learn any course or topic you like."
        >
          <ul className="grid max-w-3xl gap-3 text-base">
            <li className="flex gap-3">
              <span aria-hidden="true" className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-change" />
              <span>
                <span className="font-semibold">Students:</span>{" "}
                <span className="text-ink-2">
                  ask your course rep for your course&apos;s Ifiok invite link. It opens straight into your course.
                </span>
              </span>
            </li>
            <li className="flex gap-3">
              <span aria-hidden="true" className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-change" />
              <span>
                <span className="font-semibold">Course reps:</span>{" "}
                <span className="text-ink-2">
                  one link in your class WhatsApp group brings everyone into the same course, outline and plan.
                </span>
              </span>
            </li>
            <li className="flex gap-3">
              <span aria-hidden="true" className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-change" />
              <span>
                <span className="font-semibold">You must be 18 or older.</span>{" "}
                <span className="text-ink-2">It takes about three minutes from sign-up to your first lesson.</span>
              </span>
            </li>
          </ul>
        </Section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto grid max-w-6xl gap-4 px-4 py-10 text-sm text-ink-2 sm:px-6 md:grid-cols-[auto_1fr] md:gap-12">
          <div>
            <Wordmark className="text-2xl text-ink" />
            <p className="mt-2 max-w-[34ch]">Ifiok is Ibibio for wisdom and knowledge.</p>
          </div>
          <div className="grid gap-2 md:justify-self-end md:text-right">
            <p>Ifiok is an AI and it can be wrong. Maths is checked by an engine; marks are estimates.</p>
            <nav aria-label="Legal" className="flex flex-wrap gap-x-5 md:justify-end">
              <a className="inline-flex min-h-11 items-center hover:text-ink" href="/terms">
                Terms of use
              </a>
              <a className="inline-flex min-h-11 items-center hover:text-ink" href="/privacy">
                Privacy notice
              </a>
              <a className="inline-flex min-h-11 items-center hover:text-ink" href="/ai">
                How Ifiok uses AI
              </a>
            </nav>
            <p>© 2026 Ifiok</p>
          </div>
        </div>
      </footer>
    </>
  );
}

function StartAction() {
  return (
    <div className="grid gap-2">
      <a
        href={START_HREF}
        className="inline-flex h-12 w-full items-center justify-center rounded-full bg-change px-7 text-base font-semibold text-on-change hover:opacity-90 sm:w-auto sm:justify-self-start"
      >
        Start learning free
      </a>
      <p className="text-sm text-ink-2">Free in the pilot. For students 18 and older.</p>
    </div>
  );
}

function ContributorRow({ who, what }: { who: string; what: string }) {
  return (
    <li className="grid gap-1 border-b border-line py-5 last:border-b-0 sm:grid-cols-[9rem_1fr] sm:gap-6">
      <p className="font-display text-lg font-semibold text-built">{who}</p>
      <p className="text-base text-ink-2">{what}</p>
    </li>
  );
}
