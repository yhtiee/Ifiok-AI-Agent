# Landing page · 02 · Copy deck

**Owner:** content. **For:** design, engineering. **Date:** 18 Oct 2026.
**Follows:** `01-seo-brief.md` (section order, H1/H2/H3 outline, keywords, FAQ list). **Binding:** `00` §1, §1b, §4, §6, §8 · `06` §0, §2, §3, §12–§15 · `07` §1, §3.4, §5.11 · `12` §4 Q38–Q44 · the lead's decisions of 18 Oct (open sign-up, Q44 prices and rates, sandbox wording, "the code is public on GitHub").

**How to read this deck.** Each section gives: purpose and keywords, then the copy (paste as written; `**H2**` / `**H3**` mark heading levels, `[Button]` marks a link styled as a button), then an illustration brief where a visual helps, then notes for the engineer. Text in *italics inside brackets* is an instruction, not copy.

**Rules the whole page follows**
- One H1. Sentence case. No emoji, no all-caps labels, no hype words. Names: Units, Path, Earnings, Bench; mastery levels Not started · Familiar · Proficient · Mastered.
- Every number a demo shows is computed in code from a formula, never typed into copy. Numbers in illustrations are marked "Example" unless they are rules (prices, rates, caps).
- Exam copy says "asked in 3 of 4 papers" and "about 24% of marks". Never "predicted", "likely to appear" or "will come out".
- Naira appears only for prices, fixed rates (₦1,500 per review), the tutoring example price, and rules (₦2,000 withdrawal minimum, ₦250,000 pool threshold). Never a naira estimate of anyone's pool earnings (Q42).
- **Feature truth gate (engineer):** the copy describes the Stage 1 MVP as specified in `10` MVP-01 to MVP-07. Before deploy, check each feature named on the page is live on the production URL. If one isn't, use the fallback line given in that section's notes. The PayPal sandbox lines show only while the hackathon demo is running (one constant).

---

## 0. Header

**Purpose:** say whose page this is and let skimmers jump. **Keywords:** Ifiok (brand).

**Copy**
- Wordmark: `ifiok` · descriptor (hidden below 640 px): the AI learning agent
- Wordmark link label (screen readers): Ifiok, back to top
- Anchor links (≥ 768 px): Learn · Exam prep · Labs · Earn · Pricing
  - Learn → `#learn` · Exam prep → `#exam-prep` · Labs → `#labs` · Earn → `#earn-intro` · Pricing → `#pricing`
- Secondary button (desktop only, outline style, not camwood): [Start free] → `/sign-in`
- Nav landmark label: Page sections

---

## 1. Hero (`#top`)

**Purpose:** in the first 360×640 viewport, say what Ifiok is, who it's for and what it costs, and let them try a lesson. **Keywords:** P1 (AI learning app for Nigerian university students), P4 (from your notes), P5 (Ifiok).

**Copy**

**H1:** Your course, made easy to see, try and master.

Ifiok is the AI learning agent for Nigerian university students. Upload your outline, notes or past questions, or just type a topic, and get lessons you can move, exam prep and virtual labs.

[Start learning free] → `/sign-in` *(primary, camwood)*

Free. For university students 18 and over.

*(The live tangent demo sits beside the H1 on desktop and directly below the paragraph on phones, with the button under the demo on phones, as today. Its copy is in §15.1.)*

**Illustration:** none. The live demo is the visual (`07` §3.4 rule 7).

**Notes**
- LCP element is the H1 text. Nothing above it waits for JS.
- Drop the current H1 "See it. Try it. Master it." The tagline moves to the footer lockup (§14).
- Replace the old microcopy "Free in the pilot" (pilot wording is gone; sign-up is open).

---

## 2. Four pillars index

**Purpose:** let a skimmer jump straight to what they came for. **Keywords:** exam preparation, virtual lab, learn from your notes, earn as a student (light touch).

**Copy**

**H2:** One app for learning, exams, labs and earning

*(Four full-width rows, each one line plus a link. Not cards.)*

| Row title | Line | Link text → target |
|---|---|---|
| Learn | A Path through any course, built from your notes or a topic you type. | See how lessons work → `#learn` |
| Prepare | See what your past papers ask, then follow a plan to your exam date. | See exam prep → `#exam-prep` |
| Practise | Run your practicals in a virtual lab and get a lab report. | See the virtual lab → `#labs` |
| Teach and earn | Get paid when your notes, explainers or tutoring help other students. | See how you earn → `#earn-intro` |

**Illustration brief: "Four stops on one Ink Line"** *(optional, small, left of the rows on ≥ 768 px; hidden on phones)*
- **Shows:** a single vertical hand-inked line (the Ink Line) with four nodes, one per row, each node carrying its Ifiok topic-type glyph (concept, review, practical, and a fourth for contribution once the designer has it; until then plain nodes).
- **One idea:** these four are one journey, not four products.
- **Elements:** line in `--ink` at 2 px with a slight brush wobble; nodes 12 px circles; no labels inside the SVG (the rows carry the text).
- **Colours:** all nodes `--ink` outline on `--surface`. No role colours here: nothing is a quantity, change or achievement yet.
- **Accessibility:** decorative, `aria-hidden="true"`.

---

## 3. Learn (`#learn`)

**Purpose:** pillar 1. From outline, notes or a topic to a Path of interactive lessons, mastery and weak areas. **Keywords:** P4 (interactive lessons from your notes, course outline), "100 level courses", "weak areas", "<topic> explained".

**Copy**

**H2:** Turn your outline and notes into lessons you can move

Ifiok builds interactive lessons from your course outline and lecture notes. Each screen shows one idea you can drag, predict or check, then explains why, with the page it came from.

**H3:** Upload or just type a topic

Add your course outline, lecture notes or textbook pages, or type a topic such as "derivatives" or "Ohm's law". Your PDF is read on your phone. Only the pages you pick are sent, with personal details removed.

**H3:** A Path through the whole course

Your topics in order, each with a lesson and practice. Lessons built from your notes cite them ("From your notes, p. 12") and are visible to you alone. Where your notes don't cover a topic, you get the shared lesson for it, built once and checked before any student sees it.

**H3:** See your weak areas and the next step

Your answers are marked on our server, so your progress is real. Each topic climbs from Not started to Familiar, Proficient and Mastered. Weak areas show the evidence ("2 of 6 right this week"), your most common mistake and one thing to do next.

