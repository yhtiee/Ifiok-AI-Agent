// Landing page copy (specifications/landing/04-strategy-and-copy.md §5), resolved against the
// feature flags. Pure data: the sections render it and the JSON-LD is built from it, so the
// visible FAQ and the structured data can't drift. Never add a claim here that a flag doesn't back.

import type { FeatureFlags } from "@/lib/features";

export const SIGN_UP_HREF = "/sign-in?mode=signup";
export const SIGN_IN_HREF = "/sign-in";

export const TITLE = "Ifiok · AI learning agent for Nigerian university students";
export const H1 = "Learn any topic in your course with lessons you can move";
export const OG_TITLE = "Ifiok · the AI learning agent for students";
export const OG_DESCRIPTION =
  "Lessons you can move for any topic in your course. Free for Nigerian university students, 18+.";
export const UNDER_CTA = "Free. For university students 18 and over.";
export const NAME_MEANING = "Ifiok is Ibibio for wisdom and knowledge.";

/** Hackathon submission deadline, 12 Nov 2026 12:00 PST (12 §4 Q43). The judges' FAQ group shows until then. */
export const JUDGES_UNTIL = new Date("2026-11-12T20:00:00Z");

export type BadgeStatus = "open" | "building" | "after" | "sandbox";
export type Badge = { status: BadgeStatus; label: string };

const LABEL: Record<BadgeStatus, string> = {
  open: "Open now",
  building: "Building now",
  after: "After launch",
  sandbox: "Test run · PayPal sandbox",
};

export const badge = (status: BadgeStatus, prefix?: string): Badge => ({
  status,
  label: prefix ? `${prefix}: ${LABEL[status]}` : LABEL[status],
});

const openOr = (open: boolean, closed: BadgeStatus = "building", prefix?: string) =>
  badge(open ? "open" : closed, prefix);

