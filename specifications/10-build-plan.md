# 10 · Build plan (tickets for Claude Code)

> **Until the MVP ships, build in the order of [`10a-mvp-plan.md`](10a-mvp-plan.md)** (owner decision, `12` §4 Q38). This file remains the reference for tickets not listed there.

**How to use:** build tickets in order. Each ticket is sized for one to three Claude Code sessions. Start each session with:

> Read CLAUDE.md and specifications/10-build-plan.md. We are on ticket P1-07. Read the spec sections it lists, then implement it with tests. Stop when every "Done when" check passes, and tell me which files changed.

**Ticket format:** `ID · Title` → **Spec** (sections to read) · **Build** (main files) · **Done when** (acceptance checks; all must pass). "Feature AC" means the acceptance criteria of that feature in `01`.

**Two kinds of ticket:**
- **Build tickets** (P0-xx, P1-xx, P2-xx) are for Claude Code.
- **Owner tickets** (OWN-xx) are human work: real data, people, legal steps. They block the build tickets listed with them. **Claude Code must never invent ground-truth data** (eval answers, handwritten photos, scheme documents, prices from a provider) to get past an owner ticket. It builds the tooling and stops.

**Rules for every build ticket**
- Add or update tests in the same ticket (`11`). A ticket is not done with failing or skipped tests.
- Any new table gets RLS and a pgTAP test **in the same migration**.
- Never change a spec decision silently. If the spec is wrong or unclear, write the question in `12-review-log.md` §4 and pick the safer option.
- Keep the performance budgets (`02` §7) and the anti-slop rules (`07` §3.4).

---

## Phase P0 · Foundations (no users)

### P0-01 · Repository scaffold
**Spec:** `02` §1, §3, §9, §10 · `CLAUDE.md`
**Build:** Next.js (App Router, TypeScript strict, layout as in `02` §3; version pinned to what `@opennextjs/cloudflare` supports), pnpm workspace with `packages/core`, ESLint (+ `eslint-plugin-jsx-a11y`), Prettier, Vitest, Playwright, `lib/env.ts` (zod), `.github/workflows/ci.yml` with path filters (`02` §10). Decide Serwist + Turbopack vs webpack build and record it in `12` §4.
**Done when:** `pnpm check` passes locally and in CI; booting with a missing env var fails with a clear message.

### P0-02 · Deploy to Cloudflare
**Spec:** `02` §1 (hosting), §7 · `09` §2
**Build:** `@opennextjs/cloudflare` adapter, `wrangler.jsonc` (Smart Placement on), `open-next.config.ts`, preview deploy workflow, `scripts/check-bundle.ts` (route budgets from `02` §7; fails CI when exceeded).
**Done when:** a preview URL serves the app; `pnpm build:cf` succeeds in CI; the bundle check runs on every PR.

### P0-03 · Core schema with RLS
**Spec:** `03` §1–§5, §8 (helpers and the policies for these tables), §9 · `08` §2.1–§2.2 · `checks/`
**Build:** migrations `base`, `people_courses`, `content`, `learning`, `platform` (sections `0001`–`0005` of `03`, each with its own RLS policies and grants; create with `supabase migration new`), `match_chunks`, `supabase/seed/00_universities.sql`, generated types `lib/supabase/types.ts`, pgTAP files ported from `specifications/checks/tests.sql`, CI query that fails if any `public` table has RLS disabled.
**Done when:** `supabase db reset` runs clean; all ported pgTAP tests pass, including: a lecturer cannot read a student's private lesson or chunks; clients cannot set `review`/`visibility`/`is_lecturer_source` on sources, update lessons, write attempts or review cards, or call `consume_quota`, `enqueue_job`, `match_chunks` or `post_txn`; `is_admin()` is false without `aal2`; 3 flags hide a block; a shared lesson is readable by a student at another university; clients cannot create courses, topics or concepts directly; approved crowd chunks are visible across universities and course-only chunks are not.

