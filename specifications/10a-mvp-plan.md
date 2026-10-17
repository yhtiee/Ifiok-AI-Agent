# 10a · MVP plan (hackathon 27 Oct 2026, then launch)

**This file sets the build order until the MVP ships.** It replaces the phase order in `10-build-plan.md` for now (owner decision, `12` §4 Q38). Build tickets strictly in order; finish each "Done when" before starting the next. `10` stays the reference for anything not listed here, and the rest of the spec (features, data model, guardrails) still applies.

## The MVP in one sentence
A student adds their own course materials (notes, textbook pages, past questions, lab manual) and Ifiok turns them into **a learning path for the course or topic**, **practice that shows their weak areas**, **exam prep from real past questions**, and **virtual labs for practicals they can't do in a real lab**, all grounded in what they uploaded.

## Demo story (what must work on 27 Oct)
1. Sign up, create "PHY 101" (or type a topic).
2. Upload the course outline, lecture notes, two past papers and the lab manual (PDF pages chosen on the phone).
3. See the course **Path**: topics in order, each with a lesson built from *their* notes.
4. Take a lesson, answer checkpoints and practice questions.
5. Open **Weak areas**: "Projectile motion: 2 of 6 right; you mix up horizontal and vertical components", with the next step.
6. Open **Exam prep**: past questions grouped by topic, worked solutions, a timed practice paper.
7. Open **Labs**: "Simple pendulum" from their manual; take readings, plot, find g, get a report.

## Rules that still apply (and how the MVP meets them)
- **AI outputs data, not code (guardrail 3).** Labs are one hand-built *virtual experiment* engine; the AI only fills in its configuration (variables, governing formula, procedure, expected result) from the manual.
- **Engines compute (guardrail 2).** Every reading, answer and lab result comes from mathjs or our engine; AI explains. Numbers that disagree are dropped.
- **Textbooks never upload as files (guardrail 11).** All PDFs are read on the phone (pdf.js); the student picks pages; only that text is sent. No file storage in the MVP.
- **Private stays private.** A student's materials ground only *their* lessons, practice and exam prep (`owner_id` set). Shared lessons still use only `shared_lesson_sources()`. Sharing to the library comes after the MVP.
- **Exam copy never says "predicted" or "likely to appear" (guardrail 13).** We show what past papers contain ("asked in 3 of 4 papers"), never forecasts.
- **18+, RLS on every new table with pgTAP, budgets before every AI call, no prompts or content in logs.**

## Already built (reuse, don't rebuild)
Auth and onboarding · courses, outlines (`scheme_extract`, `outline_draft`), topics → concepts · AI gateway (Groq primary, Gemini fallback) · job system (pgmq worker, `pnpm deploy:worker`) · lesson pipeline (generate → verify → claim check → publish/review) · lesson player with plots and sliders, steppers, checkpoints (MCQ, numeric, expression, order, match), diagrams, inline maths · tables `sources`, `chunks`, `items`, `attempts`, `mastery`, `exam_questions`, `lab_runs` · `embed` function (gte-small) · `match_chunks` (scoped to the session user).

---

## Tickets (in order)

### MVP-00 · Ship a URL and keep it green (½ day, 17 Oct)
**Build:** production deploy on Vercel with the hosted Supabase project and the worker; env vars set; a Playwright smoke test of the existing happy path (sign up → create course → outline → open a lesson → answer a checkpoint) run against the deployed URL; fix the stale P1-02 line in CLAUDE.md.
**Done when:** the URL works on a phone; the smoke test passes against it; `pnpm check` green.

### MVP-01 · Materials: upload and understand (2 days, 17–19 Oct)
**Spec:** F3 (on-device text), F11-FR1 (upload kinds), `03` §3 (`sources`, `chunks`), `03` §9, `04` §6.
**Build:**
- "Add materials" on a course (and on a free-standing topic): kind = course outline · lecture notes · textbook pages · past questions · lab manual. PDF: pdf.js in the browser, page thumbnails, the student picks pages (max 80 per upload); text only is sent. Also paste text.
- `POST /api/materials`: requireAdult → zod → strip personal data (`redact.ts`) → insert `sources` (private, no `storage_path`) → enqueue `embed` job.
- `packages/core/chunk.ts` (≤ 350 word-pieces, 50 overlap, page-aware) + worker `embed` handler (batches of 16 to the `embed` function) → `chunks` with embeddings.
- `lib/ai/retrieve.ts` (P0-12): `match_chunks` with the session user's id only; a lint rule bans request-body user ids there.
- "Materials" panel on the course: list, page counts, status (processing / ready), delete.
- Course outline uploads go straight to the existing `scheme_extract` flow.
**Done when:** a 40-page PDF of notes is searchable within 2 minutes of upload; a query returns the right chunk in the top 6 for 8 of 10 test questions written by the owner from that document; user B never retrieves user A's chunks (pgTAP + test); a textbook upload creates no stored file.