/** "a, b and c" (or "a, b, and c" with `oxford`). */
export function joinList(items: string[], oxford = false): string {
  if (items.length <= 1) return items.join("");
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}${oxford ? "," : ""} and ${items[items.length - 1]}`;
}

export type JourneyStep = {
  step: number;
  id: "learn" | "prepare" | "contribute" | "teach" | "earn";
  title: string;
  forWho: string;
  line: string;
  badges: Badge[];
  link: { href: string; text: string };
};

export type Item = { title: string; body: string; badge?: Badge };

export type FaqItem = { q: string; a: string };
export type FaqGroups = { main: FaqItem[]; judges: FaqItem[] };

export type EarnRow = { way: string; what: string; from: string; status: Badge[] };
export type PriceRow = { feature: string; free: string; plus: string; units: string; no?: boolean };

export type LandingCopy = ReturnType<typeof landingCopy>;

export function metaDescription(f: FeatureFlags): string {
  return f.upload && f.examPrep
    ? "Turn your course outline, notes and past questions into lessons you can move, exam prep and a study plan. Free for Nigerian university students, 18+."
    : "Interactive lessons for any topic in your course, built for Nigerian university students. Exam prep and ways to earn are coming next. Free, 18+.";
}

/** "What works today" (04 §5.10), generated from the flags. */
export function whatWorksToday(f: FeatureFlags): string {
  const today: string[] = [];
  const building: string[] = [];
  const add = (open: boolean, phrase: string) => (open ? today : building).push(phrase);
  today.push("find or create your course");
  if (f.outline) today.push("add the outline");
  if (f.sharedLessons) today.push("open lessons for any topic");
  add(f.upload && f.privateLessons, "lessons from your notes");
  add(f.path, "your Path");
  add(f.practice && f.weakAreas, "practice and weak areas");
  add(f.examPrep, "exam prep");
  add(f.labs, "virtual labs");
  add(f.share, "sharing");
  add(f.explainers, "explainers");
  add(f.earnings, "earnings");
  const later: string[] = [];
  if (!f.plusBilling) later.push("Plus billing", "Units top-ups");
  if (!f.cashPayouts) later.push("cash payouts");
  if (!f.curating) later.push("paid curating");
  if (!f.tutoringBookings) later.push("tutoring bookings");

  const parts = [`Today: ${joinList(today, true)}.`];
  if (building.length) parts.push(`Being built now: ${joinList(building)}.`);
  if (later.length) parts.push(`After launch, when payments are set up: ${joinList(later)}.`);
  return parts.join(" ");
}

export function faqGroups(f: FeatureFlags, now: Date): FaqGroups {
  const main: FaqItem[] = [
    {
      q: "What is Ifiok?",
      a: `Ifiok is an AI learning agent for Nigerian university students. Pick your course or type a topic and learn it with lessons you can move: drag, try, then see why. ${
        f.upload && f.examPrep && f.labs
          ? "It also turns your past questions into exam prep and your lab manual into a virtual lab."
          : "Exam prep, virtual labs and ways to earn by sharing and teaching are being added."
      } The name means wisdom and knowledge in Ibibio.`,
    },
    {
      q: "Is Ifiok free?",
      a: `Yes. Lessons for any topic, your Path, labs, practice, exam patterns and your study plan are free for good. Ifiok Plus (₦500 a month or ₦1,500 a semester) adds unlimited private lessons from your notes, unlimited practice papers and mocks, and priority lesson builds.${
        f.plusBilling ? "" : " Plus opens with payments; until then everything is free."
      }`,
    },
    {
      q: "Does Ifiok have my course and my university?",
      a: "Yes, because there's no fixed list. Search for your course at your university; if nobody has added it, create it and add the outline by photo, by typing the topics, or with a draft from Ifiok that you check. Lessons are shared by topic, so many are ready the first time you open them.",
    },
    {
      q: "How do I use past questions to prepare for exams on Ifiok?",
      a: f.examPrep
        ? "Upload your past papers and check the question list. Ifiok shows how often each topic was asked and its share of marks, builds a study plan to your exam date, shows worked solutions and gives you timed practice papers."
        : "Exam prep is being built now. You'll upload past papers, see how often each topic was asked and its share of marks, follow a study plan to your exam date and sit timed practice papers. Start your course now so its topics are ready when it opens.",
    },
    {
      q: "Does Ifiok predict exam questions?",
      a: 'No. Ifiok shows what your past papers asked, such as "asked in 3 of 4 papers, about 24% of marks", and helps you practise in that style. It never says a question will come out.',
    },
    {
      q: "Can the AI be wrong? How are the numbers checked?",
      a: "Yes, AI can be wrong, so it doesn't do the maths. Every number comes from a maths engine; lessons that fail the check aren't published and practice questions that disagree with it are dropped. Explanations cite their sources, marks are labelled estimates and every block has a flag button.",
    },
    {
      q: "Can I do my physics practical and lab report on Ifiok?",
      a: f.labs
        ? "Yes, as a virtual lab. Add your lab manual pages or pick a topic such as the simple pendulum or Ohm's law. Take readings, plot the graph, work out the result, and get a lab report to print or save. Activities that can't be measured honestly are declined, not faked."
        : "Virtual labs are being built now: from your lab manual or a topic like the simple pendulum, you'll take readings, plot the graph, work out the result and get a lab report. Activities that can't be measured honestly will be declined, not faked.",
    },
    {
      q: "How can I make money as a student on Ifiok?",
      a: "Four ways: uploads other students learn from, explainers, curating AI lessons and tutoring topics you've Mastered. Uploads and explainers earn points toward a monthly pool and Units. Curators get ₦1,500 per accepted review and tutors keep 85% of their price. These are launch rates; cash payouts, curating and tutoring bookings open after launch.",
    },
    {
      q: "When do cash payouts start?",
      a: `After launch, once payments are set up and our terms have had legal review. Cash shares from the contribution pool begin when the pool has reached ₦250,000 a month for two months running. Until then contributors are rewarded in Units. Earnings are held 30 days, and the minimum withdrawal is ₦2,000.${
        f.sandboxPayments
          ? " For the PayPal AI Hackathon, payouts are being tested in PayPal sandbox with test money."
          : ""
      }`,
    },
    {
      q: "How is my share of the contribution pool worked out?",
      a: "Each month, 35% of Ifiok's margin forms the pool. You get one point when a student learns from one of your items, once per student, per item, per month; your own use never counts. Your share is your points divided by all contributors' points, capped at 20% of the pool.",
    },
    {
      q: "Can I share notes I didn't write, or past questions?",
      a: "Share notes you wrote yourself, not someone else's handout. Past questions are fine: Ifiok uses the questions only and never shows the file. Published textbooks are never accepted. Every upload is checked for copyright signs and duplicates, and a duplicate earns nothing.",
    },
    {
      q: "Is my textbook uploaded or shared?",
      a: `${f.upload ? "" : "When uploads open: "}No. Ifiok reads your PDF on your phone and sends only the text of the pages you choose, with personal details removed. Lessons from your materials are for you alone, and textbook pages can never be shared.`,
    },
    {
      q: "Who can tutor, and how much do tutors keep?",
      a: `Tutors need an account at least 30 days old, Mastered in each topic they offer, and a verified payout account in their own name. They set a price within a range and keep 85% of it. ${
        f.tutoringBookings
          ? "The payment is held until the session and refunded in full if the tutor doesn't show."
          : "Tutoring bookings open after launch."
      }`,
    },
    {
      q: "Will it use a lot of data? Does it work on my phone?",
      a: "Ifiok runs in your phone's browser, so there's nothing to install, and it's built for mid-range Android phones. Lessons are small data files, not video. Student video explainers never play on their own, show their size first, and data-saver gives you the transcript and audio instead.",
    },
    {
      q: "Why is Ifiok 18+ only?",
      a: "Our AI providers' terms and Nigeria's data protection law set extra rules for under-18s, including a parent's or guardian's consent. Until we can meet them properly, Ifiok is for students 18 and over. If someone under 18 signs up, the account is deleted at once.",
    },
    {
      q: 'Is Ifiok a "solve it for me" app?',
      a: "No. Ifiok teaches: you move the idea, try the question and see why the answer is right or wrong. Worked solutions show every step so you learn the method. It's built to get you to Mastered, not to hand you answers.",
    },
    { q: "What works today, and what's coming?", a: whatWorksToday(f) },
  ];

  const judges: FaqItem[] = [];
  if (f.sandboxPayments || now < JUDGES_UNTIL) {
    if (f.codePublic) {
      judges.push({
        q: "Is the code public?",
        a: "Yes. The code is on GitHub at github.com/yhtiee/Ifiok-AI-Agent, including how lessons are checked, how AI calls are budgeted and how pay is worked out.",
      });
    }
    judges.push({
      q: "How does Ifiok use AI?",
      a: "AI drafts lessons, practice questions and lab set-ups, reads past questions and reviews explainers. It outputs data, never code, and a maths engine computes every number. In the pilot, text runs on GPT-OSS models on Groq, with Google Gemini for photos and as backup. Every call goes through our server, never your browser.",
    });
    if (f.sandboxPayments) {
      judges.push(
        {
          q: "How do payments work in the hackathon demo?",
          a: 'Everything runs in PayPal sandbox with test money. Contributor payouts use PayPal Payouts, split by points with the 20% cap. Tutoring payments are authorised at booking, captured after the session is confirmed, and voided if the tutor doesn\'t show. Every money screen says "Sandbox: test money".',
        },
        {
          q: "Can Ifiok's AI move money on its own?",
          a: "No. When you keep missing a topic, the study agent can suggest a tutor who has Mastered it and draft the booking, but only your tap creates the payment. Payout explanations use the ledger's numbers, not the model's.",
        },
      );
    }
  }
  return { main, judges };
}

/** Plain-words list of what's open, for the WebApplication `featureList` (open flags only). */
export function openFeatureList(f: FeatureFlags): string[] {
  const list: string[] = [];
  if (f.course) list.push("Find or create your course at any university");
  if (f.outline) list.push("Add your course outline by photo, by typing the topics or from a draft you check");
  if (f.sharedLessons) list.push("Interactive lessons for any topic, shared with every student");
  if (f.upload && f.privateLessons) list.push("Private lessons built from your own notes");
  if (f.path) list.push("A Path through the whole course with mastery levels");
  if (f.practice) list.push("Practice questions marked on the server");
  if (f.weakAreas) list.push("Weak areas with evidence and a next step");
  if (f.examPrep) list.push("Exam prep from your past questions and a study plan to your exam date");
  if (f.labs) list.push("Virtual labs with readings, graphs and a lab report");
  if (f.share) list.push("Share your notes and past questions after checks");
  if (f.explainers) list.push("Explainers in writing, voice or short video for topics you've Mastered");
  if (f.earnings) list.push("Points and Units recorded when your work helps other students");
  return list;
}

export function landingCopy(f: FeatureFlags, now: Date = new Date()) {
  const notesAndPathOpen = f.upload && f.path;
  const earningsBadges = [openOr(f.earnings, "building", "Points and Units"), openOr(f.cashPayouts, "after", "Cash")];

  const journey: JourneyStep[] = [
    {
      step: 1,
      id: "learn",
      title: "Learn",
      forWho: "Starting a course or stuck on a topic",
      line: "Lessons you can move for any topic in your course, at any university.",
      badges: [badge("open"), ...(notesAndPathOpen ? [] : [badge("building", "Your notes and Path")])],
      link: { href: "#learn", text: "See how lessons work →" },
    },
    {
      step: 2,
      id: "prepare",
      title: "Prepare",
      forWho: "Exams coming up",
      line: "See what your past papers asked, topic by topic, then follow a plan to your exam date.",
      badges: [openOr(f.examPrep)],
      link: { href: "#prepare", text: "See exam prep →" },
    },
    {
      step: 3,
      id: "contribute",
      title: "Contribute",
      forWho: "Good notes or past questions to share",
      line: "Share them once; after checks, they help every student learning the topic.",
      badges: [openOr(f.share)],
      link: { href: "#contribute", text: "See how sharing works →" },
    },
    {
      step: 4,
      id: "teach",
      title: "Teach",
      forWho: "Strong in a subject",
      line: "Explain topics you've Mastered in writing, voice or short video, and tutor them.",
      badges: [openOr(f.explainers)],
      link: { href: "#teach", text: "See how teaching works →" },
    },
    {
      step: 5,
      id: "earn",
      title: "Earn",
      forWho: "Want income from what you know",
      line: "Points and Units when your work helps others; cash payouts and tutoring income after launch.",
      badges: earningsBadges,
      link: { href: "#earn", text: "See how pay works →" },
    },
  ];

  const learnItems: Item[] = [
    {
      title: "Your course, at your university",
      body: "Search for your course or create it in under a minute. Add the outline three ways: snap a photo, type the topics, or let Ifiok draft one for you to check against your course. There's no fixed course list, so nothing waits for anyone else to add your course.",
    },
    {
      title: "Built once, then shared with every student",
      body: "The first student to open a topic waits about a minute while its lesson is built. Every student after that, at any university, opens it at once.",
    },
    f.upload && f.privateLessons
      ? {
          title: "Lessons from your own notes",
          body: 'Add your lecture notes, textbook pages or course outline. PDFs are read on your phone; you pick the pages and only their text is sent. Lessons built from your notes cite the page, like "From your notes, p. 12", and only you see them.',
        }
      : {
          title: "Lessons from your own notes",
          badge: badge("building"),
          body: "Next: add your lecture notes or textbook pages and get lessons built from them, citing your own pages. PDFs will be read on your phone, and only the pages you pick are sent.",
        },
    f.path
      ? {
          title: "A Path through the whole course",
          body: "Your outline becomes a Path: every topic in order, what's ready, and the next one to learn. Each topic shows where you are: Not started, Familiar, Proficient or Mastered.",
        }
      : {
          title: "A Path through the whole course",
          badge: badge("building"),
          body: "Next: your outline becomes a Path, every topic in order with your level on each: Not started, Familiar, Proficient, Mastered.",
        },
    f.practice && f.weakAreas
      ? {
          title: "Practice that finds your weak areas",
          body: 'Practice questions for each topic, marked on our server. Weak areas shows what you keep missing, with the evidence, like "2 of 6 right this week", the usual mistake and one next step.',
        }
      : {
          title: "Practice that finds your weak areas",
          badge: badge("building"),
          body: "Next: practice questions for every topic, and a weak-areas list that shows what you keep missing and what to do about it.",
        },
    f.labs
      ? {
          title: "Virtual labs for your practicals",
          body: "Ask for a lab from your manual or by topic, such as the simple pendulum or Ohm's law. Take readings, plot the graph, work out the result, and get a lab report to print or save as PDF. Labs built from a topic say so.",
        }
      : {
          title: "Virtual labs for your practicals",
          badge: badge("building"),
          body: "Next: virtual labs from your lab manual or a topic. Take readings, plot the graph, work out g or R, and get a lab report.",
        },
  ];

  const tutoringStatus = f.tutoringBookings
    ? "The learner's payment is held until the session happens, released when they confirm or 24 hours after, and refunded in full if the tutor doesn't show."
    : f.sandboxPayments
      ? "Test run · PayPal sandbox: bookings are being tested with test money. The payment is held at booking and taken only after the session is confirmed. No real money moves."
      : f.tutorProfiles
        ? "Set up your tutor profile now. Bookings open after launch."
        : "Tutoring: Building now. Bookings and payments: After launch.";

  const tutoringBadge: Badge = f.tutoringBookings
    ? badge("open")
    : f.sandboxPayments
      ? badge("sandbox")
      : badge("after");

  const earnRows: EarnRow[] = [
    {
      way: "Verified uploads",
      what: "+5 Units when approved · +1 Unit for each student who learns from it each month · points toward the pool",
      from: "Contribution pool",
      status: earningsBadges,
    },
    {
      way: "Explainers",
      what: "A point for each student who finishes it, once per student a month",
      from: "Contribution pool",
      status: earningsBadges,
    },
    {
      way: "Curating",
      what: "₦1,500 per accepted review",
      from: "Ifiok's budget",
      status: [openOr(f.curating, "after")],
    },
    { way: "Tutoring", what: "85% of your session price", from: "The learner's payment", status: [tutoringBadge] },
    {
      way: "Learning",
      what: "+3 Units when a topic reaches Mastered (up to 10 topics a month), +5 for a 7-day streak",
      from: "Units only, never cash",
      status: [openOr(f.earnings)],
    },
  ];

  const moneyLines: string[] = [
    f.earnings
      ? "Points and Units are recorded as you earn them. Earned Units move into your Units balance when it opens."
      : "Points and Units start being recorded when sharing and explainers open.",
  ];
  if (!f.cashPayouts) {
    moneyLines.push(
      "Cash payouts, curator pay and tutoring bookings open after launch, once payments are set up and the terms have had legal review. Cash shares from the pool start once the pool has reached ₦250,000 a month for two months in a row, so each share is worth withdrawing. Until then, contributors are rewarded in Units.",
    );
  }
  if (f.sandboxPayments) {
    moneyLines.push(
      "For the PayPal AI Hackathon, the full loop is being tested in PayPal sandbox with test money: pool payouts split by points, and tutoring payments held, then taken or cancelled. No real money moves.",
    );
  }

  const billing = f.plusBilling ? "Pay monthly or by semester" : "Opens with payments";
  const priceRows: PriceRow[] = [
    {
      feature: "Lessons for any topic, your Path, labs and practice",
      free: "Included",
      plus: "Included",
      units: "No",
      no: true,
    },
    { feature: "Exam patterns and your study plan", free: "Included", plus: "Included", units: "No", no: true },
    {
      feature: "Private lessons from your own notes",
      free: "A small allowance each month",
      plus: "Unlimited",
      units: "Extra private lessons",
    },
    { feature: "Practice papers and mocks", free: "A weekly allowance", plus: "Unlimited", units: "Extra mocks" },
    {
      feature: f.tutor ? "Tutor messages" : "Tutor messages (coming later)",
      free: "A small allowance",
      plus: "More each day",
      units: "Extra messages",
    },
    { feature: "Lesson builds", free: "Standard queue", plus: "Priority", units: "No", no: true },
    {
      feature: "Billing",
      free: "Nothing to pay",
      plus: billing,
      units: f.plusBilling ? "Top up from ₦500" : "Opens with payments",
    },
  ];

  return {
    // The hero promises a Path from your material, so it needs uploads, the Path and private lessons.
    heroLead:
      f.upload && f.path && f.privateLessons
        ? "Ifiok is the AI learning agent for Nigerian university students. Add your course outline and notes, or just type a topic, and get a Path of lessons you can move, built from your own material."
        : "Ifiok is the AI learning agent for Nigerian university students. Find or create your course, add the outline, and open a lesson for any topic: drag the graph, answer the question, see why. Exam prep, virtual labs and ways to earn from what you know are being built now.",
    journey,
    learnItems,
    prepare: {
      badge: f.examPrep ? undefined : badge("building"),
      lead: f.examPrep
        ? "Upload past questions and Ifiok shows what the papers asked, topic by topic, then plans your study to the exam date."
        : "This is being built now. Here is what it will do, so you can start your course today and have it ready when exam prep opens.",
    },
    contribute: {
      badge: openOr(f.share),
      whatYouGet: f.earnings
        ? "+5 Units when an upload is approved, +1 Unit for each student who learns from it each month, and points toward the contribution pool."
        : "Approved uploads will earn Units and points toward the contribution pool.",
    },
    teach: {
      explainersBadge: openOr(f.explainers),
      tutoringStatus,
      curatingBadge: openOr(f.curating, "after"),
    },
    earnRows,
    moneyLines,
    trust: {
      files: f.upload
        ? `PDFs are read on your phone and only the pages you choose are sent, with names and contact details removed.${
            f.privateLessons
              ? " Lessons from your notes are visible to you alone."
              : " Your materials are visible to you alone."
          } Your textbook is never uploaded.`
        : "When uploads open, PDFs will be read on your phone and only the pages you choose sent. Your textbook is never uploaded.",
      codePublic: f.codePublic,
    },
    pricing: {
      lead: f.plusBilling
        ? "Core learning is free for good. Plus is for students who study heavily from their own notes."
        : "Core learning is free for good. Plus is for students who study heavily from their own notes. Plus opens with payments; until then everything is free.",
      rows: priceRows,
    },
    faq: faqGroups(f, now),
  };
}
