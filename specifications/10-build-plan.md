# 10 · Build plan (roadmap and tickets)

**One plan, one order.** Build the stages in sequence and the tickets inside each stage in order; finish a ticket's "Done when" before starting the next. Owner decisions behind this order: `12` §4 Q38 (MVP first), Q39 (students only; earn by contributing and teaching), Q40 (four pillars; lane next to library apps), Q41 (video explainers; this restructure). The previous phase-based plan (P0–P3) is archived in `archive/10-build-plan-v1.md`; its ticket IDs (P0-xx, P1-xx) are still cited in the review log and code, and its "Done when" checks still apply where a ticket below points to it.

## Stages at a glance

| Stage | Goal | Pillars | Exit check |
|---|---|---|---|
| **1 · MVP** (PayPal AI Hackathon: core by ~27 Oct, submission 12 Nov 2026 12:00 PST) | A student turns their own materials into a learning path, exam prep and labs, and earns when what they contribute or teach helps others: earnings paid out and tutoring held-then-released through PayPal **sandbox** (test money) | All four | The demo story runs end to end on a phone, twice; the Devpost submission is complete |
| **2 · Launch** (real students, free) | Safe, legal and measurable enough to open to students | all three, hardened | Launch checklist (below) and `08` §10 |
| **3 · Earn** | Real money: wallet and Units spending, paid curators, tutoring bookings with escrow, cash payouts from the contribution pool | Teach and earn | Money invariants (`06` §9), legal review, first payouts |
| **4 · Grow** | More of what usage shows students want | all | Chosen from PostHog data, one ticket at a time |

The four pillars are defined in `00` §1b. Feature status per pillar and stage: `01` (feature map at the top).

## Rules for every ticket
- Add or update tests in the same ticket (`11`). A ticket is not done with failing or skipped tests; run `pnpm check`.
- Any new table gets RLS and a pgTAP test **in the same migration**. Any `security definer` function revokes public execute (guardrail 5).
- Never change a spec decision silently: write it in `12` §4 and pick the safer option.
- Keep the performance budgets (`02` §7) and the anti-slop rules (`07` §3.4).
- Tickets named `OWN-xx` are the owner's (real data, people, legal steps). **Never invent ground-truth data**; build the tooling and stop.

## Already built (reuse, don't rebuild)
Auth, age gate, consents, onboarding · student-created courses, outlines (`scheme_extract`, `outline_draft`), topics → concepts · AI gateway (Groq primary, Gemini fallback, budgets, repair, fallback on rate limits) · job system (pgmq worker Edge Function, sweeper, retries; `pnpm deploy:worker`) · lesson pipeline (generate → verify → claim check → publish/review; prompt v7) · lesson player (lazy block renderers; plots with sliders, steppers, checkpoints incl. order/match, diagrams, inline maths pre-rendered) · tables `sources`, `chunks`, `items`, `attempts`, `mastery`, `exam_questions`, `lab_runs` · `embed` function (gte-small) · `match_chunks` scoped to the session user. Details in CLAUDE.md "Repository status".

---

## Stage 1 · MVP (PayPal AI Hackathon, `12` §4 Q43)