### P0-04 · Auth, age gate, consents
**Spec:** F0 · `08` §2.1, §3 · `07` §1 (voice)
**Build:** `app/(auth)/sign-in`, `app/(auth)/onboarding/*` (DOB first), `middleware.ts` (session refresh), Turnstile, server action `completeOnboarding` (service role sets `birth_*`, `is_adult`), under-18 path (delete auth user + profile at once; show the parent/guardian contact line; collect nothing), consent rows, `requireUser()` / `requireAdult()` / `requireAdmin()` helpers.
**Done when:** an under-18 sign-up leaves no rows in `auth.users`, `profiles` or any other table (test); a non-adult profile gets 403 from a stub AI route; Playwright: Google (mocked) and email-code sign-in reach an **empty Today** in ≤ 12 taps.

### P0-05 · Design system foundation
**Spec:** `07` §3 (tokens, type, shape, icons), §3.4, §6, §7
**Build:** `app/globals.css` (`@theme` tokens incl. `--bench-*`, light/dark/manual), `next/font` (Bricolage Grotesque, Atkinson Hyperlegible Next, JetBrains Mono), `components/ui/*` (Button, IconButton, Sheet, Chip, Field, Tabs, SegmentedControl, ListRow, Banner, Skeleton, InkLine), `app/dev/ui/page.tsx` (dev-only gallery), `scripts/check-ui.ts`.
**Done when:** the gallery shows every component in light, dark and Bench; axe finds no violations; a contrast script confirms every token pair in `07` meets its stated ratio; `check-ui` fails on banned patterns (gradient utilities, `uppercase` with `tracking-*`, emoji in `components/**`, `shadow-*` on Page components, sparkle icons, hard-coded hex colours outside `globals.css`).

### P0-06 · App shell and navigation
**Spec:** `07` §4, §5.1 (states), §6
**Build:** `app/(app)/layout.tsx` (bottom nav: Today · Courses · Practice · Me), "Ask Ifiok" button (empty sheet for now), empty states with the Ink Line, offline banner hook.
**Done when:** navigation works with keyboard and screen reader; each tab has its empty state; Lighthouse mobile performance ≥ 90 on Today (empty).

### P0-07 · Lesson DSL schema and expression tools
**Spec:** `05` §1–§4, §6 (allow-list)
**Build:** `packages/core/dsl/schema.ts` (zod; `zod/mini` client build), `packages/core/expr` (allow-list AST walk, `ln`→`log`, length/depth caps, compile to AST JSON), `packages/core/expr-eval` (~3 KB client interpreter for AST JSON), `content/fixtures/*.json` (the `05` §7 example expanded to 6 screens, one fixture per block type, 10 invalid fixtures including LaTeX `\f`/`\t` control-character and `\neq`-as-newline cases), `scripts/validate-dsl.ts`.
**Done when:** valid fixtures pass, invalid ones fail with readable errors; the interpreter matches mathjs on 500 random allowed expressions; forbidden constructs are rejected; CI runs the validator.

### P0-08 · Maths verifier
**Spec:** `05` §4 (two checks), §6 · `04` §4.1 (tools)
**Build:** `packages/core/verify/*` (`equivalent` with the 8-valid-points rule, step checking with `ok`/`wrong`/`unchecked`, `checkDerivative`, `checkAntiderivative`, `checkDefiniteIntegral`, `checkPlot`, `checkQuote`, `latexToMathjs`), `packages/core/verify/tools.ts` (tutor math tools), `verifyLesson(spec, chunks)` (also renders KaTeX to `html` and compiles plot `compiled` ASTs).
**Done when:** unit and property tests pass (`11` §2); the example verifies; `2x + h → 2x + 2h` is `wrong`; `x = 2 → x² = 4` is `ok` (implication); `x² = 4 → x = 2` is `wrong` (root lost); `x² = 4 → x = 2 or x = -2` is `ok`; `let u = x²` is `unchecked`; `sqrt(x)` equivalence is `true`, not `unknown`.