*Caption under the illustration:* Your course as a Path. Green topics are Mastered; the next one to work on is marked.

**Illustration brief: "A course Path on a phone"**
- **Shows:** a 360-wide phone frame (thin `--line` outline, no device chrome, no notch art) showing the course home of an example course, "MTH 101 · Example course". A vertical Ink Line runs through five topic nodes, each with the topic title and its mastery level as text:
  1. Sets · Mastered
  2. Real numbers · Mastered
  3. Functions · Proficient
  4. Limits · Familiar · *Next up*
  5. Differentiation · Not started · "Built on first open"
  Below the Path, one row: "Weak area: Limits · 2 of 6 right this week · Mixing up left and right limits".
- **One idea:** your course becomes an ordered route, and you can see exactly where you stand and what's next.
- **Colours:** Ink Line segments already completed (1–2) re-inked in `--built` green, with filled `--built` nodes; node 3 filled `--built-soft` with a `--built` outline; node 4 (next) ringed in `--change` camwood with the words "Next up" (colour is never the only signal); node 5 an open circle in `--ink-3`. Mastery words always printed, never colour alone. Weak-area row uses `--ink-2` text, no red.
- **Do not:** show a real course title from a real university, a real student name, a streak count or a percentage.
- **Alt (`aria-label`):** A course Path: five topics, two Mastered, one Proficient, Limits marked as next, one not started.

**Notes**
- Fallback if private lessons from notes are not live: replace the H3 "A Path…" body's second sentence with "Each lesson is built once per topic and checked before any student sees it."
- "Checked" here means the verifier and claim check of `05` §4, not human review. Don't change it to "reviewed".

---

## 4. Prepare (`#exam-prep`)

**Purpose:** pillar 2. Past questions → topic frequency and share of marks, a study plan to the exam date, worked solutions and timed practice. Guardrail 13 applies to every word. **Keywords:** P2 (exam preparation app, prepare for exams with past questions, study plan to exam date), "how to use past questions", "timed practice", "CBT practice", "worked solutions".

**Copy**

**H2:** Prepare for exams with your past questions

Have past questions but no idea where to start? Upload them for your course. Ifiok pulls out each question, tags it to a topic in your outline and shows how often each topic is asked and how many marks it carries. You check the list before it's saved.

**H3:** See what past papers ask, topic by topic

Counts and shares, not guesses: "Integration: asked in 3 of 4 papers, about 24% of marks." Questions in a similar style are grouped, so you know the format to expect in each topic.

**H3:** A study plan to your exam date

Set your exam date. Ifiok orders your topics by their share of marks and how weak you are in each, then lays out daily sessions of lessons, practice and past questions up to the day. Miss a session and the plan moves with you.

**H3:** Worked solutions and timed practice

Open a worked solution for any past question, built from your notes, with every number computed by the maths engine; anything it can't check is marked "unchecked". Then sit a timed practice paper made from your past questions plus similar questions on your weak topics.

*Small print under the section:* Ifiok shows what past papers asked. It never says a question will come out.

*Caption under the illustration:* Example: four past papers become a topic chart and a plan to 14 Dec.

**Illustration brief: "Past papers become a topic chart and a plan"**
- **Shows:** left to right on desktop, top to bottom on phones, three panels joined by a single camwood arrow:
  1. **Four stacked paper sheets**, labelled "2022", "2023", "2024", "2025", each with a few grey question lines and one line ringed (a question being lifted out).
  2. **A horizontal bar chart**, title "Share of marks, 4 papers (example)". Rows, each with a text label on the bar: Differentiation · asked in 4 of 4 papers · about 28% · Integration · 3 of 4 · about 24% · Limits · 3 of 4 · about 16% · Functions · 2 of 4 · about 12% · Other topics · about 20%. (Shares total 100%.)
  3. **A study-plan strip**: five day-blocks ending at a node "Exam · 14 Dec", with blocks labelled "Integration · lesson + 6 questions", "Differentiation · past questions", "Limits · practice", "Integration · timed paper", "Rest".
- **One idea:** your own past papers turn into a clear picture of what's asked, and a plan follows from it.
- **Colours:** bars in `--quantity` blue (marks are the quantity); the arrow and the plan's next block in `--change` camwood (the action); the exam node outlined `--ink`. No green (nothing is mastered here).
- **Must:** the word "Example" visible in the chart title; no university name, course code beyond the chart, or real exam paper text. Bars sorted by share, values printed on the bars.
- **Alt:** Example: four past papers become a chart of marks by topic and a five-day study plan to the exam.

**Notes**
- The example numbers above are illustrative and labelled so. If the owner supplies permitted demo papers (OWN-H1), the chart can switch to them; until then keep "example".
- `F8-FR3`: with fewer than 3 papers the app shows plain counts. The example uses 4, so shares are fine.
- Fallback if the timed paper is cut (MVP fallback line): drop "Then sit a timed practice paper…" and change the H3 to "Worked solutions you can follow".

---

## 5. Practise (`#labs`)

**Purpose:** pillar 3. A virtual lab from your manual or a lab topic: readings, graph, result, lab report. Name the equipment problem plainly, without statistics. **Keywords:** P3 (virtual lab, virtual physics lab, physics practical online, lab report), "simple pendulum experiment", "Ohm's law experiment", "Hooke's law experiment", "lab manual", "no lab equipment".

**Copy**

**H2:** Run your practicals in a virtual lab

Many labs don't have enough equipment for every student, so practicals get learned from paper. Ifiok gives you a virtual bench: set up the experiment, take readings, plot the graph and work out the result.

**H3:** From your lab manual or a topic

Upload the pages of your lab manual, or ask for a lab by topic: simple pendulum, Ohm's law, Hooke's law. A lab built from a topic is labelled "Generated from the topic, not your manual". If a practical can't be run honestly as a measurement, Ifiok tells you instead of faking it.

**H3:** Readings, graph and result

Every reading comes from the lab engine, with the small errors a real stopwatch or meter gives, never from the AI. Your table and graph fill in as you go. Fit the line, work out the result, and Ifiok compares it with the accepted value and explains the gap.

**H3:** A lab report you can print

Get a report with the aim, method, results table, graph, calculation, error discussion and precautions. Print it or save it as a PDF, and practise the viva questions. Every lab also has a text mode: steps as a list, readings as a table.

