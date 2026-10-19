# 07 · Brand, UI and UX

Goal: Ifiok must look and feel like itself, not like a template. Every visual decision below comes from the subject (learning by seeing and doing, Nigerian students, the Ibibio meaning of the name) or from a specific product pattern we chose to borrow, with the reason.

## 1. Brand core

- **Name:** Ifiok (Ibibio: *wisdom, knowledge*). Always "Ifiok", never "IFIOK" in running text.
- **Descriptor:** the AI learning agent. **Tagline (proposed):** See it. Try it. Master it.
- **Personality:** a sharp senior student who explains well. Calm, direct, warm, never cheesy. Respects the student's time and money.
- **Promise in one line:** "Your course, made easy to see, try and master."

### Voice and copy rules
| Do | Don't |
|---|---|
| "Correct. Now try it with a bigger resistor." | "Awesome job!!! 🎉" |
| "Not quite. You subtracted F(1); it's top minus bottom." | "Oops! Something went wrong with your answer." |
| "This lesson is being prepared. Here's a quick explainer while you wait." | "Our AI is working its magic ✨" |
| "You're on track for your 12 Dec exam." | "Unlock your full potential!" |
| "Ifiok's AI is resting until tomorrow. Lessons, labs and practice still work." | "Error 429: rate limit exceeded" |

- Sentence case everywhere. No all-caps labels in the app.
- Buttons say exactly what happens: "Check", "Continue", "Add money", "Withdraw ₦5,000". The resulting toast reuses the verb ("Withdrawal requested").
- Numbers carry units: "₦1,000", "105 Units", "12 min", "0.45 A".
- Nigerian English is fine and welcome ("revise", "course rep", "handout", "100 level"). Pidgin only where the user turns it on (P3).
- Never say "predicted", "will come out" or "guaranteed" about exams.

## 2. Reference teardown (what we lift, and why)

We studied products that already solve parts of our problem. We lift **mechanics and structure**, never their look.

| Product | What we lift | Where in Ifiok | What we avoid |
|---|---|---|---|
| **Brilliant** | One idea per screen; interact before explanation; fixed bottom action bar (Check → Continue); feedback in a sheet from the bottom with "why" | Lesson player (`/learn`) | Pastel cartoon illustration style; long locked course trees |
| **Duolingo** | Daily goal; streak with a "freeze" (we call it *rest day*); review at the right moment; a visible path of progress | Today, streaks, Path | Mascot guilt-trips, hearts that block learning, gem economy complexity, leagues |
| **Khan Academy** | A named mastery ladder rather than raw percentages | Mastery levels (F5) | Dense dashboards for students |
| **Readwise Reader** | Select text → small action toolbar ("Show me this") | Reader (F9, P3) | Power-user complexity |
| **PhET simulations** | Implicit scaffolding: minimal text, direct manipulation, sliders with units, a Reset button, sensible ranges | Labs | Flash-era visuals |
| **Photomath / Gauth** | Camera with a crop frame for a single question | Snap-and-mark capture | Returning only the answer; we mark each line |
| **Structured / Things 3** | A day as a vertical timeline of time blocks, with tasks you can tick | Today (lectures + study blocks) | Over-designed calendar chrome |
| **Moniepoint / OPay / PiggyVest** | Nigerian money mental model: big balance card with hide toggle, one primary action ("Add money"), clear statuses (Pending, Successful, Failed), shareable receipt | Wallet | Loud fintech gradients, upsell banners |
| **Linear** | Dense, fast lists; command menu (⌘K); keyboard shortcuts | Admin and lecturer areas | Applying that density to student screens |
| **WhatsApp** | Familiar threads, reply quoting, long-press actions | Study groups (P3) | Chat as the main way to learn |
| **Strava** | Kudos ("Respect") and clubs | Groups (P3) | Public leaderboards that shame |

## 3. Visual identity