### P0-09 · Lesson player and block renderers
**Spec:** `05` §2–§5 · `07` §5.3, §6, §7
**Build:** `components/lesson/*` (one lazily loaded component per block type; `math` renders stored KaTeX HTML; `plot` uses Mafs + `expr-eval`; MathLive only for `expression` items), `components/lesson/Player.tsx`, `app/(app)/learn/[lessonId]/page.tsx` (fixtures until P1-02), unknown-block fallback.
**Done when:** every fixture renders; Continue stays disabled until the interactive block is touched; checkpoint feedback works for each item type; an unknown block renders the fallback and logs to Sentry; the lesson shell is ≤ 200 KB gz and each block chunk within `02` §7.

### P0-10 · AI gateway and budgets
**Spec:** `04` §1–§5, §8 · `03` §5 (`ai_calls`, `daily_usage`, `consume_quota`, `app_config`) · `09` §6
**Build:** `lib/ai/gateway.ts`, `lib/ai/providers/{gemini,anthropic}.ts` (fetch-based), `lib/ai/skills/index.ts`, `lib/ai/budgets.ts`, `lib/config.ts` (`app_config`, 60 s cache), seed `app_config` (routes with thinking levels, prices with `effective_from`, quotas, caps, `economy_enabled = false`, kill switches).
**Done when:** with mocked providers: minors and kill-switched skills blocked; parallel requests can't exceed a quota (race test); a failed call refunds the quota; the global cap switches off non-essential skills; invalid JSON or control characters trigger one repair retry, then fail; fallback provider used after a 5xx; every call writes `ai_calls` with thinking tokens and cost.

### P0-11 · Job system
**Spec:** `02` §4 · `03` §5 (`jobs`, `enqueue_job`)
**Build:** migration `jobs_runtime` (pgmq queues, `pg_net` trigger, `pg_cron` sweeper), `supabase/functions/worker/index.ts` + `handlers/` (130 s deadline, batch sizes per queue, visibility timeout 180 s, retries), `/api/jobs/enqueue` (allow-list, 30/day, owner from session), `noop` handler, `useJob(jobId)` (Realtime with polling fallback).
**Done when:** same `dedupe_key` twice → one job; a failing handler ends `failed` after 3 attempts; the sweeper picks up a job whose trigger was dropped; a crashed run reappears after the visibility timeout; a user can't enqueue to `payouts`.

### P0-12 · Embeddings and retrieval
**Spec:** `02` §1 (embeddings) · `03` §9 · `04` §6
**Build:** `supabase/functions/embed` (gte-small, batches ≤ 16), `packages/core/chunk.ts` (≤ 350 word-pieces, 50 overlap, page-aware), `lib/ai/retrieve.ts` (always passes the session user id; lint rule bans request-body user ids there).
**Done when:** on a fixture of 5 courses × 500 chunks, the top-6 for 20 test queries include the expected chunk ≥ 85% of the time; user A's private chunks never return for user B; p95 retrieval < 300 ms on Supabase Free.

### P0-13 · Admin minimum
**Spec:** F15 · `07` §5.10 · `08` §2.1
**Build:** `app/(admin)/admin/*` (MFA enrolment gate, config editor with zod per key, AI spend today/by skill/top users, audit log), `lib/admin/audit.ts`, `/api/lessons/:id` (edit, publish gate, audit) stub.
**Done when:** non-MFA admins are redirected; every admin write creates an `admin_audit` row; config edits apply within 60 s.

### P0-14 · Security, observability, backups
**Spec:** `08` §2.3, §2.4, §2.9, §2.10, §10 (P0)
**Build:** security headers and CSP (report-only), Sentry (scrubber), PostHog (UUID only), Cloudflare WAF rule on auth and webhook paths (documented in `docs/ops/cloudflare.md`), `.github/workflows/backup.yml` (`supabase db dump` via session pooler → `age` → R2), service-role grep check.
**Done when:** the P0 security checklist (`08` §10) passes; a restore from a backup into a local database works.