*(The pendulum try-it demo sits here, after the H3 "Readings, graph and result" on phones and beside the H3s on desktop. Its copy is in §15.2.)*

**Illustration brief: "Pendulum on the Bench"** *(the static, server-rendered first frame of the pendulum demo; on devices without JS this is what shows, so there is no separate illustration)*
- **Shows:** the dark Bench surface. Left: a retort stand, clamp, string and bob, with a length marker "L" from the clamp to the centre of the bob and a light dashed arc for the swing. Right: a readings table with headings "L (m)", "t for 10 swings (s)", "T (s)", "T² (s²)" and five rows; below it, a small graph of T² against L with five points and a straight best-fit line through the origin, and the result line "g = 4π² ÷ gradient".
- **One idea:** you take readings, the graph forms a straight line, and the result falls out of the gradient, just like the real practical.
- **Data:** compute the five rows in code from T = 2π√(L/g) with g = 9.81 m/s² at L = 0.20, 0.40, 0.60, 0.80, 1.00 m (noise-free, so the line is exact). Label the table "Example readings".
- **Colours (Bench tokens only):** the bob, the length marker and the plotted points in `--bench-quantity` (the quantity measured); the best-fit line and the gradient label in `--bench-change` (rate/change); the result value in `--bench-built`. Readings in JetBrains Mono, tabular. Apparatus lines in `--bench-ink` at 1.5 px, `--bench-line` for gridlines.
- **Alt:** A pendulum on a lab bench with five readings and a straight-line graph of T squared against length, giving g.

**Notes**
- Fallback if "Request a lab" by topic isn't live: H3 becomes "From your lab manual" and drop the second sentence; keep the "can't be run honestly" sentence.
- Don't say "AI lab". The AI only configures; the engine produces readings (guardrail 2).

---

## 6. Teach and earn, summary (`#earn-intro`)

**Purpose:** pillar 4 in one screen: four ways to earn, what's live, a link to the full rules. **Keywords:** "earn money as a student in Nigeria", "get paid for your notes", "student tutor Nigeria", "share past questions and earn".

**Copy**

**H2:** Get paid when your work helps other students

What you add to Ifiok makes lessons better for students at every university. When it helps them, you earn.

*(Four full-width rows, not cards.)*

| Way to earn | Line |
|---|---|
| Uploads | Share notes you wrote, past questions, lab manuals or worked solutions. Earn points and Units every month students learn from them. |
| Explainers | Explain a topic you've Mastered in writing, a voice note or a short video. Earn when students finish it. |
| Curating | Check and fix AI lessons in a subject you know well. ₦1,500 per accepted review. |
| Tutoring | Teach topics you've Mastered in paid sessions. Keep 85% of your price. |

Points and Units are recorded from your first approved upload. Cash payouts, curator pay and tutoring bookings open when payments go live.

Link: See how pay is worked out → `#earn`

*Hackathon line (show only while the demo runs):* For the PayPal AI Hackathon, payouts and tutoring payments run in PayPal sandbox with test money.

**Illustration brief: "From upload to payout"**
- **Shows:** a left-to-right flow of five stations on one Ink Line (stacked vertically on phones):
  1. **Upload** · a note page with a tick and the label "Checked and approved"
  2. **Students learn** · three small student-neutral dots (no faces) each linked to the note by a thin line, label "Each student, once a month"
  3. **Points** · a counter "+3 points"
  4. **Pool** · a shallow container labelled "Contribution pool: 35% of the month's margin", split into a few segments, one highlighted "Your share"
  5. **Payout** · an arrow to an account card labelled "Verified account in your name · after a 30-day hold"
