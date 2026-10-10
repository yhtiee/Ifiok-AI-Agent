# 12 · Review log, risks and open questions

This file records how the spec was checked, what was found and what changed. Keep adding to it while building.

## 1. Review method
1. **Author self-review** against the brief: buildable by Claude Code on Next.js + Supabase, cheapest viable launch, real value to students, non-generic brand.
2. **Executable checks:** schema loaded into PostgreSQL 16 + pgvector; RLS and ledger behaviour tested with pgTAP; example lesson maths checked with mathjs (`checks/`).
3. **Fact checks** of prices, limits and terms against provider pages (sources at the end).
4. **Independent peer review** by a separate reviewer who had not seen the drafting, with instructions to be strict about feasibility, cost, contradictions, gaps and buildability (§3).

## 2. Self-review findings (fixed)

| # | Finding | Severity | Fix |
|---|---|---|---|
| S1 | `lessons` RLS let a course lecturer read and edit students' **private** textbook lessons (`is_course_lecturer(course_id)` matched private rows too). | Critical (privacy) | Lecturer/admin access limited to shared lessons (`owner_id is null`). Tested. |
| S2 | No table for tutor conversations, though F1 persists messages. | High (gap) | Added `tutor_threads`, `tutor_messages` with owner-only RLS; writes by server only. |
| S3 | Clients could insert `attempts` with `correct: true`; mastery feeds Units and lecturer insight. | High (integrity) | Attempts go through `/api/sync`, which re-grades objective items; RLS is read-only for clients. Tested. |
| S4 | Protected profile columns relied on an unspecified trigger. | Medium | Column-level grants: clients can update only safe columns. Tested. |
| S5 | `post_txn` could deadlock (locks in entry order), could fail mid-transaction on a debit-then-credit sequence, and had a race on the idempotency key. | High (money) | Lock all accounts in id order first; check balances after all entries; `on conflict do nothing` idempotency. Tested. |
| S6 | Supabase grants EXECUTE on new functions to `anon`/`authenticated` by default. | High (money) | Every economy function revokes defaults explicitly (rule in `03` §6 and `CLAUDE.md`). |
| S7 | Admin powers protected only by password/OTP. | High | `is_admin()` requires the MFA claim `aal2`. Tested. |
| S8 | Account deletion would fail for users with ledger rows (`on delete restrict`), and NDPA erasure conflicts with financial record keeping. | Medium | Two-branch deletion (`08` §6): full delete without ledger rows; anonymise + content delete + ban with ledger rows. Added `deleted` status. |
| S9 | Per-user AI ceiling ($0.10) contradicted the free quotas (worst case ≈ $0.65), and the pilot global cap ($5/day ≈ $150/mo) contradicted the pilot budget. | Medium (cost) | P1 ceiling $0.30, global $2/day; P2 values in `09` §5–§6. |
| S10 | Unit economics: at P1 free allowances (~₦300 per active learner) Ifiok loses money at any scale. | High (viability) | `09` §5 break-even model; P2 free allowances cut to target ≤ ₦100–120 per learner; P2 is gated on measured pilot cost and paying share. |
| S11 | 30-day photo retention would exceed Supabase Free's 1 GB storage in the pilot. | Medium | 7-day retention. |
| S12 | Nightly $2 eval runs would cost ~$60/month, more than the pilot's AI budget for learners. | Medium (cost) | Evals on PRs that touch a skill plus a weekly full run. |
| S13 | F1 output contract and tool names differed between `01` and `04`; F7 used a different parser and sampling than `05`. | Low (consistency) | Aligned to `04` §4.1 and `05` §6. |
| S14 | "Restricted mathjs" by disabling functions would also break the verifier's own `derivative`/`simplify`. | Medium | AST allow-list walk before compiling untrusted expressions; length and depth caps. |
| S15 | Groups (P3) had no RLS; posts could self-accept answers (Units). | Medium | Group policies added; authors can update only `body`. |
| S16 | Migration filenames `0001…0009` conflicted with phase order (economy is P2) and Supabase's timestamped migrations. | Low | Section numbers are names; append-only timestamped migrations in phase order. |
| S17 | The Today wireframe used an emoji, against the anti-slop rules. | Low | Replaced with text. |

## 3. Independent peer review (42 findings)

A separate reviewer read every file cold, measured bundle sizes with esbuild, computed contrast ratios, and checked platform limits and NDPC rules. Verdict before fixes: "not ready to build as written; P0 buildable after R1–R13; P1 needs a scope cut; P2's economy needs a redesign." Every finding below was resolved or explicitly decided.