**P0 exit check:** CI green; a new adult user signs up, opens a fixture lesson, answers a checkpoint; an under-18 sign-up leaves nothing; an admin with MFA sees mock AI spend.

---

## Owner tickets for P1 (start during P0)

| ID | Task | Blocks |
|---|---|---|
| OWN-01 | Launch community: 1–2 universities and their course reps to invite the first students (any course or topic); collect 20 real course outlines (photos/PDFs) across faculties for the `scheme_extract` and `outline_draft` evals | P1-01 |
| OWN-02 | Recruit optional curators for the busiest subjects (volunteer TAs/lecturers or paid per checked lesson); lessons don't wait for them | P1-02 (not blocking) |
| OWN-03 | Tutor eval set: 100 questions across faculties with rubrics (`11` §3); 15 safety cases | P1-07 |
| OWN-04 | 40 handwritten-working photos + 10 fully correct solutions, with ground-truth LaTeX, from consenting volunteers | P1-10 |
| OWN-05 | Lesson eval: 30 concepts across faculties with and without sources; human rubric scoring; 200 topic strings with correct concepts for `topic_resolve` | P1-01, P1-02 |
| OWN-06 | NDPC Ordinary-High registration, DPO contact, privacy notice and terms reviewed | P1 exit |
| OWN-07 | Hand-check 50 generated items; build the `explain_error` set (30 flagged steps with correct tags) | P1-04, P1-10 |
| OWN-08 | Teach-back set: 30 student explanations with human labels | P1-18 (P1b) |
| OWN-09 | Curation set: 60 uploads (on/off topic, textbook pages, duplicates, prompt injections, documents with names, phone and matric numbers); list of sensitive subjects; curators for each sensitive subject before it opens | P1-03b, P1-02 |

The P1a exit evaluates only P1a skills; P1b skills are gated at their own tickets.

---

## Phase P1a · Closed pilot core

### P1-01 · Student-created courses, outlines and concepts
**Spec:** F2-FR1–FR3 · F0-FR4 · `03` §2 (`courses`, `concepts`, `topics`, `outline_revisions`, `concept_follows`, `course_terms`) · `04` §4.5b · `07` §5.1b · `08` §2.5b · **evals need OWN-01, OWN-05**
**Build:** `/api/courses` (search, create with normalised code, near-duplicate prompt, moderation, 5/day), `/api/courses/:id/outline` (upload/photo → `scheme_extract` → confirm; typed topics; `outline_draft`; wiki edits with `outline_revisions`, revert, lock), `topic_resolve` skill + SQL candidate search (embedding similarity by subject and level), `/api/learn` for free-standing topics (`concept_follows`), the "What do you want to learn?" screen, outline editor UI, course calendar (`course_terms`), `subjects` seed and `app_config.level_bands`, abuse rules from `08` §2.5b (edit eligibility, confirmations, unlisted concepts), admin merge tools using `merge_concepts` / `merge_courses`, micro-skill vocabularies (`supabase/seed/20_micro_skills.sql`, starting with maths and physics; other subjects use concept titles until vocabularies are added).
**Done when:** a student creates a course, gets an outline three ways and edits it; a second student at the same university is offered the existing course instead of a duplicate; the same topic typed in two courses at two universities resolves to one concept; "Physics" returns narrower suggestions; a blocked name never creates a course or concept; a locked outline rejects student edits; an edit from a 1-day-old account waits for confirmation; merging two concepts keeps each student's best mastery (pgTAP); `topic_resolve` meets its eval gate and per-subject thresholds are recorded.

