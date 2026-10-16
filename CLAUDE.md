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
pnpm dev                 # Next dev server against the hosted dev project (`supabase start` needs Docker, 12 §4 Q13)
pnpm check               # typecheck + lint + unit tests + local DB tests + format check (DSL validation lands in P0-07, check-ui in P0-05)
pnpm typecheck | pnpm lint | pnpm format
PW_CHANNEL=chrome pnpm test:e2e   # use the installed Chrome instead of downloading Playwright's Chromium
pnpm test                # Vitest
pnpm test:e2e            # Playwright
pnpm test:integration    # real Supabase + Gemini (quota race, live gateway); costs a fraction of a cent
pnpm test:db:local       # migrations + seed + pgTAP in PGlite (no Docker; runs in pnpm check)
pnpm test:db:remote      # the same pgTAP files on the linked hosted project, always rolled back
pnpm test:db             # supabase test db (pgTAP; Docker, used in CI)
pnpm db:push             # apply new migrations to the linked project (run test:db:local first)
pnpm evals -- <skill>    # AI evals against staging ($2 cap)
pnpm build:cf            # OpenNext build for Cloudflare
pnpm sync:core           # copy packages/core into supabase/functions/_shared/core (pnpm check verifies)
pnpm check:worker        # typecheck the worker Edge Function with Deno
pnpm deploy:worker       # sync + deploy the worker (no Docker)
pnpm setup:worker        # set the worker's function secrets and Vault secrets from .env
supabase migration new <name>
pnpm db:types           # regenerate packages/core/src/db/types.ts from the linked project after every migration
```
The Supabase CLI is a dev dependency: run it as `pnpm exec supabase …`.

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

## Data access (Supabase + TanStack Query)
- **Supabase clients** (`lib/supabase/`): `client.ts` for client components, `server.ts` for server components, actions and route handlers (both act as the user under RLS); `admin.ts` service role, server only, only where the spec says so; `middleware.ts` refreshes the session (root `middleware.ts`). Generated types live in `packages/core/src/db/types.ts` (re-exported by `lib/supabase/types.ts`); never hand-edit them.
- **Env** via `@/lib/env` (public) and `@/lib/env/server` (secrets, `server-only`). Never read `process.env` elsewhere. A var that later tickets need is optional in `lib/env/schema.ts`; read it with `requireServerEnv()` and make it required when its ticket lands.
- **TanStack Query** (`lib/query/`) for all client-side server state, no ad-hoc `useEffect` fetching:
  - Keys come only from `queryKeys` in `lib/query/keys.ts` (hierarchical; invalidating a prefix covers everything under it). Add a domain there with its ticket.
  - Put each domain's `queryOptions(...)` factories and `useXxxMutation` hooks in `lib/queries/<domain>.ts`, shared by server prefetch and client `useQuery`.
  - Mutations declare what they invalidate: `useMutation({ mutationFn, meta: { invalidates: [queryKeys.courses.all()] } })`. The `MutationCache` in `lib/query/client.ts` invalidates on settle (success or error). Only write `onMutate`/`onError` for optimistic updates.
  - Calls to our `/api/*` handlers go through `apiFetch(path, { schema })` (validates the response; throws `ApiError` with a user-facing message). Route handlers return `{ error: { message, code? } }` on failure. RLS-safe reads may use the browser Supabase client directly inside a `queryFn`.
  - Server prefetch: `getServerQueryClient()` (`lib/query/server.ts`), `prefetchQuery`, then `<HydrationBoundary state={dehydrate(qc)}>`.
  - `QueryProvider` is mounted in route-group layouts that need it (`app/(app)/layout.tsx` now), never on the landing page.

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
`AUTH_EMAIL_CODES` (true once Resend SMTP is connected: adds emailed sign-in codes next to email + password, 12 §4 Q18, Q28), `AUTH_PASSWORD_RESET` (true once Resend SMTP is connected and the recovery template is pushed: "Forgot password?" by emailed code, Q29), `NEXT_PUBLIC_PRIVACY_EMAIL`, `NEXT_PUBLIC_MINORS_EMAIL`, `NEXT_PUBLIC_SITE_URL` (absolute origin for canonical and share-image URLs; set per deploy), `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (replaces the spec's `…_ANON_KEY`, 12 §4 Q12), `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`, `ANTHROPIC_API_KEY`, `PAYSTACK_SECRET_KEY`, `NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY`, `RESEND_API_KEY`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `SENTRY_DSN`, `POSTHOG_KEY`, `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`, `GROQ_API_KEY` (P3). Validated in `lib/env/schema.ts` at boot (`next.config.ts`); list in `.env.example`, values in `.env.local` (gitignored). The pilot runs on the Gemini **free** tier with real student content by owner decision (12 §4 Q25): `app_config.ai_billing` says which providers are free; the gateway strips personal details before free-tier calls; never add names, emails or account ids to prompts. No output token caps during the pilot (12 §4 Q27); keep replies short through the prompts.

## Repository status (update as tickets land)
- Spec lives in `specifications/` (index: `specifications/README.md`). Every `docs/spec/` reference you meet elsewhere means `specifications/`.
- Done ahead of the build order: a static landing page at `app/(marketing)/page.tsx` (brief for P1-13: `07` §5.11). It also seeds the P0-05 tokens and fonts (`app/globals.css`, `app/layout.tsx`). Its hero plot is self-contained (`components/marketing/TangentHero.tsx`); when P0-09 builds the real `plot` block renderer, switch the hero to it.
- **P0-01 done (10 Oct 2026):** pnpm workspace (`packages/core` as `@ifiok/core`), ESLint + full jsx-a11y + Prettier, Vitest, Playwright (`e2e/`), zod env validation that fails boot, CI (`.github/workflows/ci.yml`, path-filtered), Supabase clients + session middleware, TanStack Query layer, `supabase/` initialised (config, empty migrations/functions/seed/tests). Next pinned to 16.3.8 with Edge `middleware.ts` (12 §4 Q11). Serwist deferred to P1-11 (Q9a).
- **P0-02 deferred:** hosting is Vercel for now (12 §4 Q17).
- **P0-03 done (10 Oct 2026):** migrations `supabase/migrations/2026101010*` (sections 0001–0005 + retrieval + helper hardening), seed `supabase/seed/00_universities.sql`, pgTAP in `supabase/tests` (baseline guards for RLS and function grants cover every new table/function automatically). Applied to the hosted project "ifiok ai" (`lojqrepxeafjhfhneile`, linked); 65 tests pass locally and remotely. Types in `lib/supabase/types.ts` are generated.
- **P0-04 done (10 Oct 2026), with Q18/Q19 open:** `app/(auth)/sign-in` (email + password sign in and create account in every environment, Q28; emailed codes when `AUTH_EMAIL_CODES=true`; forgot password at `/sign-in/reset` when `AUTH_PASSWORD_RESET=true`, Q29; Google when enabled), `app/auth/callback`, `app/auth/sign-out`, onboarding `app/(auth)/onboarding/*` (birth → consent → university → level → minutes; under-18 deletes the auth user), `lib/auth/*` (viewer, guards, onboarding rules, consent version), `app/(app)/today` (empty), legal drafts `/terms`, `/privacy`, `/ai` (OWN-06 review), `/api/ai/stub`. "What do you want to learn?" joins onboarding in P1-01. e2e `e2e/auth.spec.ts` runs against the hosted project when the secret key is present.
- **P0-06 mostly done (10 Oct 2026, 12 §4 Q23):** app shell `components/app/AppShell.tsx` (desktop sidebar + phone bottom nav, `AppNav.tsx`), page parts `components/app/Page.tsx` (PageHeader, PageBody, Panel, EmptyState), Today start hub, Courses, Practice and Me pages. Feature entry points and their open/closed state live in `lib/features.ts`: when a ticket ships a feature, set `open: true` and build the page at its `href`. Layout rule: app pages use the full width beside the sidebar; never a centred narrow column. Server components import button styles from `components/ui/button-styles.ts` (`Button.tsx` is a client module).
- **P0-10 done (10 Oct 2026, 12 §4 Q24):** AI gateway `lib/ai/gateway.ts` (policy → kill switch → caps → quota reserve → route/retry/fallback → JSON + control-char validation with one repair → `ai_calls` cost row → refund on failure), providers `lib/ai/providers/{gemini,anthropic}.ts`, skills registry `lib/ai/skills` (first skill: `moderate`), runtime config `lib/config.ts` (zod schemas in `lib/config-schema.ts`, 60 s cache), migration `ai_gateway` (`ai_spend_micros`, seeded `app_config`). Call AI only as `getGateway().run(skill, { userId, input })` from server code; catch `GatewayError` and show its message. Add a skill = schema + versioned prompt + registry entry + route in `app_config.ai_routes`. `pnpm test:integration` runs the real-quota race test and a live Gemini call (synthetic text only).
- **P1-01 done (10 Oct 2026, 12 §4 Q26):** migration `courses_concepts` (subjects, level bands, `search_courses`, `match_concepts`, `create_concept`, `apply_outline`, outline revision status), `embed` Edge Function + `lib/ai/embed.ts`, skills `topic_resolve` (batched), `outline_draft`, `scheme_extract` (photo/PDF), service `lib/courses/service.ts` (all writes and rules), reads `lib/courses/read.ts`, routes `/api/courses`, `/api/courses/:id/{join,outline,outline/draft,outline/extract,outline/revisions/:rev}`, `/api/learn`, client hooks `lib/queries/courses.ts`, screens `/courses` (search), `/courses/new`, `/courses/[id]` (outline workspace + history). e2e `e2e/courses.spec.ts` covers the "Done when" with real AI.
- **Names (10 Oct 2026, 12 §4 Q30):** migration `profile_names` (`first_name`, `last_name`; `display_name` derived as "First L." by trigger, not client-writable), rules in `lib/auth/names.ts` (zod; client code imports `NAME_MAX` from `lib/auth/name-limits.ts`), name fields on Create account, "Your name" on Me (`app/(app)/me/{actions.ts,NameForm.tsx}`), greeting in the `AppPage` header. Never put names in AI prompts.
- **P0-07/P0-08/P0-09 built with P1-02 (Oct 2026):** DSL `packages/core/src/dsl`, expressions `expr`/`expr-eval`, verifier `verify` (`verifyLesson(spec, chunks, { minScreens })`), fixtures `content/fixtures`, player `components/lesson/*` (`BlockRenderer` lazy-loads one renderer per block type from `components/lesson/blocks/`; client code imports `@ifiok/core/<module>` subpaths, never the root, which pulls in the verifier).
- **P1-02 in progress (16 Oct 2026, 12 §4 Q31–Q32):** pipeline `lib/lessons/pipeline.ts` (generate → verify → claim check → publish or `review`; unit-tested with fakes), service `lib/lessons/service.ts` (`getLessonState` is read-only, `startLessonForConcept` is POST-only, `runLessonJob`, `curateLesson`), migrations `lesson_publishing` (`enqueue_job_once`, `claim_job`, `publish_lesson_version`), routes `/api/concepts/:id/lesson`, `/api/lessons/:id`, `/api/lessons/:id/flags`, client `lib/queries/lessons.ts`. Groq is the second free provider. Still to do: P0-11 worker, two-step outline call, subject profiles, `trusted` promotion, curator queue/editor, refresh job.
- **P0-11 done (16 Oct 2026, 12 §4 Q33):** migration `jobs_runtime` (pgmq queues, `worker_read`/`worker_complete`/`worker_fail`/`worker_defer`, `wake_worker` via pg_net from Vault secrets, `jobs_wake` trigger, `ifiok-worker-sweep` cron every minute, Realtime on `jobs`), worker Edge Function `supabase/functions/worker` (130 s deadline, 1 heavy / 5 light per invocation, visibility 180 s, 3 attempts), handlers in `packages/core/src/jobs` (`noop`, `lesson_gen`), `/api/jobs/enqueue`, `useJob` (`lib/queries/jobs.ts`). Shared code: the AI gateway, providers (Gemini, Groq), skills, prompts, config, lesson pipeline/repo and DB types now live in `packages/core`; `lib/` re-exports them. **After editing anything in `packages/core`, run `pnpm sync:core`** (`pnpm check` fails otherwise); deploy the worker with `pnpm deploy:worker`; `pnpm setup:worker` (re)sets its secrets. Add a job type = handler in `packages/core/src/jobs` + entry in the worker's `handlers`.
- **Next:** the rest of P1-02 (two-step outline call, subject profiles, `trusted` promotion, curator queue/editor, refresh job), then P1-03. Empty folders from `02` §3 hold a `.gitkeep` until their ticket fills them.

## Next.js version notes
@AGENTS.md