### 3.1 Signature elements (spend the boldness here, keep the rest quiet)
1. **The Ink Line.** A course path is a single hand-drawn line (one continuous stroke, slightly uneven, like a brush pen) that runs through topic nodes. Completed sections are re-inked in `--built` green (what's been built up); the next node is marked in camwood (the action). Finishing a lesson animates the ink advancing to the next node. It is the one orchestrated motion moment in the app.
2. **Role colours carry meaning.** Blue is always *the quantity*, camwood is always *change/rate/action*, green is always *what's been built up* (area, mastery, earnings). A student learns the colour code once and reads every graph, lab and progress screen with it. This is our learning tool and our brand at the same time.
3. **Ifiok marks.** A small set of original geometric glyphs inspired by the stroke style of *nsibidi* (the ideographic script of the Cross River and Akwa Ibom region) marks topic types (concept, practical, review, exam). **Commission them from a designer and review them with a cultural advisor.** Don't copy real nsibidi signs, and don't use them as decoration.
4. **Two surfaces: Page and Bench.** Reading happens on *Page* (light, cool paper). Doing happens on *Bench* (a dark instrument surface: labs, the 3D lab, timed mocks). Moving from Page to Bench tells the student they're switching from reading to doing.

### 3.2 Logo direction
Lowercase wordmark **ifiok** in Bricolage Grotesque ExtraBold, with the tittle of the first *i* as a camwood dot. The secondary mark is the agent loop: five dots on an inked ring (read, plan, teach, check, adapt), as used on the pitch deck cover. Final logo by a designer; these are the constraints.

### 3.3 Design tokens (`app/globals.css`; Tailwind v4 `@theme`)

```css
:root {
  /* Page (light) */
  --paper: #F2F4F7;      /* cool paper, not cream */
  --surface: #FBFCFD;
  --ink: #131B26;        /* text and lines */
  --ink-2: #4A5563;      /* secondary text */
  --ink-3: #5D6876;      /* tertiary; check AA on surface before use */
  --line: #DDE2E8;

  /* Role colours */
  --quantity: #2650B8;       /* blue: the thing itself */
  --quantity-soft: #E2EAFB;
  --change: #B0500F;         /* camwood: rate, change, action, primary CTA (white text 5.25:1) */
  --change-soft: #F8E8DB;
  --built: #1C7A5A;          /* green: accumulated, mastered, earned */
  --built-soft: #DDF2E9;

  /* Status (never the only signal; always paired with text/icon) */
  --ok: #23824F; --warn: #8F5A00; --bad: #B8382B;   /* all ≥ 4.5:1 on the light --surface */

  /* Bench (dark doing surface, same in both themes) */
  --bench: #131B26; --bench-2: #1D2733; --bench-line: #2C3848; --bench-ink: #EEF1F5;
  /* role colours on the Bench (dark surface): ≥ 6.8:1 on --bench */
  --bench-quantity: #7FA2F0; --bench-change: #F08A45; --bench-built: #4FBF96;
}
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) {
  --paper: #0E1318; --surface: #161D25; --ink: #E5EBF1; --ink-2: #A9B4C2; --ink-3: #97A4B2; --line: #2A3542;
  --quantity: #7FA2F0; --quantity-soft: #17243B; --change: #F08A45; --change-soft: #3A2616;
  --built: #4FBF96; --built-soft: #132E24;
  --ok: #4FBF7A; --warn: #E0A040; --bad: #F07A6A;   /* ≥ 6.2:1 on the dark --surface */
  color-scheme: dark;
}}
```
(Mirror the dark block under `:root[data-theme="dark"]` for the manual toggle.)

**Landing page additions (`12` §4 Q47, `specifications/landing/05` §2):** `--line-strong`, `--change-hover`; identity hues palm yellow `--prep` (fill only; text uses `--prep-ink`) and zobo `--teach`, with `--path-learn|prepare|contribute|teach|earn` aliases (Learn blue, Prepare yellow, Contribute green, Teach zobo, Earn camwood), always paired with "Step n · Name" and used on the landing page only; in-app earnings stay `--built`. Illustration colours `--ill-*` are fixed in both themes and stand on `--stage-*` fields (mid tints in dark). The landing page ground is `--surface` with `--paper` bands; app screens keep `--paper`.

In dark theme the primary button uses `--paper` text on `--change` (7.5:1). Plots, labs and readouts on the Bench always use the `--bench-*` role colours, never the Page ones (blue on the Bench would be 2.4:1).

**Typography**
| Role | Face | Use |
|---|---|---|
| Display | **Bricolage Grotesque** (600, 800) | Screen titles, the wordmark, big numbers. Sparingly. |
| Text | **Atkinson Hyperlegible Next** (400, 600) | Everything else. Chosen for legibility on small, cheap screens and for low-vision readers. |
| Maths | KaTeX fonts | Equations only. |
| Instrument readings | **JetBrains Mono** (tabular) | Only inside labs and the bench (meter readouts, ledgers). Never for decoration. |

Type scale (mobile): 13 / 15 / 17 (body) / 20 / 24 / 32 / 44; the landing H1 reaches 56 on desktop (Q47). Line height 1.5 body, 1.15 display. Measure ≤ 66 characters. Self-host via `next/font`, Latin subset only.

**Shape and space:** 4-px grid. Radius by role: 6 px inputs, 12 px cards, 999 px chips and the primary button; the Bench uses 8 px; landing illustration stages use `--radius-stage` (24 px phone, 32 px desktop), with nothing inside them above 12 px (Q47). No drop shadows on Page cards (use a 1 px `--line` border). One elevated element per screen at most (the bottom sheet).

**Iconography:** Phosphor (regular weight) for UI; our own glyphs for topic types. **Never** use a sparkle icon to mean "AI".

**Illustration:** none of stock people with laptops. Visuals are subject diagrams, plots and lab scenes. Exception (Q47): the landing page's flat, ink-outlined cast "the Marks" (Dot, the wordmark's tittle, plus characters made only from learning objects); each reacts to a tap and is never used to nag or guilt. Empty states use the Ink Line drawing a short stroke, plus one sentence and one action.

