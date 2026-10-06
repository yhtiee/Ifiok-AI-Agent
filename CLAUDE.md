# CLAUDE.md · Ifiok

Ifiok is an AI learning agent for Nigerian university students (18+ at launch): course lessons that move, virtual labs, a grounded tutor, snap-and-mark, spaced practice and a daily plan. The full spec is in `specifications/`. **The spec wins over your defaults.** If the spec is unclear or wrong, write the question in `specifications/12-review-log.md` §4, pick the safer option, and say so.

## Working routine
1. Read this file and `specifications/10-build-plan.md`. Find the current ticket.
2. Read only the spec sections the ticket lists (and anything they link to that you need).
3. Implement with tests. Run `pnpm check` before saying you're done.
   - Tickets named `OWN-xx` are human work. If a ticket is blocked by one, build the tooling and stop. **Never fabricate ground-truth data** (eval answers, handwritten samples, schemes, prices).
4. Report: what changed (files), how it was tested, any spec deviation.

## Stack (don't swap without a review-log entry)
Next.js App Router + TypeScript strict (version pinned to what `@opennextjs/cloudflare` supports; use Edge `middleware.ts`, not Node `proxy.ts`) · Cloudflare Workers via `@opennextjs/cloudflare` · Supabase (Postgres, RLS, pgvector, pgmq, pg_cron, pg_net, Auth, Storage, Realtime, Edge Functions on Deno) · Tailwind v4 (tokens in `app/globals.css`) · Radix primitives · zod · TanStack Query · Zustand · mathjs · KaTeX · MathLive · Mafs · @react-three/fiber + drei · pdfjs-dist · ts-fsrs · Serwist + Dexie · Paystack · Resend · Sentry · PostHog. AI: our own gateway (`lib/ai`), Gemini paid tier by default, Claude Haiku 4.5 fallback; model IDs live in `app_config`, never in code.

## Commands
```
pnpm dev                 # Next dev server (needs `supabase start`)
pnpm check               # typecheck + lint + unit tests + DSL validation + check-ui
pnpm test                # Vitest
pnpm test:e2e            # Playwright
pnpm test:db             # supabase test db (pgTAP)
pnpm evals -- <skill>    # AI evals against staging ($2 cap)
pnpm build:cf            # OpenNext build for Cloudflare
supabase db reset        # rebuild local DB from migrations + seed
supabase migration new <name>
supabase gen types typescript --local > lib/supabase/types.ts
```

## Structure
`app/` routes (`(marketing)`, `(auth)`, `(app)`, `(teach)`, `(admin)`, `api/`) · `components/ui` design system · `components/lesson` one renderer per DSL block · `components/labs/<slug>/{model.ts,Lab.tsx,TextMode.tsx}` · `lib/ai` gateway, providers, skills, prompts, budgets · `lib/agent` planner, mastery, FSRS · `lib/verify` → re-exports `packages/core/verify` · `lib/offline` · `packages/core` pure TS shared with Edge Functions · `supabase/{migrations,functions,seed,tests}` · `content/` seed lessons · `evals/` · `e2e/`.

## Product shape (read before any feature work)
Ifiok is **student-led**: no hard-coded or admin-curated courses. Students create courses, outlines and topics; topics resolve to global **concepts**; lessons, items and mastery attach to concepts and are shared across universities. Nothing in code may assume a fixed course list or require an admin before a student can learn. Crowd uploads improve grounding for everyone. **Shared lessons take sources only from `shared_lesson_sources()`** (approved crowd chunks): never a student's private chunks, a course-only handout or a past paper. Clients never read other people's sources or chunks directly; citations go through `/api/citations/:chunk_id`.

## Hard guardrails (never break these)
1. **No AI calls from the browser.** All model calls go through `lib/ai/gateway.ts` on the server or in Edge Functions. Never ship provider keys or the Supabase service-role key to the client.
2. **The model explains; engines compute.** Every number shown to a student comes from mathjs (`packages/core/verify`) or a tool result. Items whose stated answer disagrees with `answer_expr` are dropped.
3. **AI outputs data, not code.** Lessons are Lesson DSL JSON validated by zod and `verifyLesson` before saving. Never render AI-generated HTML or run AI-generated JS.
4. **RLS on every table**, with a pgTAP test, in the same change that creates the table. Private content (owner_id not null) is visible to its owner only, not to lecturers.
5. **Money and Units change only through the SQL functions** in `specifications/06-economy.md` §8. No direct inserts or updates to ledger tables from app code. All of them are idempotent on a key. Supabase grants EXECUTE on new functions to `anon` and `authenticated` by default, so every `security definer` function must `revoke execute … from public, anon, authenticated` and grant only what its contract says (pgTAP test).
6. **Learning evidence is server-written.** Attempts and screen events go through `/api/sync`, which re-grades. Rewards, usage points, streaks and task completion read only server-written rows, never `lesson_progress` or anything the client wrote.
7. **Retrieval and job payloads are scoped to the session user.** `match_chunks` takes the user id from the session, never from the request. Job handlers check every id in a payload belongs to the job owner or is shared.
8. **18+ only.** Under-18 sign-ups are deleted at once; every AI route and Edge Function also checks `is_adult_active()`.
9. **Budgets are enforced, not advisory.** `consume_quota` (or a Units reservation) runs before every model call and is refunded on failure; then the global daily cap.
10. **Never log prompts, responses, emails or tutor content** to Sentry, PostHog or console in production.
11. **Private textbooks never upload as files**, and no page text leaves the device before the student confirms the range.
12. **Webhooks:** verify Paystack's HMAC on the raw body, then call Verify Transaction, then post via SQL.
13. **Exam copy never says "predicted" or "likely to appear".**
14. **No client UPDATE on lessons.** Edits and publishing go through `/api/lessons/:id`, which runs the verification gate and writes `admin_audit`.