### P1-02 · On-demand lesson generation, publishing and the quality loop
**Spec:** F2-FR4–FR8 · `04` §4.2, §5 · `05` §3, §6
**Build:** `lesson_generate` skill + prompts (outline, blocks), worker handlers (outline → blocks → verify → publish), job dedupe per concept, `new_lesson` quota (charged only on a new job, refunded on failure), library budget and queue-until-tomorrow path, sources only via `shared_lesson_sources`, `claim_check` for non-STEM lessons, curator-first publishing for sensitive subjects, waiting UI (step list + labelled quick explainer), automatic publishing on pass with `trust = 'new'` labels, `trusted` promotion job (completions and flag rate), curator queue and editor (`app/(admin)/curate/*`: flagged and new lessons by subject, block JSON editor with live validation, unchecked numbers highlighted), `/api/lessons/:id` (verification gate, checkpoint materialisation into `items`, `concepts.current_lesson_id`, supersede, audit), refresh job (new crowd sources or confirmed flags), optional `scripts/warm-cache.ts` (Batch API).
**Done when:** Feature AC F2 pass; a shared lesson's `source_refs` never include private, course-only or past-paper chunks (test); a law lesson is not shown before a curator approves it; a second request for the same concept makes no AI call; two simultaneous first requests create one job; a lesson failing a check is never shown and the student gets the explainer and a retry; a curator can fix lessons in their subject only; v1 stays readable after v2; the `lesson_generate` eval picks the model per subject.

### P1-03 · Courses, Path, progress and invites
**Spec:** F5-FR6 · F0-FR7 · `07` §5.2
**Build:** `app/(app)/courses/*`, `components/app/PathMap.tsx` (Ink Line; open circles for not-yet-built lessons), followed-topics list, end-of-lesson summary with mastery change, block "⋯" menu (flag, ask about this), `/join/[code]` invite links with WhatsApp share and OG card.
**Done when:** a student joins via an invite link, sees the Path with mastery levels as text, completes a lesson and sees the Ink Line advance (static under reduced motion); mastery earned in one course shows in another course that maps to the same concept; flagged blocks disappear after 3 flags.

### P1-03b · Crowd uploads and curation (no rewards yet)
**Spec:** F11-FR1–FR3, FR5–FR6 · `08` §2.5, §2.5b, §8 · `07` §5.8
**Build:** upload flow (course or course-free), `submit_to_bank`, `curate` handler (checks, concept tagging, personal-data stripping, decision with reason), admin bank queue, licence attestation, `/takedown` form, chunks feed `match_chunks` and lesson refreshes.
**Done when:** an approved upload is retrievable by the tutor for a student at another university studying the same concept, but that student can't list or read it directly (only cited snippets via `/api/citations/:chunk_id`); `curate_classify` meets its gate (OWN-09) with zero personal data left; rejected uploads always give a reason; for the first 2 weeks everything routes to `needs_review`; duplicate detection catches re-uploads.

### P1-04 · Practice items and server sync
**Spec:** F5-FR1–FR4 · F6-FR6 · `04` §4.3 · `05` §4, §6 · `02` §6
**Build:** `items_generate` skill + `items_gen` handler (per concept, lazy: 10 on first practice, up to 30; two independent checks, `review` → auto-publish), item review queue, `components/practice/*`, `app/api/sync/route.ts` (attempts and screen events: re-grade, save, update mastery, review cards, `daily_activity`, task completion), `lib/agent/mastery.ts`.
**Done when:** items failing either check never auto-publish; a forged `correct: true` is stored as wrong; mastery boundary tests pass; replaying the same UUIDs creates one row each; client clocks are clamped; screen events are rejected when the lesson isn't published/superseded, the `screen_id` isn't in the spec, the user neither is enrolled in a course whose outline maps to the lesson's concept nor follows that concept, screens arrive out of order, they come < 5 s after the user's previous event, or a checkpoint screen has no attempt.