### 3.4 Anti-slop rules (Claude Code must follow)
1. No gradient blobs, glassmorphism or glowing orbs. No purple-to-blue gradients.
2. No cards-in-cards; no identical card grids used as layout. Use lists, timelines and full-width rows.
3. No all-caps tracked eyebrow labels above headings in the app.
4. No emoji in UI copy (users may use them in groups).
5. No "AI magic" language or sparkle icons.
6. No fade-up-on-scroll for sections. Motion only answers an action, plus the one Ink Line moment. (Landing illustrations add small tap-triggered answer-motions, Q47; nothing moves on scroll or loops.)
7. No centred hero with two buttons on the landing page. The landing page opens with a live, draggable mini-lesson (the slope of a curve) as the hero.
8. One primary action per screen, in camwood.
9. Colour is never the only signal (pair with text or an icon).
10. Copy passes the voice table above.

## 4. Information architecture

Bottom navigation (students, 4 items): **Today · Courses · Practice · Me**. The four pillars live inside these (fewer tabs on small phones): Learn in Courses, Prepare in Courses (Exam prep) and Practice, Practise (labs) in Courses, Teach and earn in Me.
- **Today:** Continue, Next up, the next study-plan session, top weak areas.
- **Courses:** "What do you want to learn?" search at the top (find or create a course, or type any topic), then the student's courses and followed topics → course home (Path · Materials · Exam prep · Labs). Stage 3 adds explainers under each topic.
- **Practice:** weak areas, practice sets, practice papers; later spaced review and check-my-working (camera).
- **Me:** progress, settings; Stage 3 adds **Earn** (wallet, my contributions, curating, my explainers, tutoring).
- Tutor: a persistent "Ask Ifiok" button (bottom-right, above the nav) that opens a full-height sheet with context from the current screen.

## 5. Key screens (mobile-first, 360–412 px width)

Each screen lists layout, states and the reference it borrows from. ASCII is structure, not style.

### 5.1 Today (Structured + Duolingo)
```
┌──────────────────────────────┐
│ Tue 14 Oct        6-day streak│  streak as text + Ink Line tick (no emoji)
│ "Finish Limits, then 12      │  morning brief (2 lines)
│  reviews. On track for exam."│
│ ─────────────────────────────│
│ 08:00 ● MTH 101 lecture      │  timeline spine = Ink Line (lecture rows from P2 timetable)
│        Preview ready · 5 min │  task chip
│ 10:00 ○ Lesson: Limits  12m  │  next task highlighted (camwood edge)
│ 11:30 ○ 12 reviews       6m  │
│ 16:00 ○ Lab: Ohm's law  15m  │
│                              │
│ [ Start: Limits ]            │  one primary action
└──Today─Courses─Practice─Me───┘
```
States: no plan yet → "Set a goal" card; offline → banner "You're offline. Pinned lessons and practice work."; all done → Ink Line closes the loop, "Done for today. Tomorrow: Continuity."

### 5.1b "What do you want to learn?" (search-first, Linear command menu + Google's single box)
One search field, focused on open. Results are grouped as rows, not cards: **Courses at your university** (code, title, how many classmates), **Topics** (concepts, with "Lesson ready" or "Built on first open, about a minute"), and a last row **"Create MTH 101 at University of Uyo"** when nothing matches. Typing a broad word ("Physics") shows narrower suggestions. Creating a course goes straight to its outline: three choices in one row, **Snap or upload outline** · **Type topics** · **Draft one for me**. The draft is shown with a dashed Ink Line and the label "Draft. Check it against your course." until someone confirms it.