## Conventions
- TypeScript strict, no `any` (use `unknown` + zod). Server-only modules import `server-only`.
- Validate every boundary with zod: route input, env, AI output, DSL, `app_config` values.
- Route handlers: `requireUser()` / `requireAdult()` / `requireAdmin()` first, then zod, then work.
- SQL: snake_case; `timestamptz`; naira in **kobo** (integers); Units are integers; client-created rows use client UUIDs.
- Errors to users say what happened and how to fix it. No apologies, no vague "Something went wrong".
- Names: "Units" (never coins/tokens/gems), "Earnings", "Bench", "Path", mastery levels "Not started · Familiar · Proficient · Mastered".
- Commits reference spec IDs, e.g. `feat(F5-FR4): mastery update on sync`.

## UI rules (from `specifications/07-brand-ui-ux.md` §3.4; `pnpm check` enforces some)
- Use tokens only (`--paper`, `--ink`, `--quantity` blue = the quantity, `--change` camwood = change/action/primary button, `--built` green = accumulated/mastered/earned). Never hard-code colours.
- Fonts: Bricolage Grotesque (display, sparingly), Atkinson Hyperlegible Next (text), JetBrains Mono only for instrument readings on the Bench.
- No gradients, glass, glows, sparkle icons, emoji in UI copy, all-caps tracked labels, cards-in-cards, identical card grids, drop shadows on Page cards, or fade-up-on-scroll.
- One primary (camwood) action per screen, in the thumb zone. Touch targets ≥ 44 px. Colour is never the only signal.
- Motion only answers an action, plus the single Ink Line advance; respect `prefers-reduced-motion`.
- Mobile first (360–412 px). Skeletons, not spinners. Every plot has a text summary; every lab has a text mode.

## Performance budgets
Today ≤ 170 KB gz initial JS · lesson shell ≤ 200 KB gz (KaTeX pre-rendered at save time, plots evaluated by the AST interpreter, no mathjs on the client except lazily for `expression` items) · each lazy block chunk ≤ 120 KB gz (MathLive excepted, load only when needed) · LCP ≤ 2.5 s on mid-range Android over 4G · lesson JSON ≤ 60 KB · 3D lab chunk ≤ 650 KB gz · `zod/mini` on the client.

## Env vars
`NEXT_PUBLIC_SITE_URL` (absolute origin for canonical and share-image URLs; set per deploy), `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`, `ANTHROPIC_API_KEY`, `PAYSTACK_SECRET_KEY`, `NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY`, `RESEND_API_KEY`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `SENTRY_DSN`, `POSTHOG_KEY`, `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`, `GROQ_API_KEY` (P3). Validated in `lib/env.ts`. Use the Gemini **free** tier only with synthetic data in local development.

## Repository status (update as tickets land)
- Spec lives in `specifications/` (index: `specifications/README.md`). Every `docs/spec/` reference you meet elsewhere means `specifications/`.
- Done ahead of the build order: a static landing page at `app/(marketing)/page.tsx` (brief for P1-13: `07` §5.11). It also seeds the P0-05 tokens and fonts (`app/globals.css`, `app/layout.tsx`). Its hero plot is self-contained (`components/marketing/TangentHero.tsx`); when P0-09 builds the real `plot` block renderer, switch the hero to it.
- Not done yet: everything from **P0-01** on. The repo is still the Create Next App scaffold, so it uses npm (`package-lock.json`), has no pnpm workspace, Vitest, Playwright, Supabase or `pnpm check`. P0-01 moves it to pnpm and adds these. Until then use `npm run dev`, `npm run build` and `npm run lint`.
- Installed Next.js is 16.3.8. Before P0-02, check it against the versions `@opennextjs/cloudflare` supports and pin to match (`02` §1). Next 16 renames `middleware.ts` to `proxy.ts`; the spec wants Edge `middleware.ts` while OpenNext needs it. Record the outcome in `12` §4.

## Next.js version notes
@AGENTS.md
