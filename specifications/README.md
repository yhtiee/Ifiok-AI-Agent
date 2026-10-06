# Ifiok — Product & Engineering Specification

**Ifiok, the AI learning agent.** *See it. Try it. Master it.*
Version 1.3 · October 2026 · Owner: Utibeabasi Ekpenyong
Status: self-reviewed, independently peer-reviewed (42 findings plus a verification pass with 20 follow-ups, all resolved) and partly machine-checked: the schema loads in PostgreSQL 16 and passes 47 RLS/ledger tests; the example lesson's maths verifies (`specifications/checks/`). Ready to build Phase 0. See `specifications/12-review-log.md`.

This folder is the single source of truth for building Ifiok with Claude Code on **Next.js + Supabase**. It is written so an engineer (human or AI) can build each phase without guessing.

## How to use this with Claude Code

1. Create the repo, copy this whole folder in, and move `CLAUDE.md` to the repo root.
2. Open Claude Code in the repo. Start every session with:
   > Read CLAUDE.md and specifications/10-build-plan.md. We are on ticket <ID>. Read the spec sections that ticket lists, then implement it, with tests.
3. Build tickets **in order**. Each ticket in `10-build-plan.md` lists its spec sections, files and acceptance checks. Don't skip ahead: later phases depend on earlier tables, RLS and the AI gateway. Tickets named `OWN-xx` are yours (real data, reviewers, registration); start them during P0 so they don't block P1.
4. After each phase, run the phase's exit checks. Then update `12-review-log.md` with anything you learned that changes the spec.

## Files

| File | What it covers |
|---|---|
| `CLAUDE.md` | Rules Claude Code must follow: stack, structure, conventions, hard guardrails |
| `specifications/00-product.md` | Vision, users, principles, scope by phase, non-goals, metrics |
| `specifications/01-features.md` | Every feature: stories, requirements, acceptance criteria, edge cases, trade-offs |
| `specifications/02-architecture.md` | System design, hosting, jobs, offline, performance budgets |
| `specifications/03-data-model.md` | Postgres schema, RLS policies, SQL functions |
| `specifications/04-ai.md` | AI gateway, model routing, skills, prompts contract, cost caps, safety |
| `specifications/05-lesson-and-lab-engine.md` | Lesson DSL (JSON), block renderers, verification, lab registry, 3D |
| `specifications/06-economy.md` | Units, contributor pool, usage points, payouts, Paystack, anti-fraud |
| `specifications/07-brand-ui-ux.md` | Brand, reference teardown, design tokens, screens, flows, anti-slop rules |
| `specifications/08-security-privacy.md` | Security, NDPA compliance, age policy, moderation, copyright |
| `specifications/09-cost-plan.md` | Launch-cheap plan, free tiers, per-user cost model, budget guards |
| `specifications/10-build-plan.md` | Ordered tickets, phase exit checks |
| `specifications/11-testing-and-evals.md` | Tests, AI evaluation sets, quality gates |
| `specifications/12-review-log.md` | Peer review findings, resolutions, risk register, open questions |
| `specifications/checks/` | The SQL and maths checks that were run, and how to rerun them |

## The ten decisions that shape everything

1. **Learning first, exams second.** Exam mode is one feature, not the product.
2. **The AI writes lessons as data, not code.** Lessons are JSON in a fixed block language (Lesson DSL), rendered by our own vetted components. This makes them safe, cheap, cacheable and checkable.
3. **The model explains; engines compute.** Every number a student sees is computed or checked by a maths engine. Non-maths answers must cite the student's sources.
4. **Labs are hand-built modules**, configured by AI, never generated as code at runtime.
5. **Student-led, generate once, share by concept.** There is no pre-loaded course catalogue. Students create courses and pick any topic; each topic maps to a global concept, and the first request builds its lesson and practice, which every later student at any university reuses. Crowd uploads (notes, past questions) make those lessons and the tutor better. AI cost grows with what students cover, not with how many students there are.
6. **The planner is deterministic code.** The "agent" is an orchestrator that runs rules and calls AI skills. It is not a free-roaming LLM loop: cheaper, predictable, testable.
7. **18+ at launch.** Age gate, because of provider terms and Nigerian law. Minors come later, with consent and a minor-safe AI provider.
8. **Private textbooks are processed on the device.** Only text for the topics the student opens is stored, and only for them. The bank never redistributes copyrighted books.
9. **Money is a double-entry ledger in Postgres**, changed only by SQL functions. Students earn Units; lecturers are paid under content licences; the automatic cash pool switches on only when it is big enough to matter (≥ ₦250k/month) and is always a fixed share of real margin.
10. **Launch on about $5/month fixed** (Cloudflare Workers Paid + Supabase Free) plus capped AI (≈ $30–55/month in the pilot). Move to Supabase Pro ($25) before real money moves. The pilot is invite-only (any course or topic) and must prove two numbers before P2: free usage ≤ ₦120 of AI per learner per month, and ≥ 25% of active learners willing to top up.