### 5.2 Course home and Path
Vertical Ink Line with topic nodes (glyph + the course's own topic title + mastery level text). Nodes whose lesson doesn't exist yet are drawn as open circles with "Built on first open". Tapping a node opens a sheet: lesson, practice, sources, "Pin for offline". Tabs at the top: Path · Outline (edit, history, "Locked by your lecturer" when locked) · Library · Exam (P2) · Group (P3). A lesson's "new" label and source count sit under its title, quietly, never as a badge.

### 5.3 Lesson player (Brilliant)
Full-screen Page; top: thin progress bar plus close; middle: the screen's 1–3 blocks; bottom bar: **Check** (when a checkpoint is present) or **Continue** (disabled until the interactive block is touched, with a hint). Feedback sheet: verdict word (Correct / Not quite), the "why", **Explain differently**, **Continue**. End screen: summary bullets, mastery change ("Limits: Familiar → Proficient"), next task.

### 5.4 Lab (PhET + Bench)
Bench surface; stations as a segmented control (Brief · Build · Measure · Analyse · Report); the lab canvas takes ≥ 60% of the height; controls in a bottom panel; the assistant message on top in a slim bar; readings in JetBrains Mono. Rotate-to-landscape hint for 3D on phones (not required).

### 5.5 Snap-and-mark (Photomath capture, our own result)
Camera with a crop frame for one question → "Check my reading" (editable transcription in MathLive when confidence is low) → result: photo with the flagged line boxed in camwood, the fix hint, estimated marks, **Practise this**.

### 5.6 Practice
Sections: Due now (count and start), Weak spots (micro-skills with a short reason), Snap a question, Mock exams (P2).

### 5.7 Wallet (Moniepoint/PiggyVest patterns; Stage 3)
Two stacked balance cards: **Units** (with "38 earned Units expire on 12 Jan") and **Earnings** (Available · Pending, with release dates). Primary: **Add money**. Secondary: Withdraw, Convert to Units. History list with statuses and a receipt view.

### 5.8 Contribute: share to the library (Stage 3)
Upload → choose course and kind → attestation ("I made this or have the right to share it. It isn't a published textbook.") → progress → result with a reason when rejected. "My contributions" shows points this month and the earnings estimate.

### 5.8b Explainers: create and watch (Stage 3, F18)
**Create** (from a topic the student has Mastered): choose Write · Record voice · Record video; recording shows a timer and the limit (5 min voice, 3 min video), then a preview with the compressed size; submit → "In review" with an expected time; result with a reason when held. **Watch** (under a topic, after a wrong answer, in exam prep): a list row shows author display name, format, length and size ("Video · 2:10 · 9 MB"); opening it shows the transcript first with a **Play audio** button and a **Load video (9 MB)** button; never auto-play; captions on by default; data-saver hides the video button. Each explainer has Flag and "This helped".

### 5.8c Earn (Stage 3, in Me)
One screen, four rows that each open their own page: **Wallet**, **My contributions** (uploads and explainers, points this month, estimate), **Curating** (queue count in your subjects, accepted reviews and pay this month), **Tutoring** (your profile, upcoming sessions, held and released payments). One primary action per page.

### 5.9 Lecturer: Teach (deferred, `12` §4 Q39)
Not built while lecturers are not served. The design below stays for later: left list of courses; tabs Outline · Materials · Lessons · Class insight (aggregate only, "Not enough data" for n < 5).

### 5.10 Admin
Queues (lessons, contribution pool, explainers, reports, tutoring disputes, payouts), AI spend (today, by skill, top users), kill switches, config. ⌘K command menu.

### 5.11 Landing page
Built from `specifications/landing/04-strategy-and-copy.md` and `05-design-spec.md` (Q47). Hero = a live mini-lesson: drag a point on y = x² and Dot rides the tangent; one action ("Start learning free"). Then the five-step Journey (Learn, Prepare, Contribute, Teach, Earn) with status badges from `lib/features.ts`, one section per step with an interactive illustration, Trust on the Bench, pricing, FAQ and a final call to action. Real screenshots join Learn once the Path ships. No stock imagery.

## 6. Interaction details
- **Touch targets** ≥ 44 × 44 px; primary actions in the thumb zone (bottom third).
- **Haptics** (Android `navigator.vibrate`, 10–20 ms) on correct answers and placements, off in data-saver/reduced motion.
- **Sound** (lab beeps, the correct-answer tick) off by default; opt-in in settings.
- **Loading:** skeletons that match the final layout; never a full-screen spinner for more than 1 s. Long AI jobs show a step list ("Reading pages 41–52 · Building screens · Checking maths").
- **Errors** state what happened and the fix: "Couldn't read this photo. Retake it in better light, with the whole question in the frame."
- **Reduced motion:** the Ink Line updates without animation; no parallax anywhere.

## 7. Accessibility (WCAG 2.2 AA)
- Text contrast ≥ 4.5:1 (check `--ink-3` per surface); focus rings visible (2 px `--quantity`).
- Every plot has a text summary and a data table toggle; every lab has a text mode.
- KaTeX output includes MathML for screen readers.
- Forms have labels; errors are announced (`aria-live`).
- Supports 200% text zoom without horizontal scrolling on Page screens.