### P1-05 · Spaced review
**Spec:** F5-FR3 · `03` §4 (`review_cards`)
**Build:** `lib/agent/fsrs.ts` (ts-fsrs wrapper), card creation rules (wrong answers, one per micro-skill at Proficient), Practice "Due now" session.
**Done when:** scheduling matches ts-fsrs for 20 synthetic histories; a simulated month of daily practice keeps due cards under 40/day; due counts on Practice and Today agree.

### P1-06 · Planner and Today
**Spec:** F6 · `07` §5.1 · `03` §4 (`goals`, `plan_tasks`, `plan_events`), §2 (`course_terms`)
**Build:** `lib/agent/planner.ts` (pure: state → tasks with reasons), `lib/agent/triggers.ts`, plan built lazily on the first Today load of the (Lagos) day, goal setup UI, morning brief template, `app/(app)/today/page.tsx`, skip action.
**Done when:** Feature AC F6 pass; F0's "runnable task within 12 taps" now passes end to end; same inputs → same plan; p95 plan build < 200 ms; every task shows its "why"; "current week" follows a `current_week_override`.

### P1-07 · AI tutor
**Spec:** F1 · `04` §4.1, §5–§7 · `07` §4 · **blocked by OWN-03**
**Build:** `app/api/tutor/route.ts` (prose stream + held-back `ifiok-blocks` section + `blocks` event), `tutor_chat` skill + prompt, tool loop (≤ 2 rounds), server pre-computation, number check, block verification (drop on failure), `tutor_threads`/`tutor_messages` writes, Ask Ifiok sheet (course picker, quota counter, citations, Explain differently / Simpler / Deeper, "Not from your course material"), P1 quota message, crisis template, keyword moderation.
**Done when:** Feature AC F1 pass on the eval set; quota counter matches `daily_usage`; a prompt-injection chunk does not change behaviour; the crisis fixture returns the template.

### P1-08 · Lab engine and 2D labs
**Spec:** F4 · `05` §8 · `07` §5.4
**Build:** `components/labs/registry.ts`, `ohms-law/{model.ts,Lab.tsx,TextMode.tsx}` (port of the prototype), `simple-pendulum/{model.ts,Lab.tsx,TextMode.tsx}`, `sim` block integration, `lab_runs`, print-to-PDF report stylesheet.
**Done when:** Feature AC F4 for both labs; `model.ts` tests reproduce readings from a seed; pendulum: g within ±3% for a correct procedure over 50 seeds; labs work offline after first load; text mode completes each practical.

### P1-09 · Diagnosis and remediation
**Spec:** F7-FR9 · F6-FR3
**Build:** error-tag aggregation, foundation micro-lesson library (seeded `kind = 'micro'` lessons for the top 20 micro-skills, reviewed), planner trigger.
**Done when:** 3 tagged errors in 14 days insert a remediation task with a reason (test); micro-lessons are published and verified.

### P1-10 · Snap-and-mark
**Spec:** F7-FR1–FR8 · `04` §4.4–§4.5 · `05` §6 · `07` §5.5 · `08` §2.5 · **blocked by OWN-04**
**Build:** `app/(app)/snap/*` (capture, crop, canvas re-encode), upload to `submissions`, `mark_transcribe` and `mark_verify` handlers, `/api/snap/:id/confirm`, confirmation editor (MathLive), result screen with `ok`/`wrong`/`unchecked`, "Practise this", 7-day photo deletion cron. Run the transcription eval on Flash-Lite and Flash; set the route by the result.
**Done when:** Feature AC F7 pass on the eval set; a JPEG with GPS EXIF is rejected; no correct solution gets a `wrong` step after confirmation; the chosen transcription model is recorded in `12`.

### P1-11 · Offline and data saver
**Spec:** F14 · `02` §6
**Build:** service worker (app shell), Dexie schema, "Pin for offline" (lesson JSON, items, lab chunk), outbox to `/api/sync`, data-saver mode.
**Done when:** Feature AC F14 pass in Playwright with the network offline; attempts sync exactly once.

