# 11 · Testing, AI evaluation and quality gates

## 1. Test layers

| Layer | Tool | What it covers | Runs |
|---|---|---|---|
| Unit | **Vitest** | `packages/core` (DSL schema, verifier, chunker), `lib/agent` (planner, mastery, FSRS wrapper), lab models (`components/labs/*/model.ts`), budgets, prompt builders | Every PR |
| Component | Vitest + Testing Library + `jest-axe` | Each lesson block renderer, practice item types, UI kit | Every PR |
| Database | **pgTAP** (`supabase test db`) | Every RLS policy, column grants, `enqueue_job`, ledger invariants, economy functions | Every PR |
| API | Vitest against `supabase start` + route handlers with mocked AI providers | `/api/tutor`, `/api/sync`, `/api/jobs/enqueue`, Paystack webhook | Every PR |
| End-to-end | **Playwright** (Chromium, Pixel 7 viewport; one run on a throttled "Slow 4G" profile) | Sign-up → onboarding → lesson → checkpoint; practice offline; snap flow with a fixture photo; top-up in Paystack test mode (P2) | Every PR (smoke), nightly (full) |
| Performance | Bundle check, Lighthouse CI | Budgets in `02` §7 | Every PR |
| AI evals | `evals/` runner (Vitest-based, real providers, staging) | Skill quality (§3) | PRs touching a skill; weekly full run |

**Coverage targets:** `packages/core` and `lib/agent` ≥ 90% lines; economy SQL functions: every branch has a pgTAP case. No global coverage target for UI.

## 2. Must-have tests (by risk)

### Money (P2)
1. Each `06` §9 invariant as a pgTAP test.
2. Webhook replay ×3 → one credit.
3. Concurrent `spend_units` from two connections against a balance that covers only one → exactly one succeeds.
4. `request_withdrawal` with amount > available → error, nothing posted.
5. A simulated month: seeded revenue, AI cost and usage → payout lines sum ≤ pool; no line > 20%; margin ≤ 0 → pool 0.

### Privacy and access
1. For every table: user B cannot read user A's private rows (generated test that iterates over owner-scoped tables).
2. A lecturer cannot read private lessons, attempts, tutor messages or submissions of students in their course.
3. An under-18 profile receives 403 from every AI route and Edge Function (test loops over the route list).
4. The F3 network test: Playwright records requests during a textbook flow; no request body contains text from unconfirmed pages (use a fixture PDF with a unique marker string on each page).
5. JPEG with GPS EXIF rejected; re-encoded photos have no EXIF.

### Integrity (from the peer review)
1. Clients cannot set `review`, `visibility` or `is_lecturer_source` on `sources`; cannot update `lessons`; cannot write `attempts`, `review_cards` or `screen_events`; can only move a plan task from `planned` to `skipped`.
2. `earn_units` and `record_usage` ignore anything not written by the server (fabricated `lesson_progress` rows earn nothing).
3. Two parallel tutor requests at quota − 1 → exactly one succeeds (`consume_quota`).
4. `enqueue_job`, `match_chunks`, `consume_quota` and every economy function are not executable by `anon`/`authenticated` (except the user-callable ones in `06` §8).
5. Retrieval with 5 courses × 500 chunks returns only visible chunks and still finds the expected chunk (no post-filter starvation).

### Correctness
1. Verifier: property tests (fast-check) that `equivalent(f, expand(f))` is true for random polynomials, and false for `f` vs `f + 1`; `sqrt`/`log` expressions reach 8 valid points; the client AST interpreter agrees with mathjs.
2. Every lesson in `content/` and every published lesson in the seed passes `verifyLesson`.
3. Mastery boundaries (0.30, 0.60, 0.85, the 3-day review rule).
4. Planner determinism: snapshot tests for 12 fixed student states.
5. Lab models: Ohm's law R within ±2% for correct procedure across 50 seeds; every PC build failure mode.

## 3. AI evaluation sets

Stored in `evals/<skill>/cases.jsonl`; expected outputs or rubrics alongside. Real student data never goes into eval sets without consent; build them from authored material and consenting pilot volunteers. **The ground truth is human work (owner tickets OWN-03…05 in `10`); Claude Code builds the runner and must not generate the answers.**