**Target:** the [PayPal AI Hackathon](https://paypalaihackathon.devpost.com/), submission deadline **12 Nov 2026, 12:00 pm PST** (21:00 in Lagos). Rules (confirmed from the challenge page, 18 Oct): meaningfully integrate at least one PayPal technology (API/SDK) in the free **sandbox** and meaningfully incorporate AI, with PayPal central to the project; a working prototype judges can run (hosted URL or full setup instructions; mockups don't count); documentation; a **public, open-source repository on GitHub, GitLab or Bitbucket containing all source code, assets and instructions, with the licence visible at the top** (OWN-H7); a list of every tool, model and AI service used and how; a demo video **under 3 minutes**, public on YouTube, showing it working on the device, with **no copyrighted music or third-party trademarks**. Sponsor tools are optional. Judging: **technical implementation** (how thoroughly and skilfully it uses the PayPal Developer Platform and AI), **design** (a complete product experience, not a proof of concept), **potential impact**, **innovation**, **presentation**. Prizes to aim at: overall placings, Best Use of PayPal + AI, Best Use of Agentic Commerce, Most Impactful, Best Demo Delivery.

**The MVP in one sentence:** a student adds their own course materials (notes, textbook pages, past questions, lab manual) and Ifiok turns them into **a learning path for the course or topic**, **practice that shows their weak areas**, **exam prep with a study plan to the exam date**, and **virtual labs for practicals they can't do in a real lab**, all grounded in what they uploaded; and **students earn** when the materials they share or the explainers they teach help other students (`12` §4 Q42).

**Demo story (must work on 27 Oct):**
1. Sign up, create "PHY 101" (or type a topic).
2. Upload the course outline, lecture notes, two past papers and the lab manual (PDF pages chosen on the phone).
3. See the course **Path**: topics in order, each with a lesson built from *their* notes.
4. Take a lesson, answer checkpoints and practice questions.
5. Open **Weak areas**: "Projectile motion: 2 of 6 right; you mix up horizontal and vertical components", with the next step.
6. Open **Exam prep**: past questions grouped by topic, a study plan to the exam date, worked solutions, a timed practice paper.
7. Open **Labs**: "Simple pendulum" from their manual (or requested by topic); take readings, plot, find g, get a report.
8. **Contribute and teach:** share the notes to the library (checked and approved), record a 2-minute video explainer on a topic they've mastered; a second account learns from both; open **My earnings**: usage points, Units earned, and this month's share of the contribution pool.
9. **Get paid (PayPal sandbox):** the month closes; the contributor's share is paid out to their PayPal sandbox account. The learner books the contributor as a tutor: payment is authorised (held) at booking and captured (released) after the session is confirmed, minus Ifiok's commission. Every screen involving money says "Sandbox: test money".

**How the MVP keeps the guardrails:** labs are one hand-built virtual experiment engine configured by AI as data (guardrails 2–3); every PDF is read on the phone and only chosen pages' text is sent (guardrail 11); a student's materials ground only their own lessons, practice and exam prep (`owner_id` set), and shared lessons still use only `shared_lesson_sources()`; exam copy shows counts, never predictions (guardrail 13).

**Schedule (marathon core, Q42; PayPal and submission after, Q43):** MVP-00 18 Oct · MVP-01 18–19 · MVP-02 20–21 · MVP-03 21–22 · MVP-04 22–23 · MVP-05 24–25 · MVP-06 25–26 · MVP-07 (PayPal sandbox) 28 Oct–2 Nov · MVP-08 (submission ready) 3–10 Nov, buffer to the 12 Nov deadline.

### MVP-00 · Ship a URL and keep it green (½ day)
**Build:** production deploy on Vercel with the hosted Supabase project and the worker; env vars set; a Playwright smoke test of the existing happy path (sign up → create course → outline → open a lesson → answer a checkpoint) against the deployed URL.
**Done when:** the URL works on a phone; the smoke test passes against it; `pnpm check` green.

### MVP-01 · Materials: upload and understand (1½ days)
**Spec:** F3 (on-device text), F11-FR1 (upload kinds), `03` §3 (`sources`, `chunks`), `03` §9, `04` §6.
**Build:**
- "Add materials" on a course (and on a free-standing topic): kind = course outline · lecture notes · textbook pages · past questions · lab manual. PDF: pdf.js in the browser, page thumbnails, the student picks pages (max 80 per upload); text only is sent. Also paste text.
- `POST /api/materials`: requireAdult → zod → strip personal data (`redact.ts`) → insert `sources` (private, no `storage_path`) → enqueue `embed` job.
- `packages/core/chunk.ts` (≤ 350 word-pieces, 50 overlap, page-aware) + worker `embed` handler (batches of 16 to the `embed` function) → `chunks` with embeddings.
- `lib/ai/retrieve.ts`: `match_chunks` with the session user's id only; a lint rule bans request-body user ids there.
- "Materials" panel on the course: list, page counts, status (processing / ready), delete.
- Course outline uploads go straight to the existing `scheme_extract` flow.
**Done when:** a 40-page PDF of notes is searchable within 2 minutes of upload; the right chunk is in the top 6 for 8 of 10 owner-written test questions (OWN-H2); user B never retrieves user A's chunks (pgTAP + test); a textbook upload creates no stored file.

### MVP-02 · Learning path from your materials (1½ days)
**Spec:** F2-FR2–FR5, F5-FR6 (Path), `04` §4.2–§4.3, `05` §4.
**Build:**
- **Path** on the course page: the outline's topics in order, each with lesson state (ready / building / not started) and mastery level as text; "Next up" = the first topic not yet Proficient.
- **Lessons from your materials:** when a student's materials cover a topic (≥ 3 retrieved chunks above the similarity threshold), `lesson_gen` builds a **private lesson** (`owner_id` = student) grounded in those chunks, cited as "From your notes, p. 12". Otherwise the shared concept lesson is used. The claim check runs against their chunks.
- **`lesson_repair`:** when a lesson fails verification, one repair call gets the verifier's errors before the lesson goes to review.
- **Practice items:** `items_generate` skill + `items_gen` handler: 10 items per topic (MCQ and numeric, grounded in the student's chunks when present), self-consistency check, failures dropped.
**Done when:** every outline topic of a course with uploaded notes gets a lesson citing the notes; a topic without notes gets the shared lesson; numeric items whose answer disagrees with `answer_expr` never appear (test); "Next up" is correct (test).

### MVP-03 · Progress and weak areas (1 day)
**Spec:** F5-FR1–FR4, F7-FR9 (diagnosis), guardrail 6, `02` §2.
**Build:**
- `POST /api/sync` (online batch for now): attempts on checkpoints and practice items, **re-graded on the server**; client UUIDs make replays idempotent; updates `mastery` (`lib/agent/mastery.ts`).
- Error tags: wrong answers get a short reason from `explain_error` (topic micro-skill or "unknown").
- **Weak areas** page: topics sorted by low mastery and recent wrong answers, each with evidence ("2 of 6 right this week"), the most common mistake, and one next step.
- **Today** page: Continue (last lesson), Next up, top 3 weak areas, the next study-plan session once MVP-04 lands.
**Done when:** a forged `correct: true` is stored as wrong (test); replaying attempt UUIDs creates one row each (test); weak areas update after a practice session; mastery boundaries tested.

### MVP-04 · Exam prep, study plan and assessments (1½ days)
**Spec:** F8 (moved up), F6 (goal and plan, light), `04` §4.6 (`exam_extract`, `exam_classify`), `03` §3 (`exam_questions`), guardrail 13.
**Build:**
- Past-question uploads enqueue `exam_extract` (text from the chosen pages) → `exam_questions` rows (year, number, text, marks, type), each tagged to a course topic (`exam_classify`). The student reviews and fixes the list before it is saved.
- **Patterns:** per topic, how often it appears and the share of marks it carries across the uploaded papers, and recurring question styles (counts and shares, never predictions).
- **Study plan to the exam date:** the student sets the exam date; Ifiok orders topics by share of marks × weakness and lays out daily sessions (lessons, practice, past questions) to the date. Deterministic, no AI call (`lib/agent/planner.ts`, light F6).
- **Exam prep** page: questions grouped by topic; "Show worked solution" (grounded in the student's notes; numbers computed by the engine, otherwise flagged "unchecked").
- **Assessments:** a timed practice paper from their past questions plus similar generated items for weak topics; MCQ and numeric auto-marked; theory self-marked against the worked solution ("Got it / Partly / Missed"), which feeds mastery and re-orders the plan.
**Done when:** a real two-paper upload produces a reviewable question list; every saved question is tagged to a topic or "unassigned"; the plan covers every topic before the exam date and front-loads high-share weak topics (test); no exam screen contains "predicted" or "likely to appear" (test); self-marks move mastery.

### MVP-05 · Virtual labs on request (1½ days)
**Spec:** F4 (amended, Q38), `05` §8–§9, guardrails 2–3.
**Build:**
- **Virtual experiment engine** (hand-built: `components/labs/experiment/`, config schema `packages/core/labs/experiment.ts`): *measure → record → plot → analyse → report*. Configuration: aim, apparatus, independent variable (range, step, unit), measured variable, governing relation (mathjs expression with hidden true constants), noise and instrument resolution, readings and repeats, analysis (straight-line fit of chosen axes → derived quantity), accepted value and tolerance, precautions, viva questions.
- **`lab_extract` skill + job:** from lab-manual pages **or a requested lab topic** ("Request a lab": pick or type, e.g. "Hooke's law"), output that configuration. The verifier evaluates the relation over the range, checks the analysis recovers the true constant from noise-free readings, and rejects anything else ("not available as a virtual lab"). Topic-built labs are labelled "Generated from the topic, not your manual".
- The student sets the variable and takes readings (engine-generated, seeded, with noise); the table fills, the plot updates; they fit the line and compute the result; Ifiok compares it with the accepted value and explains the gap; a lab report (aim, method, results, graph, calculation, error discussion, precautions) prints to PDF. Text mode: steps as a list, readings as a table. Runs save to `lab_runs`.
**Done when:** a real simple-pendulum manual gives g within ±3% over 50 seeds for a correct procedure (test); an Ohm's-law manual gives R within ±2%; a requested "Hooke's law" lab passes the same checks; a non-measurement activity is declined, not faked; no AI-written code or HTML anywhere in a lab.

### MVP-06 · Contribute, teach and earn (1½ days)
**Spec:** F11, F18, F17-FR1, `06` §0, §2, §4, §14, `08` §2.5c, §7b, `12` §4 Q42.
**Build:**
- **Share to the library:** a "Share" action on the student's own materials (notes, past questions, lab manuals, worked solutions; textbook pages are never shareable) with the licence attestation; `curate` handler: personal data stripped (`redact.ts`), readable and on-topic check and concept tagging (`curate_classify`), copyright signals, duplicate check (text hash + embedding similarity ≥ 0.92) → **approved** into the contribution pool (chunks become `bank`/`approved`, so `shared_lesson_sources()` uses them for other students) or **held** with a reason. Approved uploads ground shared lessons for other students, who see only cited snippets.
- **Explainers (text, voice, video):** for concepts the student has **Mastered**: write, record voice (≤ 5 min) or record/upload video (≤ 3 min, 480p, ≤ 40 MB, compressed in the browser); media to object storage with signed URLs (R2, or Supabase Storage if R2 isn't set up by OWN-H5); worker `transcribe` (Whisper) → captions; `explainer_review` on the transcript and sampled frames; **every MVP explainer also needs an admin approval** (a minimal admin review list behind `requireAdmin`; full MFA admin is L-02). Playback never auto-plays, shows the size first, data-saver shows transcript and audio only. Explainers appear under the topic on the Path and after a wrong answer ("A student explains this").
- **Earnings recorded (no cash):** `record_usage` (server-side, from `/api/sync` and explainer completion) writes one usage point per (resource, consumer, month) when another student completes a lesson screen citing a shared upload or finishes an explainer; self-usage blocked; qualified-consumer thresholds from `app_config` (demo-friendly values allowed, recorded in `12`). **Units earned** follow `06` §2 (+5 per approved upload, +1 per qualified consumer per month, 40/month cap) and are recorded as pending in an append-only `earned_units_pending` table; they convert into the wallet when E-03 ships. **My earnings** (in Me): uploads and explainers with their status, points this month, Units earned, and "Cash payouts from the contribution pool open after launch". No naira estimate is shown until a pool exists.
- **Become a tutor (profile only):** students list concepts they've Mastered and their availability; others see "Tutoring bookings open after launch". No payments.
**Done when:** a shared upload is approved and grounds a lesson for a second account, which can't read the source directly (citations only); a held upload shows its reason; a video explainer is captioned, unplayable until approved, and never downloads video bytes in data-saver (Playwright); a second account finishing it records exactly one usage point (pgTAP); self-usage records nothing; Units earned match the `06` §2 rules and cap (test); no screen shows a naira amount for contributor earnings.

### MVP-07 · Get paid: PayPal sandbox payouts and tutoring holds (3 days)
**Spec:** F17, `06` §3, §12, §15, `08` §2.7, §2.7c, `12` §4 Q43.
**Build:**
- **PayPal sandbox integration** (server-only, `lib/payments/paypal.ts`): OAuth client credentials from `PAYPAL_CLIENT_ID` / `PAYPAL_CLIENT_SECRET` (sandbox); Orders v2, Payouts and webhook signature verification; every PayPal ID stored with `environment = 'sandbox'`.
- **Contributor payouts (sandbox):** a monthly close (`compute_period`, manual trigger for the demo) splits a **sandbox-funded contribution pool** by usage points with the `06` §3 rules (20% cap per contributor); students add their PayPal sandbox email; payout batch via the Payouts API; payout items tracked to `SUCCESS`/`FAILED` via webhooks; My earnings shows paid and pending lines.
- **Tutoring bookings (sandbox):** a learner books a tutor (Mastered-only, F17-FR1): PayPal Orders with `intent = AUTHORIZE` at booking (funds held on the buyer's side, nothing captured); after the learner confirms (or 24 h auto-release) the server **captures** the authorisation; the tutor's share is paid out minus the commission (`app_config.tutoring_take_rate`); tutor no-show → **void** the authorisation; disputes freeze the booking for admin review.
- **Webhooks** (`/api/paypal/webhook`): verify the signature with PayPal's verify-webhook-signature API on the raw body, then fetch the order/payout status from PayPal, then post via an idempotent SQL function keyed on the PayPal ID (guardrails 5 and 12).
- **Agentic commerce (for "Best Use of Agentic Commerce"):** when a student keeps getting a topic wrong, Ifiok's study agent suggests a tutor who has Mastered it, drafts the booking (topic, time, price) and asks the student to approve; only the student's tap creates the PayPal authorisation. The agent proposes; money moves only on an explicit user confirmation, through the server (guardrails 1 and 9). Optionally built with PayPal's agent tooling if it fits the server-side gateway.
- **AI explains payouts:** Ifiok explains each payout line in plain words ("You earned 14 points this month: 9 from your Kinematics notes, 5 from your video explainer") from the server-written records; numbers come from the ledger, never the model.
**Done when:** a sandbox payout reaches the contributor's sandbox account and its webhook marks the line paid exactly once (replay ×3 test); a tutoring booking is authorised, captured after confirmation and voided on a tutor no-show (tests against the sandbox); payout lines never exceed the pool and no line exceeds 20% (pgTAP); every money screen shows "Sandbox: test money".

### MVP-08 · Demo and submission ready (1 week, with buffer)
**Build:** onboarding goes straight to "Create your course or topic"; empty states that say what to upload; error states for every AI step; phone pass at 360 px; Lighthouse ≥ 90 on Today; pre-build the demo course's lessons, labs and one approved explainer the day before (Groq allows 1,000 requests a day per model); two demo accounts (learner and contributor); the demo script; a recorded fallback video.
**Submission:** the public repository (GitHub, GitLab or Bitbucket) with **all** source code, assets and instructions and the open-source licence visible at the top (OWN-H7); the tools list (Groq gpt-oss, Gemini, Whisper, gte-small, Supabase, PayPal Orders and Payouts, …) and how each is used; README with setup and sandbox test accounts, the Devpost text description (problem, how it works, the four pillars, how AI and PayPal are used), a working demo URL with judge test accounts (learner, contributor, tutor), a demo video under 3 minutes, public on YouTube, filmed on a phone, with no copyrighted music or third-party trademarks.
**Done when:** the demo story runs end to end on the deployed URL on a mid-range Android phone, twice in a row; a judge can sign in with the test accounts and complete a sandbox payout and a tutoring booking; the Devpost submission is filed before 12 Nov 2026 12:00 pm PST.

**Stretch:** **Ask about this**: a grounded tutor on any lesson block or past question, answering from the student's materials with citations and engine-checked numbers (F1).
**Fallback cut line (only if a day is lost):** MVP-05 ships one experiment family; MVP-04 ships without the timed paper; MVP-06 ships video upload without in-browser recording; MVP-02 ships MCQ-only practice. Never cut a guardrail.

**Owner tasks (Stage 1):** **OWN-H1** real demo materials with permission (outline, notes, two past papers, one lab manual) by 19 Oct · **OWN-H2** 10 test questions about the notes with the answering page · **OWN-H3** Vercel project, env vars, confirmed Groq and Gemini keys, demo phone · **OWN-H4** whether demo users are real students (then OWN-06 first) · **OWN-H5** a Cloudflare R2 bucket and API keys for explainer media (or accept Supabase Storage for the demo) · **OWN-H6** a short contributor and explainer terms page (draft; lawyer review before payouts) · **OWN-H7** decide on making the **whole** repository public with an open-source licence (required: all source code must be public; a subset isn't allowed), pick the licence, and confirm no secrets are in the git history · **OWN-H8** PayPal developer account, sandbox business account (the platform) and personal test accounts (contributor, learner, tutor) · **OWN-H9** register the team on Devpost and record the demo video.

---

## Stage 2 · Launch (real students, free)

Open Ifiok to real students at one or two universities. Everything stays free; no money moves.

### L-01 · Security, observability, backups
**Spec:** `08` §2.3, §2.9, §2.10, §10 · archived ticket P0-14.
**Build:** security headers and CSP; Sentry with scrubbing (no prompts or content, guardrail 10); **PostHog events** (signup, onboarding_done, materials_added, path_opened, lesson_done, checkpoint_correct, plan_created, practice_paper_done, lab_run_done, invite_joined; user UUID only) so Stage 4 is chosen from usage; `.github/workflows/backup.yml` (encrypted dump to R2); service-role grep check.
**Done when:** the `08` §10 Launch checklist passes; a restore from backup into a fresh database works.

### L-02 · Admin minimum and moderation
**Spec:** F15 · `07` §5.10 · `08` §2.1, §7 · archived P0-13.
**Build:** `app/(admin)/admin/*` behind MFA; AI spend (today, by skill, top users); config editor with zod per key; per-user abuse switch; review queues for lessons in `review`, flagged blocks and reported content; `admin_audit` for every write.
**Done when:** non-MFA admins are redirected; every admin write creates an audit row; config edits apply within 60 s.

### L-03 · Email sign-up, recovery and bot protection
**Spec:** F0, `12` §4 Q18, Q19, Q28, Q29.
**Build:** Resend SMTP; email confirmation on; password reset by code; Turnstile on sign-up and sign-in.
**Done when:** new accounts verify their email; a forgotten password can be reset; bot sign-ups are blocked in a test.

### L-04 · Privacy self-service and retention
**Spec:** `08` §5–§6 · archived P1-14.
**Build:** Settings → Privacy (export, delete account, consents); `export-data` and `delete-account` functions; retention crons.
**Done when:** export contains every listed table; deletion removes all rows and storage objects (test).

### L-05 · Bad-network basics
**Spec:** F14 basics, `02` §6 · archived P1-11 (subset).
**Build:** installable PWA shell (Serwist); pin a topic offline (lesson JSON, items, lab); offline attempts queue to `/api/sync`, synced exactly once.
**Done when:** a pinned lesson, its practice and its lab work in airplane mode; attempts sync once (Playwright, network offline).

### L-06 · Invites and growth loop
**Spec:** archived P1-03 (invites).
**Build:** `/join/[code]` course invite links with WhatsApp share and an OG card; course reps can lock outlines.
**Done when:** a student joins a course from a WhatsApp link and lands on its Path.

**Owner tasks (Stage 2):** **OWN-06** NDPC registration, DPO contact, reviewed privacy notice and terms · **OWN-01** launch community (course reps at one or two universities) · **OWN-05** lesson and topic eval sets so cheaper models can be chosen per subject.
**Launch exit check:** L-01 to L-06 done; `08` §10 Launch checklist; activation and weekly-active metrics visible in PostHog.

---

## Stage 3 · Earn (teach and earn)

Students already contribute, teach and earn points and Units from MVP-06; this stage makes the money real. **Prerequisites (owner):** **OWN-E1** registered business, Paystack live mode, Supabase Pro (daily backups), accountant review of `06` §10 · **OWN-E2** licensed escrow/payment partner and lawyer-reviewed contributor, explainer and tutor terms · **OWN-09** curation set and sensitive-subject curators · **OWN-E3** video and voice moderation policy and reviewer rota.

### E-01 · Shared library at scale (extends MVP-06)
**Spec:** F11, `06` §4, `08` §2.5, §8 · archived P1-03b.
**Build:** on top of MVP-06: curator-reviewed holds instead of admin-only, the takedown form, ring detection inputs, and the full qualified-consumer rules; `curate` handler (from MVP-06) (readable, on-topic, concept tagging, duplicate check, personal-data stripping, copyright signals) → approved into the contribution pool or rejected with a reason; approved chunks feed `shared_lesson_sources()`, refreshes and other students' lessons; usage points recorded when others learn from them; takedown form.
**Done when:** an approved upload grounds a lesson for a student at another university who can't read the source directly (citations only); every rejection has a reason; duplicates earn nothing; usage points are one per (source, consumer, month) (pgTAP).

### E-02 · Paid student curators
**Spec:** F2-FR6, `06` §13 · archived P1-02 (curator queue, trusted promotion).
**Build:** curator eligibility (Mastered in ≥ 5 concepts of a subject + curator check); curator queue (flagged, new and sourceless non-STEM lessons in their subject); block editor with live validation through `/api/lessons/:id`; `trusted` promotion job; per-review pay ledger (paid monthly, manual transfer at first); 1-in-10 spot checks.
**Done when:** a curator can fix lessons in their subject only; an accepted review creates one payable line (idempotent); a rejected review pays nothing.

### E-03 · Units wallet and contributor rewards
**Spec:** F13, `06` §1–§9 · archived P2 economy tickets.
**Build:** ledger migration and SQL functions (`06` §8); Paystack top-ups (HMAC + Verify Transaction, guardrail 12); wallet screen; earn Units for approved uploads, usage of your materials, mastery and streaks (40/month cap); spend Units on AI-heavy extras (private lessons beyond the free allowance, extra mocks, extra tutor messages).
**Done when:** every `06` §9 invariant passes in pgTAP; webhooks are idempotent; no negative balances.

### E-04 · Explainers at scale (extends MVP-06)
**Spec:** F18, `06` §14, `08` §7b, `07` §5.8b.
**Build:** on top of MVP-06: curator review replaces admin approval for each author's first 3; full reporting and 3-flag hide; points from explainers convert to Units in the wallet and to cash shares when payouts open; explainer studio for students with Mastered in the concept: written walkthrough, voice note (≤ 5 min) or **short video (≤ 3 min, recorded or uploaded, 480p, ≤ 40 MB, compressed on the device)**; media stored in object storage with a CDN (`02` §1); transcript by Whisper (Groq) for captions, search and review; AI review of the transcript and sampled video frames; human review of each author's first 3 explainers; reports and the 3-flag hide rule; never auto-play; data-saver shows transcript and audio only; usage points when other students finish an explainer.
**Done when:** no explainer is visible before it passes review (test); every video has captions from its transcript; data-saver never loads video bytes (Playwright); a qualified consumer finishing an explainer records one usage point per month (pgTAP).

### E-05 · Paid peer tutoring
**Spec:** F17, `06` §12, `08` §2.7b.
**Build:** tutor profiles (Mastered-only concepts, price within the configured band, availability); booking; payment into escrow at the licensed partner; session page (lesson, practice set, before/after check); release on confirmation or 24 h auto-release; no-show and dispute rules; commission at release; learning-gain score.
**Done when:** funds never touch an Ifiok account (partner integration test); release happens exactly once per booking; a tutor without Mastered cannot list a concept; refund rules pass tests.

### E-06 · Cash payouts from the contribution pool
**Spec:** `06` §3, §6, §9 (P2b rule).
**Build:** monthly `compute_period`, ring detection, top-earner review, 30-day hold, withdrawals via Paystack Transfer with name match; switched on only when the pool is ≥ ₦250,000 for 2 consecutive months (`app_config.cash_pool_enabled`).
**Done when:** `06` §9 invariants pass; a dry-run month shows each contributor's estimate; a withdrawal below ₦2,000 or within the hold is refused.

**Earn exit check:** money invariants pass on the hosted project; legal review signed off; the first curator and contributor payments made.

---

## Stage 4 · Grow (by usage)

Pick the next ticket from PostHog usage and pilot feedback, one at a time. Candidates (spec and archived ticket in brackets):
- **Spaced review** with FSRS and a "Due now" session (F5-FR3; P1-05).
- **Full learning agent**: goals, adaptive daily plan, triggers (F6; P1-06).
- **Grounded tutor**, if not shipped as the MVP stretch (F1; P1-07; needs OWN-03).
- **Check my working** (snap-and-mark): marks the student's own handwritten steps and names the mistake (F7; P1-10; needs OWN-04).
- **More lab engines**: circuits, titration, logic gates; the 3D PC build with 2D fallback (F4; P1-08, P1b).
- **Lecture preview and recap** (F9 learning parts; push via F16).
- **Push reminders** for the study plan (F16; P1-12).
- **Private textbook matching** (full F3; on-device page matching).
- **Pidgin explanations, WhatsApp nudges** (F14 full).
- Platform: design-system gallery and `check-ui` (P0-05), Cloudflare hosting (P0-02), Lighthouse budgets in CI.

**Not planned (owner decisions):** lecturer accounts and licences (F12, Q39), general study groups (F10, Q40), book downloads, timetable/reminder app, "solve this for me" answers (Q40).