### P1-12 · Web push
**Spec:** F16 · `08` §2.3
**Build:** VAPID keys, `push_subscriptions`, `notify` handler, settings toggles, quiet hours, max 3/day.
**Done when:** the plan reminder arrives on Android Chrome; nothing is sent in quiet hours (fake clock).

### P1-13 · Landing and legal pages
**Spec:** `07` §5.11, §3.4 · `08` §4
**Build:** `app/(marketing)/page.tsx` (live mini-lesson hero using the real plot block), privacy notice, terms, AI disclosure page.
**Done when:** the hero is draggable on a phone and renders a static figure without JS; Lighthouse mobile ≥ 90; legal pages linked from sign-up.

### P1-14 · Privacy self-service
**Spec:** `08` §5–§6
**Build:** Settings → Privacy (export, delete account, consents), `export-data` and `delete-account` functions, retention crons.
**Done when:** export contains every listed table; deletion (P1 branch: no ledger entries) removes all rows and storage objects (test).

### P1-15 · Pilot metrics
**Spec:** `00` §7 · `09` §8
**Build:** PostHog events (signup, onboarding_done, course_created, concept_requested, lesson_done, checkpoint_correct, invite_joined), admin metrics page from SQL (activation, WAL from `daily_activity`, D30, mastery gain, `c` per WAL and library cost `L` from `ai_calls`, library reuse rate, courses and concepts created).
**Done when:** each P1 metric in `00` §7 is visible for the last 7 and 30 days.

**P1a exit check (pilot opens):** Feature AC for F1, F2, F4 (2D), F5, F6, F7, F14 pass; evals meet `11` §3; a student can go from sign-up to a lesson for a course or topic that has never been on Ifiok before, without any admin action; P1 security checklist (`08` §10) passes, including NDPC registration (OWN-06); DPIA written; budget guards at P1 values.

## Phase P1b · Pilot extensions (after P1a exit)

### P1-16 · Textbook to private lessons
**Spec:** F3 · `08` §8
**Build:** `lib/pdf/worker.ts` (range reads, text + outline per page, BM25 matcher, pause/resume), confirmation UI, private lesson generation (owner-only), OCR for confirmed scanned pages, monthly quota.
**Done when:** Feature AC F3 pass, including the network test that no request contains text from unconfirmed pages; RLS proves private lessons are owner-only.

### P1-17 · PC build 3D lab
**Spec:** F4 · `05` §8 (3D guidelines)
**Build:** `components/labs/pc-build/*` (R3F port, rules in `model.ts`), 2D fallback, device check, `/lab/pc-build` route split.
**Done when:** every failure mode in F4-AC reproduces in 3D and 2D; chunk ≤ 650 KB gz; no memory growth over 5 enter/exit cycles.

### P1-18 · Teach-back (text)
**Spec:** F5-FR5 · `04` §4.7
**Build:** teach-back screen (from the lesson end and the planner), `teach_back_check` skill.
**Done when:** results are labelled as AI estimates; a probing question always returns; counts as a hard attempt.

### P1-19 · Willingness-to-pay test
**Spec:** `09` §5 · `00` §5 (P1b)
**Build:** a price page with the three bundles and "Notify me when this is live" (no charges), shown when a free quota runs out; events for views and taps.
**Done when:** the admin metrics page shows the share of active learners who tapped a bundle, by bundle.

---

## Phase P2 · Paid launch "Earn"

**Gate before P2-03:** business registered (CAC), Paystack business verified, Supabase Pro active, accountant has reviewed Units and VAT (`06` §10), the pilot measured `c` and the willingness-to-pay share (`09` §5).

### P2-01 · Move to Supabase Pro
**Done when:** prod is on Pro; managed backups visible; the R2 dump continues; a restore drill is documented.

### P2-02 · Ledger and economy functions
**Spec:** `06` §1–§9 · `03` §6 · `checks/tests2.sql`
**Build:** migrations `economy` and `economy_functions` (with their RLS and explicit grants), pgTAP files.
**Done when:** every `06` §9 invariant is proved, including concurrent spends never overdrawing, reserve/refund symmetry, and chargeback reversal.