| Skill | Set | Metric | Gate (must pass to merge/promote) |
|---|---|---|---|
| `tutor_chat` | 100 questions across faculties (40 maths/physics with numeric answers; 60 from chemistry, biology, economics, accounting, law, computer science and communication), half with reference chunks; each with a rubric | (a) numeric errors in final answers, (b) rubric score by a grader model + 10% human spot check, (c) citation present when a relevant chunk exists, (d) follows "not from course material" rule, (e) time to first token | (a) **0** in blocks; prose numbers without a source are flagged by the number check, (b) ≥ 90% correct, (c) ≥ 80%, (d) 100% on 10 no-source cases, (e) p95 ≤ 2.5 s without tools, ≤ 4 s with tools |
| `tutor_chat` safety | 15 prompt-injection chunks, 10 off-limits requests (cheating during a timed assessment), 5 crisis messages | Behaves as specified | 100% |
| `lesson_generate` | 30 concepts across faculties (maths, physics, chemistry, biology, economics, accounting, law, computer science, English/communication), half with crowd sources, half without; run on Flash-Lite and Flash; the cheaper model becomes the route per subject where it passes | Passes schema + verification first time; human rubric (accuracy, one idea per screen, interactivity, level fit) 1–5 | ≥ 80% first-pass valid (≥ 95% after one repair); mean rubric ≥ 4.0; zero factual errors found by the reviewer |
| `topic_resolve` | 200 topic strings written the way students type them (course wording, abbreviations, typos, Pidgin-English mixes) with the correct concept or "new", across faculties | Correct match; duplicate concepts created; broad topics caught | ≥ 90% correct; ≤ 5% duplicates; ≥ 90% of broad topics get suggestions |
| `claim_check` | 20 non-STEM lessons with 5 planted unsupported claims each | Planted claims caught; true claims kept | ≥ 90% caught; ≤ 10% true claims removed |
| `outline_draft` | 20 real course outlines (title + level → draft vs the real one) | Topic overlap with the real outline (human judged) | ≥ 70% of real topics present; 0 invented course facts (dates, lecturers) |
| `items_generate` + `item_solve` | 10 topics, with 50 items hand-checked by a reviewer | Items surviving both checks; duplicates; difficulty spread; **wrong answer keys among auto-published items** | ≥ 70% auto-publish; ≤ 5% near-duplicates; **0** wrong keys in the hand-checked sample |
| `transcribe_working` | 40 handwritten photos (varied handwriting, lighting, paper), ground-truth LaTeX (OWN-04) | Line accuracy (equivalence per line), confidence calibration. **Run on Flash-Lite and Flash**; Flash-Lite becomes the route if it passes | ≥ 92% line accuracy after confirmation; lines with confidence ≥ 0.75 are correct ≥ 97% |
| snap-and-mark end-to-end | same 40 + 10 fully correct solutions (including squaring, substitution, `let u = …` and `= …` continuation lines) | First-error localisation; `wrong` outcomes on correct work; share of lines `unchecked` | ≥ 85% localisation; **0** `wrong` steps on correct solutions after confirmation; ≤ 15% of maths lines `unchecked` |
| `explain_error` | 30 flagged steps | Tag in vocabulary; hint helpful (rubric) | 100% valid tags; ≥ 80% helpful |
| `exam_extract` (P2) | 10 past papers | Question boundaries and marks | ≥ 90% |
| `exam_classify` (P2) | 200 labelled questions | Top-1 accuracy at confidence ≥ 0.6 | ≥ 85% |
| `curate_classify` (P1, OWN-09) | 60 uploads (on/off topic, textbook pages, duplicates, injections, uploads containing names, phone numbers and matric numbers) | Correct decision; concept tags; personal data left in approved chunks | ≥ 90%; **0** personal-data items left; 100% of textbook pages not auto-approved |
| `teach_back_check` | 30 student explanations with human labels | Agreement on ideas covered | ≥ 80% |

**Rules**
- An eval run has a hard **$2** budget (gateway global cap set per run).
- A prompt or model change merges only if its skill's gates pass and no gate in the same skill drops by > 2 points.
- Promote a cheaper model for a skill only after it passes the same gates twice in a row.
- Grader-model scores are checked by a human on a 10% sample every week during the pilot; disagreement > 10% → fix the rubric before trusting scores.

## 4. Pilot quality monitoring (P1)
- Lesson flags confirmed as "wrong" per 1,000 lesson screens (target < 1% of blocks, `00` §7).
- Tutor thumbs-down rate and reasons; weekly review of 30 random tutor threads by the owner (with consent at signup for quality review of anonymised samples).
- Snap-and-mark disputes ("This mark is wrong") reviewed within 48 hours during the pilot.
- AI cost per WAL per week against `09` §5.

## 5. Definition of done (every ticket)
1. Ticket "Done when" checks pass.
2. New code has tests in the right layer; CI is green.
3. No new table without RLS and a pgTAP test.
4. Bundle and Lighthouse budgets hold.
5. UI changes follow `07` and pass `check-ui` and axe.
6. Any spec deviation is written in `12-review-log.md`.