| ID | Sev | Finding (short) | Resolution |
|---|---|---|---|
| R1 | Critical | Uploaders could self-approve sources into the bank (no column limits) and earn 2× points | Column grants + insert check (`03` §8); `submit_to_bank` RPC; pgTAP tests pass |
| R2 | Critical | 170 KB lesson budget impossible (KaTeX, mathjs, MathLive, Mafs, zod sizes) | KaTeX pre-rendered at save; plot ASTs + 3 KB interpreter; per-block lazy loading; `zod/mini`; KaTeX pinned to Mafs; budgets reset (`02` §7, `05` §3, §5) |
| R3 | High | Worker read 3 messages × 120 s inside a 150 s / 2 s-CPU invocation | 1 message per heavy job, 130 s deadline, vt 180 s, split steps (`02` §4) |
| R4 | High | Reward evidence client-writable (plan tasks, lesson progress, review cards) | `screen_events` + `daily_activity` written by `/api/sync`; plan tasks skip-only; review cards server-written; rewards read server rows only |
| R5 | High | Checkpoints couldn't be stored as attempts (`item_id` FK) | Checkpoints materialised as `items` on publish (`05` §3, `03`) |
| R6 | High | F3 sent candidate-page text before confirmation, contradicting its own privacy test | Matching on the device only (BM25 in the PDF worker) |
| R7 | High | Tutor contract incoherent (stream vs retry, 4 tool rounds vs 2.5 s TTFT, preview-only structured output + tools) | Prose stream + held-back `ifiok-blocks` section; drop failing blocks; ≤ 2 tool rounds; flat 4-block subset; pre-computation; number check; TTFT 2.5 s / 4 s (`04` §4.1) |
| R8 | High | Cost model missed thinking tokens, tool rounds and Flash's 2027 price doubling | `thinking_tokens`, `tool_rounds` columns; thinking level per route; costs re-planned at 2027 prices (`09` §4) |
| R9 | High | NDPC thresholds wrong; pilot is already above the lowest tier | Ordinary-High > 200 / Extra-High > 1,000 / Ultra-High > 5,000; register before the pilot (OWN-06) |
| R10 | High | HNSW post-filtering starves course results; FTS ANDs every word | Exact vector scan filtered by course until ~200k chunks; OR-ed FTS query; 5×500 test |
| R11 | High | `match_chunks` relied on invoker RLS while the server uses the service role | `match_chunks(p_user, …)` with explicit visibility filter, service-role only; session user id only; payload ownership checks |
| R12 | High | Verification circular; items auto-published without checks; unchecked numbers in prose blocks | `stated` field + independent `answer_check`; items start in `review`; reviewer UI highlights unchecked numbers |
| R13 | High | Step rule would mark valid non-equivalence steps (squaring, substitution, `let u`) wrong | Three outcomes `ok` / `wrong` / `unchecked`; implication steps; continuation lines; marks only up to first `wrong` |
| R14 | High | P1 too big for a solo founder; 160–200 lessons to review alone | P1a: 2 courses, 2D labs (Ohm's law, pendulum); P1b: textbook, PC-build 3D, teach-back; paid reviewers (OWN-02). The textbook and 3D features stay in the pilot, after the core works |
| R15 | High | Cash pool tiny at realistic numbers, with heavy KYC/tax/copyright exposure | Staged: Units for student contributors, licence payments for lecturers, automatic cash pool only at ≥ ₦250k/month + legal review (`06`); past papers used as extracted questions only |
| R16 | Medium | P1 has no Units but quota rules referenced Units | `economy_enabled` flag; P1 quota copy (`04` §5) |
| R17 | Medium | Quota check raceable; day undefined | `consume_quota`/`refund_quota` atomic SQL; Lagos day. Tested |
| R18 | Medium | No refund/chargeback paths; earned Units' AI cost ignored | Reserve/refund, `reverse_topup`; earn cap 40/month; earned spend counted in `c` |
| R19 | Medium | P2 cap contradicted the model; margin counted top-ups not consumption | Cap formula from target `c`; recognised revenue = Units spent (FIFO value) |
| R20 | Medium | Deletion broke on restrictive FKs | `on delete set null` for non-financial refs; branch defined by ledger entries; P1 tests the simple branch |
| R21 | Medium | `enqueue_job` callable by any user via default grants | Defined, `security definer`, service-role only; API allow-list. Tested |
| R22 | Medium | Lecturers could publish/edit lessons directly, skipping verification and audit | No client UPDATE; `/api/lessons/:id`. Tested |
| R23 | Medium | No storage for hidden blocks; versioning broke old progress; topic deletes cascaded | `hidden_blocks` + trigger, `superseded` status, `current_lesson_id`, archived topics, `restrict` on items. Tested |
| R24 | Medium | Snap confirmation needed a paused state | `submission_status`; two jobs; confirm endpoint |
| R25 | Medium | Sampling rejected `sqrt`/`log`; plots of `1/x` failed; `ln` not in mathjs; units vs allow-list | 8-valid-points sampling with (0,5] retry; plots ≥ 50% with gaps; `ln`→`log`; unit symbols when `unit` set |
| R26 | Medium | "RLS in the same change" contradicted the ticket order | Schema and RLS merged into P0-03 |
| R27 | Medium | P0-05 required planner output that arrives in P1; 8 taps impossible | P0 reaches an empty Today; runnable-task AC moved to P1-06; ≤ 12 taps |
| R28 | Medium | Tickets depended on human data that wasn't ticketed | OWN-01…06 owner tickets; Claude Code must not fabricate ground truth |
| R29 | Medium | Platform details (Worker size, middleware, Serwist + Turbopack) | **Partly rejected:** Cloudflare raised the Worker size limit to 64 MiB on all plans in Sept 2026, so the spec's 64 MiB is right. Accepted: pin Next to OpenNext's supported version, Edge `middleware.ts`, decide Serwist build mode in P0-01, Smart Placement |
| R30 | Medium | gte-small CPU limits; chunk sizes over 512 word-pieces | Batches ≤ 16; chunks ≤ 350 word-pieces; Workers AI bge-small as documented fallback |
| R31 | Medium | pdf.js memory and timing on mid-range phones | Range reads, 100 MB cap, outline ≤ 20 s / full-text ≤ 90 s with pause |
| R32 | Medium | CSP would block KaTeX/Paystack styles; nonces defeat caching | `style-src 'unsafe-inline'`, `font-src`, `manifest-src`; nonces only on dynamic routes |
| R33 | Medium | Contrast failures (camwood button 4.40:1, warn, role colours on the Bench) | `--change #B0500F` (5.25:1), `--warn #8F5A00`, `--bench-*` role colours; contrast check in P0-05 |
| R34 | Medium | Per-IP limits and /24 ring detection would hit whole hostels behind CGNAT | WAF rule only on auth/webhooks; per-user DB limits; graph-based ring detection; no fingerprinting |
| R35 | Medium | Planner had no calendar; sessions and streaks undefined | `course_terms` with week override; `week_range`; session and `daily_activity` definitions (F6-FR6) |
| R36 | Medium | `blocked_minor` kept minors' data without parental consent | Under-18 sign-ups deleted at once; nothing kept, parent/guardian contact line instead (see N9) |
| R37 | Low | No legal name for name-match; stamp duty unposted | `legal_name` column; `levies` account and posting |
| R38 | Low | A card per attempted item → review backlog | Cards for wrong answers + one per micro-skill at Proficient; server-written |
| R39 | Low | Small inconsistencies (lesson size, lesson cost, font count, minutes, lecture row in P1, function layout, ink colour) | All aligned |
| R40 | Low | `pg_dump` over IPv6 from GitHub; CI minutes; missing P2 fixed costs | `supabase db dump` via session pooler; path-filtered CI; compliance costs in `09` §5, §7; staging in a separate free org |
| R41 | Low | LaTeX backslashes silently corrupted inside JSON | Control-character check triggers a repair retry; invalid fixture |
| R42 | Low | No invite mechanism for course reps | Course invite links with WhatsApp share (F0-FR7, P1-03) |

**Reviewer's three biggest risks, and where they are now handled:**
1. *Unit economics* → `09` §5 sets two measurable gates for P2 (`c ≤ ₦120`, `p ≥ 25%`), the pilot measures both (P1-15, P1-19), and Flash-Lite transcription is the main lever.
2. *Correctness trust* → independent answer checks, three-outcome step marking, human publishing by paid reviewers, flags that hide blocks.
3. *Founder capacity* → P1a/P1b split, two courses, owner tickets started during P0, P3 gated on P2 metrics.


### 3b. Verification pass (same reviewer, after the fixes)

The reviewer re-checked every finding, reloaded the schema, reran the tests and re-derived every number in `09` (all reproduced). Result: 30 findings fully resolved; the reviewer withdrew the Worker-size part of R29 after checking Cloudflare's Sept 2026 limits page; 20 follow-ups (one High, none Critical), all fixed:

| ID | Sev | Follow-up | Fix |
|---|---|---|---|
| N1 | High | A test case told the marker to accept a lost root (`x² = 4 → x = 2`) | Lost roots are `wrong`; extra roots allowed; `±` transcribed as `or`; test cases corrected (`05` §6, P0-08) |
| N2 | Medium | Direct chunk reads ignored source review (rejected bank text readable) | `chunks_read` requires an approved source. Tested |
| N3 | Medium | `answer_check` meant two different things | New `item_solve` skill; `answer_check` grades short text only (`04` §4.3, §4.7) |
| N4 | Medium | Job retry inside one invocation could outlive the visibility timeout and pay twice | One model call per job invocation, ≤ 100 s, queue retries, attempt-token commit (`04` §2) |
| N5 | Medium | Old write-path text left in `02` §2 and `08` §2.2/§2.6 | Rewritten to the server-evidence model |
| N6 | Medium | Screen events were still the client's word | `/api/sync` validation rules (enrolment, real screen, order, 5 s spacing, checkpoint attempt) + tests in P1-04 |
| N7 | Medium (P2) | Refunds and revenue recognition had no lot data | `unit_lots.kobo_per_unit`, `lot_moves`, `units_deferred_revenue`; converted Units recognised separately; invariants 8–9 |
| N8 | Medium | No role for paid reviewers | `enrollments.role = 'reviewer'`, `is_course_reviewer()`, API rule. Tested. (Replaced in v1.3 by subject curators, §3c.) |
| N9 | Medium (legal) | Waitlist stored a child's email on the child's own consent | Nothing collected for under-18s; parent/guardian email line; `waitlist` is adults-only |
| N10 | Low–Med | `\n` (from `\neq`, `\nu`, `\nabla`) not caught | Newline-before-letters check in LaTeX fields; fixture |
| N11 | Low–Med | Status colours failed contrast in dark mode | Dark `--ok/--warn/--bad` (≥ 6.2:1) |
| N12 | Low (P2) | Deletion branch ignored top-ups/withdrawals/recipients | Branch condition extended |
| N13 | Low–Med | Three eval sets had no owner ticket | OWN-07, OWN-08 |
| N14 | Low | `consume_quota(…, 0)` allowed one call | Early return. Tested |
| N15 | Low–Med | Lecturer licence fees had no basis or posting | Fee basis in `app_config`, `licence_fees` account, counted in gross margin |
| N16 | Low | Number check would drop valid blocks | Number check on prose only |
| N17 | Low | Students could create `handout`/`scheme` sources | Kind restricted on insert; `submit_to_bank` sets storage path and attestation. Tested |
| N18 | Low | Small leftovers (03 intro, P3 list, seeding figure, ₦150 vs ₦120, sizing note, point 3 wording, private lesson 1.42×, FR7 placement, `mark_verify`) | All aligned; private lesson 21 Units |
| N19 | Low | Sessions needed `last_event_at` | Column added |
| N20 | Low | WAF rule can't see browser→Supabase auth calls | Turnstile + Supabase limits stated; WAF on our callback and webhook only |

Reviewer's verdict after the verification pass: P0 ready once N14, N17 and N5 were applied, and P1a ready once N1, N8 and N6 were. All six are now applied.


### 3c. v1.3 reframe: student-led, not course-led (owner direction, 6 Oct 2026)

The owner clarified that Ifiok must not depend on courses or material we load: students choose any course or topic, and Ifiok reacts. Crowd uploads exist to make the AI teach better. What changed:

| Area | Before (v1.2) | Now (v1.3) |
|---|---|---|
| Catalogue | Two pilot courses seeded by us (MTH 101, PHY 101/107) | No fixed courses. Students create courses (`/api/courses`) and outlines (upload, typed or AI draft, wiki-style); any free-standing topic too |
| Sharing unit | Lesson per course topic | Lesson per global **concept** (`concepts`), reused across courses and universities; mastery and items per concept |
| Publishing | Human publishes every shared lesson | Automatic publish when every check passes, with "new" labels; trusted after use signals or a curator; flags, curator queue and refresh |
| Crowd bank | P2 | Uploads and curation in **P1** (rewards still P2); approved crowd chunks help every student learning that concept, at any university |
| Cost model | Seeding cost per course | Per-concept cost paid once (₦37–175) plus a library-growth line `L` in the break-even model (`09` §5) |
| Owner tickets | Pilot schemes, two paid reviewers | Launch community via course reps; optional curators; cross-faculty eval sets |

Re-tested after the change and its review (§3d): schema loads (56 tables, RLS on all), 47/47 database tests pass, including global lesson sharing, shared lessons using only approved crowd chunks, no client reads of other people's material, concept merges keeping the best mastery, and no direct client creation of courses, topics or concepts.

**New risks this brings** (added to §5): wrong lessons reaching students before anyone checks them; duplicate or junk courses and concepts; library cost in early P2.


### 3d. Review of the reframe (same independent reviewer)

Verdict before fixes: "structurally sound; fix V1 and V3 before P1-02 and V2 before the pilot." All 15 fixed:

| ID | Sev | Finding | Fix |
|---|---|---|---|
| V1 | High | Shared (global) lessons could be built from a student's private chunks or a course-only lecturer handout | `shared_lesson_sources()` (approved crowd chunks only, no past papers) is the only source for shared lessons. Tested |
| V2 | High | Non-STEM lessons auto-published with no truth check; `trusted` depended on curators who are optional | `claim_check` before publishing; sensitive subjects (health, law) wait for a curator; `trusted` uses unconfirmed flags from distinct students; correctness metric redefined |
| V3 | High | A $3/day cap can't absorb launch-day library building; quota allowed far more than the cap | Separate library budget ($20/day for 2 weeks, then $5); over-budget jobs queue until morning; warm the launch courses from real outlines |
| V4 | Medium | Concept identity underspecified (free-text subjects, level bands, thresholds, slugs, recursive prerequisites) | `subjects` table; level-band mapping in config; all ≥ 0.80 matches go to the model until calibrated; slug suffixes; prerequisite hints as text |
| V5 | Medium | Merges had no SQL contract and collided on keys | `merge_concepts()` with mastery, follows, lessons, items, topics and prereqs handled. Tested |
| V6 | Medium | Course squatting, outline vandalism, concept spam | Editable course titles with history and locks; edit eligibility and confirmations; 20 concepts/day; unlisted until used |
| V7 | Medium | Any student could read or scrape the whole crowd bank, including past papers | Clients read only their own sources and chunks; citations via `/api/citations`; past papers server-only; match_chunks excludes others' past papers. Tested |
| V8 | Medium | Students learning free-standing topics produced no evidence; reward rule inconsistent | Sync accepts screen events for enrolled-or-following students; reward rule aligned |
| V9 | Medium | Library cost assumed Flash-Lite before any eval; no overhead | ×1.3 overhead; Flash-path rows; Flash-Lite lesson eval is a P2 gate |
| V10 | Medium | Who sets the course calendar; no planner fallback; prerequisites never populated | Any member sets the start date once, then history; planner follows outline order without a calendar |
| V11 | Medium | Exam map still keyed to topics; course-free papers couldn't be used | Exam map keyed `(course_id, concept_id)`; uploader picks the course at extraction |
| V12 | Medium | Curation eval still P2 and no owner ticket; personal data not evaluated | `curate_classify` in P1 with OWN-09; zero-personal-data gate |
| V13 | Low–Med | One university's curator could reshape a global lesson | Fixes only for errors and clarity; second curator for popular lessons; course supplements in P3 |
| V14 | Low | Quota charged on deduped requests | Charged only when a new job is created; refunded on failed checks |
| V15 | Low | Leftover course-centric wording; no public display names for history | Wording replaced; `public_profiles` view |

## 4. Open questions (owner to answer; Claude Code: pick the safer option until answered)

| # | Question | Needed by | Safer default |
|---|---|---|---|
| Q1 | Which 1–2 universities and course reps seed the launch community (OWN-01)? Students can still learn any course or topic. | P1 launch | Start with University of Uyo. |
| Q2 | Recruit optional curators for the busiest subjects (OWN-02)? | P1 | Lessons publish automatically; the owner checks flagged lessons weekly. |
| Q3 | Business registration (CAC) and who signs Paystack/NDPC filings. | P2 gate | No payments until done. |
| Q4 | VAT treatment of Units after the 2025 tax reforms; contributor payout tax. | P2 gate | Prices shown VAT-inclusive; ask accountant. |
| Q5 | NDPC registration: confirm the tier with a DPCO (sources differ on GAID's numbers) (OWN-06). | Before the pilot opens | Register at Ordinary-High (> 200) before P1. |
| Q6 | Glyph designer and cultural advisor for the nsibidi-inspired marks. | P1 polish | Ship with Phosphor icons until the glyphs are ready. |
| Q7 | Domain name (`ifiok.com`/`.ng`/`.app`) and trademark search for "Ifiok". | P0-02 | Use a working domain; file trademark search before marketing. |
| Q8 | Supabase region after latency tests from Uyo (London vs Frankfurt). | P0-03 | `eu-west-2`. |
| Q9 | Serwist with Turbopack, or a webpack build? (decided in P0-01) | P0-01 | Whichever passes the offline test; record here. |
| Q10 | Snap-and-mark transcription model after the eval (Flash-Lite or Flash). | P1-10 | Flash until Flash-Lite passes. |
| Q11 | **Decided in P0-01 (10 Oct 2026):** Next.js is pinned to 16.3.8 (`@opennextjs/cloudflare` 1.20 supports `>=16.3.8`). Next 16 deprecates `middleware.ts` in favour of `proxy.ts`, which runs only on Node. We keep **Edge `middleware.ts`** as the spec requires; the build prints a deprecation warning. Revisit when OpenNext documents Node `proxy.ts` support. | P0-02 | Edge `middleware.ts`. |
| Q12 | **Decided in P0-01:** Supabase now issues publishable (`sb_publishable_…`) and secret (`sb_secret_…`) keys in place of the anon and service_role JWTs. The app reads `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` instead of `NEXT_PUBLIC_SUPABASE_ANON_KEY`. `SUPABASE_SERVICE_ROLE_KEY` keeps its name and holds the secret key (or the legacy JWT). | P0-01 | Publishable key. |
| Q9a | **P0-01 status of Q9:** Serwist isn't installed yet. The build uses Next 16's default Turbopack. The Serwist/Turbopack vs webpack choice moves to P1-11, where the offline test that decides it exists. | P1-11 | Turbopack until P1-11. |
| Q14 | **Decided in P0-03:** `pg_cron`, `pg_net` and `pgmq` are enabled in the P0-11 job-system migration, where they are first used, not in `0001`. Extensions live in the `extensions` schema (Supabase convention); `match_chunks` sets `search_path = public, extensions` for pgvector's `<=>`. | P0-11 | As decided. |
| Q15 | **Decided in P0-03/04:** schema additions not in `03`: `profiles.onboarded_at` (server-written, marks onboarding finished), a `set_updated_at` trigger on profiles, and `handle_new_user` (a profile row for every auth user; copies only the provider display name, never the email). Extra defence-in-depth revokes of client writes on server-only tables, and anon's EXECUTE on the RLS helpers revoked (Supabase advisor 0028). | P0-03 | As decided. |
| Q16 | **Decided in P0-04:** we only know birth month and year, so someone born in the current month 18 years ago is treated as under 18 (their birthday may not have passed). They can sign up again next month. | P0-04 | Birth month counts as "not yet". |
| Q17 | **Owner decision (10 Oct 2026):** deploy on **Vercel first**; P0-02 (Cloudflare/OpenNext) is deferred. Edge `middleware.ts` works on both, so Q11 stands. Revisit the `09` cost plan (Vercel Pro is the `02` §1 fallback host). | P0-02 | Vercel until reviewed. |
| Q18 | **Email sign-in (P0-04):** Supabase's built-in email only reaches team addresses and free projects can't edit email templates without custom SMTP. Owner decision: email codes stay **off** (`AUTH_EMAIL_CODES`) until Resend SMTP is connected; then uncomment the code templates in `supabase/config.toml` and `supabase config push`. Meanwhile `next dev` can sign in without email (`AUTH_DEV_SIGN_IN`, impossible in production builds), and deployed builds show "Sign-in opens soon" unless Google is enabled. Project OTP length set to 6 (was 8). | Pilot | Codes off until SMTP. Superseded for the main path by Q28 (email + password). |
| Q19 | **Deferred from P0-04:** Cloudflare Turnstile on sign-in. It must be switched on in Supabase Auth and in the app at the same time, and needs owner keys. Add with the email provider (Q18), before sign-up opens to the public. | Pilot | Rely on Supabase rate limits until then. |
| Q20 | **Supabase advisors after P0-03:** `public_profiles` is a security-definer view by design (03 §8; exposes id and display name to signed-in users only, anon revoked). 41 policies use `auth.uid()` directly; wrapping it as `(select auth.uid())` is a later performance migration. `timetable_entries` has two permissive policies as specified. | P1 | Accepted for now. |
| Q21 | The spec's "clients cannot call `post_txn`" test moves to P2-02, when the ledger exists. All other `checks/tests.sql` assertions are ported (`supabase/tests/01_access.test.sql`). | P2-02 | — |
| Q22 | Atkinson Hyperlegible Next is self-hosted with `next/font/local` (`app/fonts`): the `next/font/google` version crashes the Next 16.3.8 Turbopack dev server. | — | Local font. |
| Q23 | **Owner direction (10 Oct 2026), P0-06:** the signed-in app is a dashboard. Desktop: a left sidebar with the four tabs (Today · Courses · Practice · Me) plus a "Learning tools" group (Ask Ifiok, Labs, Snap and mark, Library); phones keep the 4-item bottom nav (07 §4). Content fills the width beside the sidebar (no centred narrow column). Sign-in/onboarding on desktop is a split screen with the setup steps on an Ink Line. Today is a start hub until the planner lands: one primary action ("Learn a course"), every other way in from the spec (topic, outline, uploads, textbook, goal), a setup checklist and real progress figures. Entry points for features not built yet show "Opens soon" (`lib/features.ts`; each ticket flips its flag). The floating "Ask Ifiok" button (07 §4) waits for the tutor (P1-07) rather than opening an empty sheet. | P0-06 | As directed. |
| Q24 | **Decided in P0-10:** (a) Models checked against the owner's key on 10 Oct 2026: `gemini-3.1-flash-lite` (default; lowest thinking level `minimal`) and `gemini-3.8-flash` (vision and generation; lowest level `low`, `minimal` is rejected); fallback `claude-haiku-4-5`. Prices are the spec's `04` §3 reference prices; confirm before launch. (b) The Anthropic provider uses the official `@anthropic-ai/sdk` (typed errors, SDK retries off) instead of raw fetch; Gemini stays fetch-based. (c) Prompts are versioned TypeScript modules (`lib/ai/prompts/<skill>.ts`) instead of `.md` files, so they bundle on Vercel and in Edge Functions. (d) Monthly allowances (`new_lesson`, private lessons) need a monthly counterpart to `consume_quota`; it lands with P1-02. (e) Mirroring the gateway into `packages/core` for Edge Functions lands with the job system (P0-11). (f) At the global cap only cap-exempt skills (`moderate`) keep running; tutor and marking continuing on Unit spends arrives with the economy (P2). (g) The crisis helpline list (`04` §7) needs real, verified numbers from the owner before the tutor ships (P1-07). | P0-10 | As decided. |
| Q25 | **Owner decision (10 Oct 2026), overrides `04` §3 hard rule 1:** to launch at close to zero cost with no funding, the pilot uses the **Gemini free tier with real student content**, and students are told plainly that Google may keep, use and have people review what they send (consent screen, `/ai`, `/privacy`; consent version `2026-10-gemini-free-draft`, so earlier consents are asked again). Google's terms for Unpaid Services say "Do not submit sensitive, confidential, or personal information", so the gateway also strips emails, Nigerian phone numbers and ID-like numbers from text sent to a free-tier provider (`lib/ai/redact.ts`) and never sends names, emails or account ids; photos can't be scrubbed, so students are asked to keep personal details out of them. `app_config.ai_billing` marks each provider free or paid: free calls record `cost_micros = 0` (caps don't stop students over money not spent) and `list_cost_micros` at paid prices (the pilot still measures `c`). A 429 is not retried straight away; the student sees "busy". Risks the owner accepts: Google's human review of student content; free-tier rate limits (per project, reset at midnight Pacific; check AI Studio) capping how many students can use AI at once; Google can change free-tier terms or limits at any time; NDPA consent must stay specific and informed (OWN-06 review). Revisit before P2 (payments) or when rate limits bite: switch `ai_billing.gemini` to "paid" and turn on billing in Google AI Studio. | Pilot | Free tier with disclosure + redaction. |
| Q26 | **Decided in P1-01 (10 Oct 2026):** (a) `topic_resolve` is batched: one call resolves up to 15 topics with their candidates (fewer requests on the Gemini free tier); a topic whose title exactly matches a candidate concept (same subject and band) is matched without a model call. Candidates need similarity ≥ 0.80 (`04` §4.5b). (b) The student picks the course subject from the controlled list when creating a course (instead of an AI suggestion), so concepts are scoped correctly from the first topic. (c) Outline edits from members enrolled < 3 days or with < 3 study sessions wait for another member to confirm; a course's first outline, and edits while the editor is its only member, apply at once (nothing to vandalise). (d) Outline photos/PDFs are sent to Gemini and discarded; Ifiok doesn't store them. (e) Embeddings run in the `embed` Edge Function (gte-small), called server-to-server with `INTERNAL_FUNCTION_SECRET`. (f) **Deferred from P1-01:** admin merge tools (`merge_concepts`/`merge_courses` UI) to P0-13 admin; the course calendar (`course_terms`) to P1-06 where the planner uses it; micro-skill vocabulary seeds to P1-04/P1-09 where items and diagnosis use them; the `topic_resolve` eval gate and per-subject thresholds need OWN-01/OWN-05 data. | P1-01 | As decided. |
| Q27 | **Owner decision (10 Oct 2026), overrides the per-skill output caps in `04` §5:** no output token caps on any AI skill during the free-tier pilot (tokens cost nothing; caps only risked cut-off replies, e.g. long AI-draft outlines failing to save). Gemini gets no limit (model maximum); the Claude fallback gets 16,000 (`max_tokens` is required). Routes still accept `max_output_tokens`, and a reply cut off at a configured cap is retried once with double the budget. Brevity is still asked for in the prompts (e.g. the tutor's 180-word rule). Revisit caps when moving to paid billing (Q25). | Pilot | No caps. |
| Q28 | **Owner decision (10 Oct 2026), adds to `08` F0-FR1:** with no email provider yet, sign-in is **email + password** in every environment (development and production): "Sign in" and "Create account" on `/sign-in`, minimum 8 characters (`supabase/config.toml` `minimum_password_length`), Show/Hide toggle. Email confirmation is **off** (`enable_confirmations = false`; hosted `mailer_autoconfirm` on), so a new account is signed in at once. The development-only no-password sign-in (`AUTH_DEV_SIGN_IN`) is removed. Emailed 6-digit codes stay available as an extra option behind `AUTH_EMAIL_CODES=true` once Resend SMTP is connected. Trade-offs accepted for the pilot: (a) email addresses are **unverified**, so someone could register an address they don't own; (b) there is **no "Forgot password"** until email can be sent, so a student who forgets must ask support; (c) a wrong email or password gets one generic message so accounts can't be probed. When SMTP lands: turn confirmations on, add password reset, and send a verify-email prompt to existing accounts. | Pilot | Email + password now; confirmations and reset with SMTP. |
| Q29 | **Owner request (10 Oct 2026), resolves Q28 (b):** "Forgot password" uses Supabase Auth: `resetPasswordForEmail` emails a **6-digit recovery code** (template `supabase/templates/recovery.html`), and `/sign-in/reset` takes the code and the new password on one screen (`verifyOtp` type `recovery`, then `updateUser`). Codes, not links: a reset link carries a PKCE verifier that only works in the browser that asked, and students often open email in another app or phone. The reply is the same whether or not an account exists. It needs an email provider: Supabase's built-in sender only delivers to project team addresses (about 2 emails an hour) and the default reset email has no code. So it stays **off** (`AUTH_PASSWORD_RESET`; no "Forgot password?" link, `/sign-in/reset` redirects) until Resend SMTP is connected and the recovery template is pushed. A "password changed" notice (`password_changed.html`) is ready to turn on at the same time. | Pilot | Built; on with SMTP. |
| Q30 | **Owner request (10 Oct 2026), adds to `03` profiles and `07` §4 (Me):** profiles get `first_name` and `last_name` (≤ 40 characters, trimmed; any script, with accents and tone marks). "Create account" asks for both; Google fills them from `given_name`/`family_name`; existing accounts were split from `display_name`. Students edit them on Me (column grant; RLS). `display_name` is now **derived** by a trigger as "First L." and no longer client-writable, so other students (outline history, credits via `public_profiles`) never see a full surname. The page header greets the student ("Good evening, Ada") by Nigerian time (WAT). Names never go into AI prompts (Q25). Account deletion (`08` §5) must blank `first_name` and `last_name` as well as `display_name`. | Pilot | Done. |
| Q13 | Local dev: the owner's machine has no Docker, so `supabase start` can't run there. Develop against the hosted project (synthetic data only) and run pgTAP in CI (`supabase db start` on GitHub runners). `supabase/config.toml` uses Postgres 17 (CLI default) while `checks/` were run on 16; confirm the hosted project's major version and match it. | P0-03 | Hosted dev project + CI for DB tests. |

## 5. Risk register

| Risk | Likelihood | Impact | Mitigation | Owner signal |
|---|---|---|---|---|
| Free usage costs too much AI (unit economics fail) | High | High | Hard caps, P2 allowance cuts, Flash-Lite transcription, thinking levels, seeding before the 2027 price rise | `c` > ₦150 for 2 weeks |
| Too few students pay | Medium | High | Willingness-to-pay test in P1b before building payments; value first (free lessons/labs); small bundles | Test shows < 20% intent; paying share < 15% after 6 weeks of P2 |
| A wrong shared lesson spreads to a class | Medium | High | Human publish in P1, verification, flags, auto-hide | Confirmed wrong blocks > 1% |
| Snap-and-mark marks correct work wrong | Medium | High | Confirmation step, eval gate of zero, "Estimated" label, disputes | Any confirmed case |
| Under-18 users sign up | High | Medium | Age gate, Terms, reporting; minors plan before school-age marketing | Reports of minors |
| Provider terms or prices change | Medium | Medium | Gateway with fallback provider; model IDs in config | Price change notice |
| Supabase Free limits hit mid-pilot | Medium | Medium | Monitoring; move to Pro ($25) at 350 MB DB | DB > 350 MB |
| Contributor fraud rings | Medium | Medium | Units-only rewards until the cash pool gate; server-written evidence; qualified consumers; graph-based ring detection; hold period | Flags per period |
| Copyright complaint about bank content | Medium | Medium | No textbooks, detection, takedown in 24 h | Any notice |
| A wrong auto-published lesson spreads across universities | Medium | High | Verification, citations, "new" labels, 3-flag hide, curator queue, refresh, eval gate per subject before a cheaper model is used | Confirmed-wrong blocks > 1% for any subject |
| Duplicate or junk courses and concepts | High | Medium | Normalised codes, near-duplicate prompts, `topic_resolve` thresholds, moderation, admin merges | Duplicate concept rate > 5% |
| Library cost in early P2 | Medium | Medium | Flash-Lite generation where evals pass, lazy items, new-lesson quota, cache warming before the 2027 price rise | `L` > ₦120k/month |
| Weak phones can't run 3D labs | High | Low | 2D fallback, device check, data saver | Fallback rate |
| Solo-founder bandwidth | High | High | Strict phase scope; P3 only after P2 metrics | Slipping exit checks |

## 6. Change log
- **v1.0 (Oct 2026):** first full spec.
- **v1.1 (Oct 2026):** self-review fixes S1–S17.
- **v1.3 (Oct 2026):** student-led reframe (§3c).
- **v1.2 (Oct 2026):** independent peer review R1–R42 resolved (§3) and the verification pass N1–N20 fixed (§3b); schema re-tested (51 tables, RLS on all, 36 tests passing); cost plan re-based on 2027 prices; P1 split into P1a/P1b; staged economy.
- **v1.3.1 (6 Oct 2026):** spec moved into the app repo at `specifications/` (was `docs/spec/`); path references updated, content unchanged. `CLAUDE.md` now lives at the repo root.