- **One idea:** money follows use: your work is used, you earn points, points decide your share.
- **Colours:** the upload and the student links in `--quantity` blue (the thing being used); the points counter and arrows in `--change` camwood (the change that happens); the pool share and payout in `--built` green (what you've earned). Every station has a text label.
- **Must not:** show any naira amount, coin, wallet glow, sparkle or "₦" symbol.
- **Alt:** How earning works: an approved upload is used by students, each use adds a point, points set your share of the pool.

---

## 7. How it works (`#how`)

**Purpose:** the whole product in three steps. **Keywords:** P4 (course outline, learn from lecture notes), "how to use past questions" (light).

**Copy**

**H2:** How Ifiok works

**H3:** 1. Add your materials or type a topic

Find your course at your university or create it. Add the outline, lecture notes, textbook pages, past questions or lab manual. No materials yet? Type a topic and start.

**H3:** 2. Get your Path

Ifiok puts your topics in order and builds a lesson for each, from your notes where they cover it and from shared lessons where they don't. A new topic takes about a minute the first time; after that it opens at once for every student.

**H3:** 3. Learn, prepare, practise, and earn as you share

Work through lessons and practice, set your exam date for a study plan, and run your practicals on the virtual bench. Share your own notes and explainers, and earn when they help other students.

**Illustration brief: "Three nodes on the Ink Line"** *(this is the layout itself, `07` §3.1)*
- **Shows:** the existing vertical Ink Line timeline with three numbered nodes beside the three H3s. Node 1 and 2 filled `--built` with the segment between them inked green; node 3 ringed `--change` (the step you're on next).
- **One idea:** a short route, and you're already most of the way there.
- **Motion:** none on scroll (`07` §3.4 rule 6). Static.
- **Accessibility:** the numbers live in the H3 text; the SVG nodes are `aria-hidden="true"`.

---

## 8. Verified, not guessed (`#trust`)

**Purpose:** the differentiator: numbers from an engine, cited sources, private materials, light on data, 18+. **Keywords:** "accurate AI for maths", "is my data safe".

**Copy**

**H2:** Every number is checked, not guessed

AI is good at explaining and bad at arithmetic. So on Ifiok the AI explains, and a maths engine computes.

**H3:** Maths from an engine, not memory

Every number you see is computed by a maths engine. A lesson whose maths doesn't check out is never published, and a practice question whose answer disagrees with the engine is dropped.

**H3:** Sources you can see

Explanations cite the page they came from. When a lesson isn't from your course material, it says "General explanation, not from your course material." Marks from AI are labelled estimates. Anyone can flag a wrong step, and three flags hide it until it's fixed.

**H3:** Your materials stay yours

PDFs are read on your phone. Only the pages you choose are sent, with names and contact details removed, and lessons from them are yours alone. Nothing is shared unless you tap Share, and textbook pages never can be.
Link: Read the privacy notice → `/privacy`

**H3:** Light on data, and for adults

Lessons are small data files, not video. Student explainer videos never play on their own and show their size first; data-saver gives you the transcript and audio instead. Ifiok is for students 18 and over.
Link: Read how Ifiok uses AI → `/ai`

**Illustration brief A: "The engine has the last word"**
- **Shows:** two small rows, side by side on desktop, stacked on phones.
  - Row 1: a speech-bubble-shaped card "AI draft: slope at x = 1.5 is 3" → a square "Engine: 2 × 1.5 = 3" → "Match · published".
  - Row 2: "AI draft: answer 8.2" → "Engine: 8.0" → "Mismatch · dropped".
- **One idea:** the engine checks every number before a student sees it; disagreement means the item never ships.
- **Colours:** engine values in `--quantity` blue; arrows `--ink-2`; "published" with a tick icon and `--ok` text; "dropped" with a cross icon and `--bad` text. Icons plus words, never colour alone.
- **Alt:** An AI draft is checked by the maths engine: matching numbers are published, a mismatch is dropped.

**Illustration brief B: "Only your chosen pages leave the phone"**
- **Shows:** a phone holding a strip of eight PDF page thumbnails; three are ticked ("pp. 41–43"). A single arrow carries only those three, as plain text lines, out of the phone to a box labelled "Ifiok server". The other five stay inside the phone, greyed. A small note on the arrow: "Text only · names removed".
- **One idea:** your book never leaves your phone; only the pages you choose are sent, as text.
- **Colours:** the chosen pages and the arrow in `--change` camwood (your action); the unsent pages `--ink-3` outline. No lock icon, no shield, no glow.
- **Alt:** A PDF on a phone: three chosen pages are sent as text, the other pages stay on the phone.

---

## 9. Pricing (`#pricing`)

**Purpose:** answer "what does it cost" in full, honestly, before sign-up. A plain comparison table, not three identical cards. **Keywords:** "AI study app Nigeria" (price angle), "free".

**Copy**

**H2:** Free to learn. Plus for ₦500 a month.

Core learning is free for good. Plus is for students who study heavily from their own notes. **Plus opens with payments. Until then everything is free.**

*(Table. Column headings are the three H3s: render them as H3 inside the header cells, or as H3s above stacked blocks on phones.)*

| | **H3:** Free | **H3:** Ifiok Plus | **H3:** Units for extras |
|---|---|---|---|
| Price | ₦0, for good | ₦500 a month or ₦1,500 a semester | From ₦500 |
| Your Path for any course or topic | Included | Included | |
| Shared lessons, virtual labs and practice | Included | Included | |
| Exam patterns and your study plan | Included | Included | |
| Private lessons from your own notes | A small allowance each month | Unlimited | Extra private lessons |
| Practice papers and mocks | A weekly allowance | Unlimited | Extra mocks |
| Tutor messages | A small allowance | More each day | Extra messages |
| Lesson builds | Standard queue | Priority | |
| Billing | Nothing to pay | Opens with payments | Opens with payments |

*Units block (under the table):*
Top up from ₦500: **₦500 → 50 Units · ₦1,000 → 105 Units · ₦2,000 → 220 Units.** Units you buy never expire. Units pay for extras inside Ifiok; they can't be cashed out or transferred.

*Footnotes:*
1. Exact allowances are shown in the app and may change as we learn what students need.
2. Units you earn by learning or contributing last 90 days. Units you buy don't expire.
3. Prices include any tax that applies.

[Start learning free] *is not repeated here (one primary per screen; the mobile bar covers it).*

**Illustration:** none. The table is the visual.

**Notes**
- Empty cells render as an em dash with `aria-label="Not included"`, never a blank or a red cross. "Included" is text, not a tick alone.
- On phones, render the table as three stacked blocks (Free, Plus, Units), each listing its rows, with the Free block first. Avoid horizontal scroll.
- The price row and the Plus prices must come from the same constants as the JSON-LD offers.
- Footnote 3 restates `06` §2 "VAT-inclusive placeholder prices". If the accountant review (`06` §10) changes that, edit the footnote.

---

## 10. Earn: how pay is calculated (`#earn`)

**Purpose:** show the full rates, formulas and fairness rules so no one has to sign up to find out. Labelled "Launch rates, may change". **Keywords:** "get paid for your notes", "student tutor Nigeria", "earn money as a student in Nigeria".

**Copy**

**H2:** How Ifiok pays students

*Label directly under the H2 (plain text, sentence case, not a badge):* Launch rates, may change.

Learning earns Units, which you spend inside Ifiok. Work that other students use earns cash. Keeping the two apart means nobody can cash out by grinding lessons.

*(Summary table.)*

| Way to earn | What you get | Paid from | When |
|---|---|---|---|
| Verified uploads | +5 Units when approved, +1 Unit for each student who learns from it each month, and points toward the pool | Contribution pool | Points and Units now; cash when payouts open |
| Explainers | Points toward the pool for each student who finishes it | Contribution pool | Points now; cash when payouts open |
| Curating | ₦1,500 per accepted review | Ifiok's budget | When payments go live |
| Tutoring | 85% of your session price | The learner's payment | When payments go live |

**H3:** Verified uploads

Share notes you wrote, past questions, lab manuals or worked solutions. Before anything is published, Ifiok checks that it's readable, on-topic, not a duplicate and not from a published book, and removes personal details. Approved uploads ground lessons for students at any university; they see short cited snippets, never your whole document. You earn +5 Units when an upload is approved, +1 Unit for each student who learns from it each month, and points toward the pool.

**H3:** Explainers

Once you've Mastered a topic, explain it your way: a written walkthrough, a voice note up to 5 minutes, or a short video up to 3 minutes. Every explainer is checked before anyone sees it: AI review of the text or transcript, numbers checked by the engine where possible (otherwise labelled "Numbers not checked"), and a person reviews your first three. Voice and video get captions. Videos never play on their own. You earn a point for each student who finishes it, once per student per month.

**H3:** Curating lessons

Check and fix AI lessons in a subject you know. To curate, you need Mastered in at least 5 topics of that subject and must pass a short check: find and fix three planted errors in a lesson. You get ₦1,500 for each accepted review, paid monthly from Ifiok's budget, not from the pool. A second curator checks one review in ten; rejected reviews aren't paid. There's a monthly cap.

**H3:** Tutoring

Teach topics you've Mastered to students who book you. To tutor, your account must be at least 30 days old, you need Mastered in each topic you offer, and a verified payout account in your own name. You set your price within a range. The learner's payment is held until the session happens and released when they confirm, or 24 hours after the session if nobody raises a problem. If the tutor doesn't show, the learner gets a full refund.
*Example price:* on a ₦2,000 session you receive ₦1,700 and Ifiok keeps ₦300 (15%).

**H3:** How we calculate and pay

*(Ordered list.)*
1. **A student learns from your work.** They finish a lesson screen that cites your upload, answer a question built from it, or finish your explainer. That records one usage point for you.
2. **Points are counted fairly.** One point per student, per item, per month; reading the same thing again adds nothing. Your own use never counts. Only active students count: an account at least 3 days old, a verified email and 3 study sessions in the last 14 days.
3. **The pool is set at month end.** Ifiok works out its margin for the month: what students paid for what they used, minus payment fees and AI costs. 35% of that margin is the contribution pool. If the margin is zero, the pool is zero that month, and we say so.
4. **The pool is split by points.** Your share = your points ÷ all contributors' points. No one gets more than 20% of the pool; anything above that stays in the pool for next month.
5. **Checks come before approval.** Unusual patterns, such as a burst of new accounts that only use one person's work, are held for review. The month's top earners are reviewed by hand.
6. **A 30-day hold, then you withdraw.** Approved earnings are held for 30 days so any fraud found later can be reversed. Then you can withdraw ₦2,000 or more to a verified account in your own name.

*Worked example (points and percentages only):*
Ada's Kinematics notes are used by 30 students this month, and 12 students finish her voice explainer. She has **42 points**. If all contributors together have 1,400 points, Ada's share is **3% of the pool**. Her 2 approved uploads also earn **10 Units**, and the 30 students who used them earn **30 Units**: 40 Units, the monthly cap.

**H3:** When money starts to move

Points and Units are recorded as you earn them; earned Units move into your Units balance when it opens. Cash payouts, curator pay and tutoring bookings open when payments go live. Cash shares from the pool start once the pool has reached ₦250,000 a month for two months in a row, so each share is worth withdrawing; until then, contributors are rewarded in Units.

*Hackathon line (show only while the demo runs):* For the PayPal AI Hackathon, the full loop runs in PayPal sandbox with test money: pool payouts split by points, and tutoring payments held, then captured or voided. No real money moves.

Link: Read the contributor terms → `/terms`

*(The earnings points calculator sits after "How we calculate and pay". Its copy is in §15.3.)*

**Illustration brief: "Splitting the pool by points"**
- **Shows:** one wide horizontal bar labelled "This month's pool (100%)", divided into segments sized by points for five example contributors: A 40% of points, B 25%, C 15%, D 12%, E 8%. A's segment is cut at a dashed line marked "20% cap"; the excess 20% is drawn as a detached block with an arrow to a small bar labelled "Next month's pool". Under the bar, the formula in text: "Your share = your points ÷ all points (max 20%)".
- **One idea:** the split follows points, and no one person can take more than a fifth.
- **Colours:** segments in `--built-soft` with `--built` outlines (earnings); the cap line and the arrow to next month in `--change` camwood; labels `--ink`. Each segment carries its percentage as text. No naira.
- **Alt:** The pool split by points among five contributors; one share is capped at 20% and the rest carries to next month.

**Notes**
- The example contributor shares are illustrative (they sum to 100%). The engineer should render percentages from the same numbers used to draw the segments.
- Curator, tutoring and Plus wording must match `06` §12–§13 and `app_config` defaults (`curator_fee_per_review`, `tutoring_take_rate`). If config changes, the copy changes with it.
- The tutoring example price is labelled "Example price"; tutors set their own within `app_config.tutoring_price_band`.

---

## 11. Public code (`#open-source`)

**Purpose:** let judges and developers verify the claims. **Keywords:** "open source education app" (soft; see notes).

**Copy**

**H2:** The code is public, so you can check how it works

Ifiok's code is public on GitHub. Read how lessons are verified, how every AI call is budgeted and how pay is worked out.

Link: See the code on GitHub → `https://github.com/yhtiee/Ifiok-AI-Agent` (`rel="noopener"`)

**Illustration:** none.

**Notes**
- The SEO brief's H2 says "Open source". Code without a licence isn't open source in the usual sense, so this H2 says "public" until a `LICENSE` file exists (OWN-H7). When it does, change the H2 to "Open source, so you can check how it works" and name the licence in one line.

---

## 12. FAQ (`#faq`)

**Purpose:** answer objections on the page. Native `<details>`; each question is the `<summary>`. The same strings feed the FAQPage JSON-LD word for word. Every answer is ≤ 60 words. **Keywords:** spread naturally (past questions, virtual lab, lab report, free, data, 18+, earn).

**H2:** Questions students ask

*(Group 1, no visible subheading needed.)*

**What is Ifiok?**
Ifiok is an AI learning agent for Nigerian university students. Add your course outline, notes or past questions, or type a topic, and Ifiok builds a Path of interactive lessons, exam prep from your past papers and virtual labs for your practicals. The name means knowledge and wisdom in Ibibio and Efik.

**Is Ifiok free? What do I get with Ifiok Plus?**
Yes. Free covers your Path, shared lessons, labs, practice, exam patterns and your study plan, plus a small monthly allowance of private lessons and tutor messages. Ifiok Plus (₦500 a month or ₦1,500 a semester) adds unlimited private lessons from your own notes, unlimited practice papers and mocks, more tutor messages and priority lesson builds.

**When can I pay for Plus, and how?**
Plus opens when payments go live. Until then everything on Ifiok is free, including what Plus will cover. When billing opens, the app will show the payment options before you're asked to pay anything. Units top-ups for extras open at the same time.

**Does it work for my course and my university?**
Yes. Ifiok has no fixed course list. Find your course at your university or create it, add the outline or type the topics, and Ifiok builds the rest. Lessons are shared by topic, so a lesson another student opened at any university is ready for you at once.

**What can I upload: outline, notes, textbook pages, past questions, lab manual?**
All five. PDFs are read on your phone: you pick the pages, and only their text is sent. You can also paste text, or snap a photo of your course outline.

**Is my textbook uploaded or shared? What happens to my notes?**
Your textbook is never uploaded as a file. Ifiok reads it on your phone and sends only the text of the pages you choose, with personal details removed. Lessons from your materials are visible to you alone. Your notes stay private unless you tap Share, and textbook pages can never be shared.

**Does Ifiok predict exam questions?**
No. Ifiok shows what your past papers asked: how often each topic appears and the share of marks it carries, such as "asked in 3 of 4 papers, about 24% of marks". It helps you practise in that style. It never says a question will come out.

**Can the AI be wrong? How are the numbers checked?**
Yes, AI can be wrong, so Ifiok doesn't let it do the maths. Every number comes from a maths engine. Lessons whose maths doesn't check out aren't published, and practice questions whose answer disagrees with the engine are dropped. Explanations cite their source, marks are labelled estimates, and three flags hide a wrong step.

**How do virtual labs work, and can I get a lab report?**
Upload your lab manual pages or ask for a lab by topic, such as the simple pendulum or Ohm's law. You take readings from the lab engine, plot the graph and work out the result. Ifiok explains any gap from the accepted value, then gives you a lab report to print or save as a PDF.

**Will it use a lot of data? Does it work on my phone?**
Ifiok runs in your phone's browser, so there's nothing to install. Lessons are small data files, not video. Student explainer videos never play on their own, show their size first, and data-saver mode gives you the transcript and audio instead. It's built for mid-range Android phones.

**Why is it 18+ only?**
Our AI providers' terms and Nigeria's data protection law set extra rules for under-18s, including a parent's or guardian's consent. Until we can meet them properly, Ifiok is for students 18 and over. If someone under 18 signs up, we delete the account at once and keep nothing.

**How do I earn on Ifiok, and when do payouts start?**
Four ways: uploads other students learn from, explainers, curating AI lessons and tutoring. Points and Units are recorded as you earn them. Cash payouts, curator pay and tutoring bookings open when payments go live. During the PayPal AI Hackathon, payouts are shown in PayPal sandbox with test money.

**How is my share of the contribution pool calculated?**
Each month, 35% of Ifiok's margin forms the pool. You get one point when a student learns from one of your items, once per student, per item, per month. Your share is your points divided by all contributors' points, capped at 20% of the pool. Earnings are held for 30 days before you can withdraw.

**Who can tutor or curate, and how much do they get?**
Tutors need Mastered in each topic they teach; they set their price and keep 85% of it. Curators need Mastered in at least 5 topics of a subject and must pass a short check; they get ₦1,500 per accepted review. These are launch rates that may change, and both open when payments go live.

**Can I share past questions or notes I didn't write?**
Notes must be your own, not a lecturer's handout. Past questions are fine: Ifiok uses the questions only and never shows the file to anyone. Published textbooks are never accepted. Every upload is checked for copyright signs and duplicates before it's published, and a duplicate earns nothing.

**Is Ifiok a "solve it for me" app?**
No. Ifiok teaches: you move the idea, try a question and see why the answer is right or wrong. Worked solutions show every step so you can follow the method, and practice checks your own answers. It's built to get you to Mastered, not to hand you answers.

*(Group 2: a quiet text line before these, "For judges and developers", in body style, not a heading.)*

**Is Ifiok open source? Where is the code?**
The code is public on GitHub at github.com/yhtiee/Ifiok-AI-Agent. Anyone can read how lessons are verified, how AI calls are budgeted and how pay is calculated.

**How does Ifiok use AI, and which models?**
AI drafts lessons, practice questions and lab set-ups, reads past questions and reviews explainers. It outputs data, never code, and a maths engine computes every number. In the pilot, text runs on open-weight GPT-OSS models on Groq, photos and backup on Google Gemini, and captions on Whisper. Every call goes through our server, never your browser.

**How do payments work in the hackathon demo?**
Everything runs in PayPal sandbox with test money; no real money moves. Contributor payouts use PayPal Payouts, split by usage points with the 20% cap. Tutoring uses authorise-then-capture: the payment is authorised at booking, captured after the session, and voided if the tutor doesn't show. Every money screen says "Sandbox: test money".

**Can Ifiok's AI move money on its own?**
No. When you keep missing a topic, the study agent can suggest a tutor and draft the booking, but only your tap creates the payment. Payout explanations are written from the ledger's numbers, not the model's. Money moves only through our server, after a verified PayPal webhook and a database record that can't be applied twice.

**How does Ifiok keep students' data private and AI costs under control?**
Names and contact details are removed before anything reaches an AI provider, and private lessons are visible to their owner only. Lessons are built once per topic and reused, so most lesson opens need no AI call. Every AI call is checked against an allowance before it runs and refunded if it fails, under one daily cap.

**What works today, and what comes later?**
Today: your Path, lessons from your materials, practice and weak areas, exam prep and study plans, virtual labs, sharing, explainers, and points and Units recorded as you earn. Later, when payments go live: Plus billing, Units top-ups, cash payouts, paid curating and tutoring bookings.

**Notes**
- Questions 1–16 come from the SEO brief; 17–20 are the brief's judge questions; "Can Ifiok's AI move money on its own?" and "What works today…" are added for judges (PayPal agentic-commerce prize, and stage honesty).
- Edit "What works today" with the feature truth gate: anything not live moves to "Later".
- The two hackathon answers (payments demo, sandbox line in "How do I earn") are hidden with the other hackathon lines when the demo ends; replace the last sentence of "How do I earn" with nothing.

---

## 13. Final call to action

**Purpose:** repeat the one action with a reason. **Keywords:** none needed.

**Copy**

**H2:** Start with one topic tonight

Type a topic or add your course outline. If another student has opened it before, your lesson is ready at once; if it's new, it takes about a minute.

[Start learning free] → `/sign-in` *(primary, camwood)*

Free. For university students 18 and over.

**Illustration brief: "A short stroke of ink"** *(optional)*
- **Shows:** a short Ink Line stroke ending in a camwood-ringed node, the empty-state motif from `07` §3.3 "Illustration".
- **One idea:** your Path starts with one step.
- **Colours:** stroke `--ink`, end node `--change`.
- **Accessibility:** decorative, `aria-hidden="true"`. Static (no scroll animation).

---

## 14. Footer

**Copy**
- Lockup: `ifiok` wordmark · See it. Try it. Master it.
- Ifiok means knowledge and wisdom in Ibibio and Efik.
- Ifiok uses AI, and AI can be wrong. Numbers are checked by a maths engine; marks are estimates.
- Links: Terms of use (`/terms`) · Privacy notice (`/privacy`) · How Ifiok uses AI (`/ai`) · Code on GitHub (`https://github.com/yhtiee/Ifiok-AI-Agent`)
- © 2026 Ifiok
- Footer nav landmark label: Legal and code

---

## 15. Interactive demos

Each demo is a client island (≤ 10 KB gz, plain TypeScript formulas, no mathjs). All numbers are computed; the strings below show the variable parts as `{name}`. Every demo has a live text readout (`aria-live="polite"`) and works by keyboard.

### 15.1 Hero: the slope of a curve (`TangentHero`, keep and re-word)

| Element | Copy |
|---|---|
| Top bar | Try it now, no sign-up · The slope of a curve · 1 min |
| Prompt | A straight line has the same slope everywhere. A curve's steepness keeps changing. **Drag the point** along the curve and watch the straight line that touches it. |
| Figure caption | The straight line touching the curve is the tangent. Its slope is the slope of the curve at that point. |
| SVG title | Graph of y = x squared with its tangent line at the point you choose |
| Curve label (in plot) | y = x² |
| Readout labels | Point x · y = x² · Slope |
| Slider label | Move the point (slider or arrow keys) |
| Before first drag | Drag the point to see what happens. |
| After first drag: question | Check yourself: what is the slope of y = x² at x = {checkX}? |
| Button | Check *(secondary style; the hero's primary is "Start learning free")* |
| Correct | Correct. The slope of x² is 2x, and 2 × {checkX} = {answer}. |
| Not quite | Not quite. Drag the point to x = {checkX} and read the slope from the panel. |
| Not a number | Type a number, for example 2.5. |
| After correct (one line, `--ink-2`) | Every lesson on Ifiok works like this: move it, check yourself, then see why. |

**Notes**
- Replace "watch the orange line" in the current component: colour must never be the only signal (`07` §3.4 rule 9), and "orange" isn't our colour's name. The tangent is identified by shape ("the straight line that touches it").
- Keep `checkX = 1.5` and compute `answer` with `slopeAt` (it already does). The correct message must keep reading the computed value.

### 15.2 Practise: take a pendulum reading (new island, Bench surface)

**Model (engineer):** hidden g = 9.81 m/s². T = 2π√(L/g). Each "Time 10 swings" returns t₁₀ = 10T plus a seeded reaction-time error (Gaussian, sd 0.10 s on the 10-swing total), rounded to 0.01 s like a stopwatch. T = t₁₀ ÷ 10 (3 d.p.), T² (3 d.p.). "Work out g" fits a straight line of T² against L (least squares through the origin), gradient k, g = 4π² ÷ k (2 d.p.), percentage difference from 9.81 (1 d.p.). Up to 8 readings.

| Element | Copy |
|---|---|
| Top bar | Try a reading · Simple pendulum · 2 min |
| Instruction | Set the string length, then time 10 swings. Take readings at 3 or more lengths, then work out g. |
| Length control label | String length, L (m) · {L} m *(slider 0.20 to 1.00, step 0.10; arrow keys)* |
| Button 1 | Time 10 swings |
| While timing (max 1 s, skipped with reduced motion) | Timing 10 swings… |
| Table caption | Your readings |
| Table headings | L (m) · t for 10 swings (s) · T (s) · T² (s²) |
| Engine note (under table) | Readings come from the lab engine, with a small timing error like a real stopwatch. |
| After 1–2 readings | {n} of 3 readings. Change the length and time 10 swings again. |
| Same length again | You already have a reading at {L} m. Pick a different length to spread out your graph. |
| Table full (8) | That's 8 readings, enough for a good line. Work out g, or clear and start again. |
| Button 2 (enabled at ≥ 3 distinct lengths) | Work out g |
| Button 2 disabled hint | Take readings at 3 different lengths first. |
| Graph title | T² against L |
| Graph text summary (always visible) | {n} points on a straight line through the origin. Gradient {k} s²/m. |
| Result | g = 4π² ÷ gradient = **{g} m/s²**. Accepted value: 9.81 m/s². You're {pct}% off. |
| Gap: within 1% | That's a close result. Small timing errors mostly cancel out over several readings. |
| Gap: over 1%, range ≤ 0.3 m | Your lengths are close together, so small timing errors tilt the line a lot. Spread them from 0.2 m to 1.0 m. |
| Gap: over 1%, otherwise | Each timing has a small error. More readings over a wider range bring your value closer. |
| Reset | Clear readings |
| Closing line | The full lab on Ifiok adds the method, precautions, viva questions and a lab report you can print. |
| Text mode toggle | Show as text · Show the bench |

**Notes**
- Bench tokens only (`--bench`, `--bench-ink`, `--bench-quantity` for readings and points, `--bench-change` for the fitted line, `--bench-built` for the result). JetBrains Mono, tabular, for the table and result only.
- The swing animation answers the tap only; with `prefers-reduced-motion` it doesn't animate and the reading appears at once.
- The server-rendered first frame is the illustration in §5 (example table, noise-free). On the first tap the example rows clear and the student's own readings start.
- Copy uses "You're {pct}% off", never "Wrong". If pct rounds to 0.0, say "You're within 0.1%."

### 15.3 Earn: work out your points (new island)

**Model (engineer):** inputs A (approved uploads, 0–10), S (students who learned from your uploads, 0–200), E (students who finished your explainers, 0–200). Points P = S + E. Units raw = 5A + S; Units = min(40, raw). Example total points T = 1,000 (fixed, labelled). Share = P ÷ T × 100 (1 d.p.); capped share = min(share, 20). No naira anywhere in this island.

| Element | Copy |
|---|---|
| Heading (H3, inside §10) | Work out your points |
| Intro | See how points and Units add up in a month. It shows points and Units only: the pool's value depends on Ifiok's margin that month. |
| Input 1 label | Uploads approved this month |
| Input 1 help | Notes, past questions, lab manuals or worked solutions that passed the checks. |
| Input 2 label | Students who learned from your uploads |
| Input 2 help | Count each student once per upload. Your own use doesn't count. |
| Input 3 label | Students who finished your explainers |
| Input 3 help | Count each student once per explainer. |
| Output 1 | **{P} usage points** this month · {S} from uploads + {E} from explainers |
| Output 2 | **{Units} Units** · {5A} for approved uploads + {S} for students who used them |
| Output 2, capped | Capped at 40 Units a month. Without the cap it would be {raw}. |
| Output 3: pool share | Your share of the pool = your points ÷ all contributors' points. **Example:** if all contributors together earned 1,000 points this month, your {P} points would be **{share}% of the pool**. |
| Output 3, over cap | That's above the 20% cap, so your share would be 20%. The rest stays in the pool for next month. |
| Output 3, P = 0 | No points yet. Each student who learns from your work adds one. |
| Footnote | Launch rates, may change. The 1,000-point total is an example, not a real figure. Units here come from uploads; explainers earn points. The 40-Unit cap covers every Unit you earn in a month, including from learning, and earned Units last 90 days. Cash payouts open when payments go live. |

**Notes**
- Defaults on load: A = 2, S = 30, E = 12 (the Ada example in §10: 42 points, 40 Units, 4.2% of an example 1,000). Keep the §10 worked example's 1,400 total separate; it's prose.
- Inputs are number fields with − / + steppers (≥ 44 px), not sliders only, so a student can type exact values.

---

## 16. Mobile sticky action bar

**Copy:** [Start learning free] → `/sign-in`
**Rule:** appears only after the hero button has scrolled out of view; hides when the final call to action is visible. Never two camwood buttons on screen at once. No slide-in with reduced motion.

---

## 17. Metadata, share text and alt texts

**Title tag** (`title: { absolute: … }` in `app/(marketing)/page.tsx`, 58 characters):
`Ifiok · AI learning agent for Nigerian university students`
*(Keep `Ifiok · the AI learning agent` as `title.default` for other pages.)*

**Meta description** (152 characters):
`Upload your course outline, notes or past questions and get interactive lessons, exam prep and virtual labs. Free for Nigerian university students, 18+.`

**Open Graph and Twitter**
- `og:title` / `twitter:title`: `Ifiok · the AI learning agent`
- `og:description` / `twitter:description` (90 characters): `Lessons you can move, exam prep from your past questions, virtual labs. Free for students.`
- `og:locale` `en_NG` · `og:type` `website` · `twitter:card` `summary_large_image`
- Share image alt (keep the current, it's accurate): `Ifiok, the AI learning agent. See it. Try it. Master it. A graph of y = x squared with its tangent line.`

**JSON-LD:** use the SEO brief §3 structure. `WebApplication.description` = the meta description above. FAQPage answers = §12 strings exactly. Organization description: `Ifiok is the AI learning agent for Nigerian university students. Ifiok means knowledge and wisdom in Ibibio and Efik.`

**Alt texts (`role="img"` + `aria-label`, all under 125 characters)**

| Illustration | `aria-label` |
|---|---|
| §3 Course Path on a phone | A course Path: five topics, two Mastered, one Proficient, Limits marked as next, one not started. |
| §4 Past papers to chart and plan | Example: four past papers become a chart of marks by topic and a five-day study plan to the exam. |
| §5 Pendulum on the Bench (static frame) | A pendulum on a lab bench with five readings and a straight-line graph of T squared against length, giving g. |
| §6 From upload to payout | How earning works: an approved upload is used by students, each use adds a point, points set your share of the pool. |
| §8 A The engine has the last word | An AI draft is checked by the maths engine: matching numbers are published, a mismatch is dropped. |
| §8 B Only chosen pages leave the phone | A PDF on a phone: three chosen pages are sent as text, the other pages stay on the phone. |
| §10 Splitting the pool by points | The pool split by points among five contributors; one share is capped at 20% and the rest carries to next month. |
| §2, §7, §13 Ink Line marks | Decorative: `aria-hidden="true"`, no label. |

---

## 18. Removed from the current page

Per `01-seo-brief.md` §2 and the lead's decisions: the H1 "See it. Try it. Master it." (now the footer lockup) · "Free in the pilot" · the lecturer FAQ and lecturer earning row (Q39) · snap-and-mark as a headline feature and "2 snap-and-marks a day" (Q38) · "No video" and offline pinning in the trust section (Q41; offline deferred) · "The pilot is open by invitation" section (sign-up is open) · "rewards start at the paid launch" (replaced by the Q44 rates) · "Lessons in medicine, nursing, pharmacy and law wait for a human reviewer" (not in the Stage 1 build) · `ScreenPreviews` `SnapPreview` (keep `LessonPreview` and `LabPreview` only if the designer reuses them inside the new illustrations).

---

## 19. Open questions (for the lead; log in `12` §4 if the owner agrees)

1. **"Open source" vs "public".** Without a licence the code is public, not open source. Safer option taken: §11 H2 and the FAQ answer say "public"; switch when OWN-H7 adds a `LICENSE`. The FAQ question keeps the searcher's words "open source".
2. **Pool funding wording.** `06` §3 defines margin from Units revenue only; Plus revenue (Q44) isn't in the formula. Copy says "what students paid for what they used, minus payment fees and AI costs", which covers both. Confirm Plus revenue counts toward the pool, or narrow the copy.
3. **₦250,000 switch-on rule.** The lead's line is "payouts open with payments"; `06` §0 adds that pool cash starts only once the pool has been ≥ ₦250,000 for two months. Copy states both, because leaving it out would let students expect cash the day payments open. It's a rule about the pool, not an earnings estimate (Q42). Confirm.
4. **Units from explainers and "per student".** `06` §2 gives Units for uploads only (+1 per qualified consumer per month); explainers earn points. The calculator follows that and treats +1 Unit as per student per upload. Confirm whether a student using two of your uploads earns you 1 Unit or 2, and whether explainers earn Units in Stage 1.
5. **Explainer point cap.** `06` §14 caps points from a single explainer at 20% of the author's monthly points. Read literally, an author with one explainer gets almost nothing. Left off the page; please confirm the intended rule.
6. **Tutor messages in Free and Plus.** The tutor (F1) is a stretch in the MVP. Pricing lists tutor messages per Q44; if the tutor isn't live at deploy, change the row to "Tutor messages (coming soon)".
7. **Free mocks wording.** `06` §2's pilot default is 1 mock per course per week; copy says "a weekly allowance" because exact allowances live in `app_config`. Fine to name the number if the owner wants it fixed.
8. **Footnote "prices include any tax".** Restates `06` §2 "VAT-inclusive placeholder prices"; the accountant review (`06` §10) may change it.