### MVP-02 · Learning path from your materials (2 days, 19–21 Oct)
**Spec:** F2-FR2–FR5, F5-FR6 (Path), `04` §4.2–§4.3, `05` §4.
**Build:**
- **Path** on the course page: the outline's topics in order, each showing lesson state (ready / building / not started) and mastery level as text ("Not started · Familiar · Proficient · Mastered"); "Next up" = the first topic not yet Proficient.
- **Lessons from your materials:** when a student's materials cover a topic (≥ 3 retrieved chunks above the similarity threshold), the `lesson_gen` job builds a **private lesson** (`owner_id` = student) grounded in those chunks, with citations shown as "From your notes, p. 12". Otherwise the shared concept lesson is used, as today. The claim check runs against their chunks.
- **`lesson_repair`:** when a lesson fails verification, one repair call gets the verifier's errors before the lesson goes to review (cuts "Try again" moments).
- **Practice items:** `items_generate` skill + `items_gen` handler: 10 items per topic (MCQ and numeric, grounded in the student's chunks when present), self-consistency check, failures dropped.
**Done when:** for a course with uploaded notes, every outline topic gets a lesson that cites the notes; a topic with no notes still gets the shared lesson; numeric items whose answer disagrees with `answer_expr` never appear (test); "Next up" is correct (test).

### MVP-03 · Progress and weak areas (1½ days, 21–22 Oct)
**Spec:** F5-FR1–FR4, F7-FR9 (diagnosis), guardrail 6, `02` §2.
**Build:**
- `POST /api/sync` (online batch for now): attempts on checkpoints and practice items; **re-graded on the server**; client UUIDs make replays idempotent; updates `mastery` (`lib/agent/mastery.ts`).
- Error tags: wrong answers get a short reason from `explain_error` (topic micro-skill or "unknown").
- **Weak areas** page: topics sorted by low mastery and recent wrong answers, each with the evidence ("2 of 6 right this week"), the most common mistake, and one next step (re-read the lesson, practise 5 questions, try the past question).
- **Today** page: Continue (last lesson), Next up, top 3 weak areas.
**Done when:** a forged `correct: true` is stored as wrong (test); replaying the same attempt UUIDs creates one row each (test); weak areas update after a practice session; mastery boundaries tested.

### MVP-04 · Exam prep from past questions (2 days, 22–24 Oct)
**Spec:** F8 (Exam mode; P2 in `10`, moved up), `04` §4.6 (`exam_extract`, `exam_classify`), `03` §3 (`exam_questions`), guardrail 13.
**Build:**
- Past-question uploads enqueue `exam_extract` (text from the chosen pages) → `exam_questions` rows (year, number, text, marks, type), each tagged to a course topic (`exam_classify`). The student reviews and fixes the extracted list before it is saved (as with outlines).
- **Exam prep** page: questions grouped by topic with how often each topic appears in the uploaded papers (counts, never predictions); "Show worked solution" (AI explanation grounded in the student's notes; any number in it computed by the engine, otherwise flagged "unchecked").
- **Practice paper:** a timed set built from their past questions plus similar generated items for weak topics. MCQ and numeric auto-marked; theory answers self-marked against the worked solution ("Got it / Partly / Missed"), which feeds mastery.
**Done when:** a real two-paper upload produces a reviewable question list; every saved question is tagged to a topic or "unassigned"; no exam screen contains "predicted" or "likely to appear" (test); self-marks move mastery.

### MVP-05 · Virtual labs from your lab manual (2 days, 24–25 Oct)
**Spec:** F4 (amended by `12` §4 Q38), `05` §8, guardrails 2–3.
**Build:**
- **Virtual experiment engine** (hand-built lab module `components/labs/experiment/`): one *measure → record → plot → analyse → report* flow. Configuration (zod, `packages/core/labs/experiment.ts`): aim, apparatus list, independent variable (range, step, unit), measured variable, the governing relation as a mathjs expression with hidden true constants, measurement noise and instrument resolution, how many readings and repeats, the analysis (straight-line fit of chosen axes → derived quantity, e.g. g = 4π²/gradient), the accepted value and tolerance, safety and precautions, viva questions.
- **`lab_extract` skill + job:** reads the lab-manual pages and outputs that configuration. The verifier evaluates the relation over the variable range, checks the analysis recovers the true constant from noise-free readings, and rejects anything else (the lab is then marked "not available as a virtual lab").
- The student sets the variable, takes readings (our engine generates them, seeded, with noise), the table fills, plots update, they fit the line and compute the result; Ifiok compares it with the accepted value and explains the gap; a lab report (aim, method, results table, graph, calculation, error discussion, precautions) prints to PDF. Text mode: steps as a list, readings as a table. Runs save to `lab_runs`.
- Labs list per course from uploaded manuals.
**Done when:** a real simple-pendulum manual page yields a lab whose correct procedure gives g within ±3% over 50 seeds (test); an Ohm's-law manual gives R within ±2%; a manual describing a non-measurement activity is declined, not faked; no AI-written code or HTML anywhere in the lab.

### MVP-06 · Demo ready (1 day, 26 Oct)
**Build:** onboarding goes straight to "Create your course or topic"; empty states that say what to upload; error states for every AI step; phone pass at 360 px; Lighthouse ≥ 90 on Today; pre-build the demo course's lessons and labs the day before (Groq allows 1,000 requests a day per model); the demo script; a recorded fallback video.
**Done when:** the demo story above runs end to end on the deployed URL on a mid-range Android phone, twice in a row.

**Stretch (only if ahead):** **Ask about this**: a grounded tutor on any lesson block or past question, answering from the student's materials with citations (`tutor_chat`, F1), with engine-checked numbers.

**Cut line if behind:** MVP-05 ships one experiment family (straight-line analysis); MVP-04 ships without the timed paper; MVP-02 ships MCQ-only practice. Never cut a guardrail.

---

## Owner tasks for the hackathon (Claude Code must not invent these)
- **OWN-H1:** real materials for the demo course, with permission: course outline, lecture notes, two past papers, one lab manual (pendulum or Ohm's law). Needed by 19 Oct.
- **OWN-H2:** 10 test questions about the notes, with the page that answers each (retrieval check, MVP-01).
- **OWN-H3:** Vercel project and env vars; confirm Groq and Gemini keys; the demo phone.
- **OWN-H4:** decide whether demo users are real students (then OWN-06 legal review first) or the team only.

---

## After the hackathon: launch, then grow by usage
**Before real students (launch blockers):**
1. P0-14 security and observability: headers/CSP, Sentry with scrubbing, **PostHog events** (so the next features are chosen from usage), backups.
2. P0-13 admin minimum (MFA, AI spend, audit) and an abuse switch per user.
3. Email (Resend SMTP): verified sign-up, password reset, Turnstile (Q18, Q19, Q29).
4. Privacy self-service (P1-14): export and delete account; OWN-06 NDPC registration and legal review.
5. Offline outbox for `/api/sync` (P1-11), because students are often on bad data.

**The earning side (Q39), right after launch blockers:** paid student curators with the curator queue (`06` §13, F2-FR6), then contributor rewards (F11, F13), then paid peer tutoring (F17, after legal review and an escrow partner).

**Then, in the order usage justifies:** shared library (sharing approved materials across universities, curation, `curate` handler, OWN-09) · spaced review (FSRS, P1-05) · full daily planner (P1-06) · snap-and-mark (P1-10) · more lab engines (circuits, titration; 3D PC build) · curator queue and trusted promotion (P1-02 rest) · push reminders (P1-12) · the economy (P2).

**Deferred until after launch:** Cloudflare hosting (P0-02), design-system gallery and `check-ui` (P0-05), timetable, goals, teach-back, lecturer tools, groups, payments.
