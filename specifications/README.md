# Ifiok — Product & Engineering Specification

**Ifiok, the AI learning agent.** *See it. Try it. Master it.*
Version 2.0 · October 2026 · Owner: Utibeabasi Ekpenyong
Status: restructured around four pillars and four stages (`12` §4 Q38–Q41). Stage 1 (MVP) is being built; see `10-build-plan.md`.

This folder is the single source of truth for building Ifiok with Claude Code on **Next.js + Supabase**. It is written so an engineer (human or AI) can build each ticket without guessing.

## What Ifiok is: four pillars

| Pillar | In one line |
|---|---|
| **1. Learn** | A path through any course or topic, built from the student's own materials, with weak areas called out |
| **2. Prepare** | Exam- and goal-based study: patterns in past papers, a study plan to the exam date, assessments |
| **3. Practise** | Virtual labs on request, from a lab manual or a lab topic, for practicals the lab can't run |
| **4. Teach and earn** | Students paid for verified uploads, explainers (text, voice, video), curating and tutoring |

Ifiok is the *learning engine*, not a library, workspace, timetable or social app; it imports materials from where students keep them, so library apps can be partners (`00` §1b).

## How the roadmap runs

| Stage | Goal |
|---|---|
| **1 · MVP** | Hackathon (27 Oct 2026): Learn, Prepare and Practise from a student's own materials, plus Teach and earn with earnings recorded (no cash yet) |
| **2 · Launch** | Real students, free: security, privacy, email, offline basics, invites, usage analytics |
| **3 · Earn** | Real money: Units wallet, paid curators, tutoring with escrow, cash payouts |
| **4 · Grow** | The next features chosen from usage |

**Reading older phase labels.** Requirement text written before the restructure still says P0–P3 in places (mostly quota defaults). Read them as: **P0 / P1 / P1a** = pilot defaults for Stage 1 · MVP and Stage 2 · Launch · **P1b, P3** = Stage 4 · Grow · **P2, P2b** = Stage 3 · Earn. Where a feature's **Stage** line (in `01`) or the roadmap (`10`) differs from an older label, the Stage line and the roadmap win.

## How to use this with Claude Code

1. Open Claude Code in the repo. `CLAUDE.md` (repo root) holds the rules: stack, structure, conventions, hard guardrails.
2. Start every session with:
   > Read CLAUDE.md and specifications/10-build-plan.md. We are on ticket <ID>. Read the spec sections that ticket lists, then implement it, with tests.
3. Build tickets **in order**, stage by stage. Each ticket lists its spec sections, what to build and its "Done when" checks. Tickets named `OWN-xx` are the owner's (real data, people, legal steps).
4. When something you learn changes the spec, record it in `12-review-log.md` §4 and update the affected file.

## Files

| File | What it covers |
|---|---|
| `00-product.md` | Vision, the four pillars and Ifiok's lane, users, principles, scope by stage, non-goals, metrics |
| `01-features.md` | Every feature (F0–F18) with a feature map by pillar and stage: stories, requirements, acceptance criteria |
| `02-architecture.md` | System design, hosting, jobs and worker, media, offline, performance budgets |
| `03-data-model.md` | Postgres schema, RLS policies, SQL functions (planned Earn-stage tables in §10) |
| `04-ai.md` | AI gateway, model routing (Groq primary, Gemini fallback), skills, budgets, safety |
| `05-lesson-and-lab-engine.md` | Lesson DSL, block renderers, verification, lab registry and the virtual experiment engine |
| `06-economy.md` | Units, contribution pool, usage points, curator pay, tutoring escrow, explainer pay, payouts |
| `07-brand-ui-ux.md` | Brand, design tokens, screens, flows, anti-slop rules |
| `08-security-privacy.md` | Security, NDPA compliance, age policy, moderation (incl. voice and video), copyright, checklists per stage |
| `09-cost-plan.md` | Launch-cheap plan, free tiers, per-learner cost model, budgets per stage |
| `10-build-plan.md` | **The roadmap:** stages, ordered tickets, exit checks, owner tasks |
| `11-testing-and-evals.md` | Tests, AI evaluation sets, quality gates per stage |
| `12-review-log.md` | Decisions, findings, open questions, risk register |
| `archive/10-build-plan-v1.md` | The previous phase-based plan (P0–P3); its ticket IDs are still cited |
| `checks/` | SQL and maths checks that were run, and how to rerun them |

## The decisions that shape everything

1. **Learning first; exams are one mode.** The Path, exam prep and labs all serve learning.
2. **The AI writes lessons as data, not code.** Lessons are Lesson DSL JSON rendered by our own components: safe, cheap, cacheable, checkable.
3. **The model explains; engines compute.** Every number a student sees is computed or checked by a maths engine. Non-maths claims cite sources when sources exist.
4. **Labs are hand-built engines, configured by AI.** The virtual experiment engine turns a manual or a lab topic into a configuration; the AI never writes lab code.
5. **Student-led, generate once, share by concept.** No pre-loaded catalogue. Shared lessons are built once per concept and reused everywhere; a student's own materials ground their private lessons, and shared materials improve everyone's.
6. **Students only, and students earn.** Lecturers are not served for now (Q39). Students earn for verified uploads, explainers, curating and tutoring; learning earns credits (Units), contributions others use earn cash.
7. **The planner is deterministic code.** The "agent" orchestrates rules and AI skills; it is not a free-roaming LLM loop.
8. **18+ at launch.** Age gate, because of provider terms and Nigerian law.
9. **Materials are read on the device.** PDFs (including textbooks) are extracted in the browser; only the pages a student chooses are sent. Ifiok never redistributes copyrighted books.
10. **Money is a double-entry ledger in Postgres**, changed only by SQL functions; tutoring money is held by a licensed escrow partner, never by Ifiok; the automatic cash pool switches on only when it is big enough to matter.
11. **Launch cheap.** Vercel + Supabase Free + free AI tiers during the pilot (Groq primary, Gemini fallback, `12` §4 Q25, Q35), with hard budget guards; Supabase Pro and paid AI before real money moves.