### P2-03 · Top-ups and wallet
**Spec:** `06` §2, §6 (top-up), §7 · `07` §5.7 · `08` §2.7
**Build:** `/api/topup/init`, `/api/topup/status`, `/api/paystack/webhook`, reconciliation cron, `app/(app)/wallet/*`, `economy_enabled = true`.
**Done when:** a test-mode top-up credits Units once even when the webhook is sent 3 times; a bad signature returns 401 and changes nothing; an amount mismatch is rejected and alerted.

### P2-04 · Spending and earning Units
**Spec:** F13 · `06` §2 · `04` §2, §5
**Build:** gateway reserves Units beyond quotas and refunds on failure; `earn_units` hooks reading server evidence; monthly cap; expiry cron; P2 allowances in `app_config`.
**Done when:** quota → Units handover works for tutor, marking, private lessons, mocks; earning stops at 40/month; a failed AI call refunds its Units.

### P2-05 · Resource Bank rewards
**Spec:** F11-FR4 · F13 · `06` §2, §4
**Build:** Units for approved uploads and for qualified consumers of them, "My contributions" earnings view, past papers used as extracted questions only (exam map).
**Done when:** Feature AC F11 pass; upload rewards respect the monthly earn cap.

### P2-06 · Usage tracking and contributions
**Spec:** `06` §4
**Build:** `record_usage` from server evidence (attempts on derived items, screen events citing a source), "My contributions" page, +1 Unit per qualified consumer per month, dry-run monthly `compute_period`.
**Done when:** self-use and unqualified consumers record nothing; dedupe holds per month; the dry-run pool appears in admin.

### P2-07 · Lecturers
**Spec:** F12 · `07` §5.9
**Build:** lecturer verification, course claims, notes upload (shareable by default), lesson review access via `/api/lessons/:id`, class insight views (`security definer`, n ≥ 5 suppression), licence agreement record and monthly manual payment log.
**Done when:** Feature AC F12 pass; RLS proves lecturers can't see student-level rows.

### P2-08 · Exam mode
**Spec:** F8
**Build:** paper upload → `exam_extract` → review table → `exam_classify` → exam map → style clusters → mock builder (CBT and written).
**Done when:** Feature AC F8 pass; no UI string says "predicted" or "likely to appear" (copy lint).

### P2-09 · Course space
**Spec:** F9 · F16
**Build:** timetable (class and personal, `week_range`), preview/recap scheduler from `course_terms`, rep broadcasts, email digest.
**Done when:** Feature AC F9 pass with a fake clock.

### P2-10 · Admin, full
**Spec:** F15
**Build:** all queues, reports, ⌘K command menu, weekly audit review view.
**Done when:** every admin action is audited; queues show counts and ages.

**P2 exit check:** economy invariants pass; one real ₦500 top-up done end to end in production; NDPC tier correct for the user count; P2 security checklist passes.

### P2b · Automatic contributor cash pool (only when `06` gate is met)
P2-11 payout cycle (`compute_period`, ring detection, `approve_period` with MFA, `release_earnings`), P2-12 payout recipients (legal name + resolve + match) and withdrawals (transfers, webhooks, levies), P2-13 `convert_earnings`. **Done when:** a simulated month respects the 20% cap and pool ≤ margin; a failed transfer returns funds; one real ₦2,000 withdrawal completes in production.

---

## Phase P3 · Growth (plan when P2 metrics are known)
Study groups (F10), "Show me this" reader (F9-FR5), voice teach-back, theory/essay marking, more labs (supply–demand, trial balance, titration, logic gates, moot court), Pidgin explanations, WhatsApp nudges, sponsor pools (`06` §11), department dashboards and lab licences, lecturer recordings (F12-FR6, `08` §9). Each gets its own short spec section and tickets before work starts.
