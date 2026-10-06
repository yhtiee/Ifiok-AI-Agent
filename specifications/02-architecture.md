# 02 · Architecture

## 1. Stack (pinned choices)

| Concern | Choice | Why | Fallback |
|---|---|---|---|
| Web app | **Next.js (App Router) + TypeScript strict**, pinned to the newest version that `@opennextjs/cloudflare` lists as supported | Owner's stack; SSR for fast first load; route-level code splitting | — |
| Hosting (prod) | **Cloudflare Workers Paid ($5/mo) via `@opennextjs/cloudflare`**, Smart Placement on (runs SSR near the database region) | Cheapest host that allows commercial use; 10M requests included; free plan's 10 ms CPU is too low for SSR. Worker size limit is 64 MiB on all plans since Sept 2026 | Vercel Pro ($20/seat/mo) |
| Hosting (dev/preview) | Local `next dev`; Cloudflare preview deployments | Free | — |
| Database/Auth/Storage | **Supabase** (Postgres + pgvector + pg_cron + pg_net + Queues/pgmq, Auth, Storage, Realtime, Edge Functions) | One platform, RLS-first, generous free tier | — |
| Background jobs | **Supabase Queues (pgmq)** + Edge Function workers, kicked by `pg_net` on enqueue and swept by `pg_cron` each minute | No extra service; jobs live next to data | Cloudflare Queues |
| Styling | Tailwind CSS v4 with CSS-variable design tokens (`07`) | Fast to build; tokens keep it on-brand | — |
| UI primitives | **Radix UI primitives** (unstyled) + our own components | Accessibility without a generic look | — |
| Client data | TanStack Query; Zustand for local lab/lesson state | Caching, offline-friendly | — |
| Validation | **zod** for every boundary (API, AI output, Lesson DSL, env) | One schema language, client and server | — |
| Maths | **mathjs** on the server and in Edge Functions (parse, evaluate, derivative, simplify); on the client only a ~3 KB AST interpreter for pre-compiled plot expressions (`05` §3), plus mathjs lazily for `expression` items and offline grading; **KaTeX** pre-rendered at save time (pin the KaTeX version Mafs depends on, so only one copy ships); **MathLive** for maths input (lazy) | One engine family keeps checks consistent; small client bundle | Compute Engine for hard LaTeX |
| Interactive plots | **Mafs** (React + SVG) | Draggable points and sliders, small | Custom SVG |
| 3D | three.js via **@react-three/fiber + drei**, route-split | Reuse the PC Build prototype | 2D SVG fallback |
| PDF | **pdfjs-dist** in a Web Worker | On-device text extraction (privacy, cost) | — |
| Spaced repetition | **ts-fsrs** | Proven algorithm, MIT | — |
| PWA/offline | **Serwist** + IndexedDB (Dexie). Next builds with Turbopack by default; use Serwist's Turbopack integration, or build with webpack if that is not stable (decide in P0-01 and record it) | Offline pinned lessons, outbox | Hand-written service worker |
| Payments | **Paystack** (Inline checkout, webhooks, Transfers) | Nigerian rails, no monthly fee | Flutterwave |
| Email | **Resend** (free tier) as Supabase Auth SMTP and digests | Supabase's built-in SMTP is rate-limited | — |
| Errors/analytics | Sentry free tier; PostHog free tier (no PII in events) | Free | Supabase logs only |
| AI | **AI gateway** in our code (`04`); default **Gemini paid tier** (Flash-Lite / Flash), fallback **Claude Haiku 4.5** | Cheapest capable; provider switch by feature and age | — |
| Embeddings | **gte-small** (384-d) inside Supabase Edge Functions (`Supabase.ai.Session`). Batches of ≤ 16 chunks per invocation (2 s CPU limit); chunks ≤ 350 word-pieces (gte-small truncates at 512) | No per-call API cost | Workers AI `@cf/baai/bge-small-en-v1.5` (also 384-d, called in-process from the Worker, removes a network hop for tutor queries; re-embed everything if you switch, never mix models) |
| Speech (P3) | Groq `whisper-large-v3-turbo` | ~$0.04/hour of audio | OpenAI transcribe |

> Verify versions and prices at build time. Never pin to a model name in code: model IDs live in `app_config` (`04` §3).

## 2. System diagram (text)

```
 Phone (PWA)                                   Supabase
 ─────────────                                 ─────────────────────────────
 Next.js pages ──HTTPS──► Cloudflare Worker ──► Postgres (RLS)  ◄── pg_cron
   │  pdf.js worker       (Next.js server)        │  pgvector, FTS, pgmq queues
   │  Mafs/KaTeX/three    • route handlers        │        │ pg_net on enqueue
   │  IndexedDB outbox    • AI gateway (stream)   │        ▼
   │                      • Paystack webhook     Edge Functions (Deno workers)
   │                                               • worker: lesson_gen, items_gen,
   └── Supabase JS (auth, RLS reads/writes) ─────►   mark_*, ocr, curate, notify…
                                                   • embed (gte-small)
                                                   • export-data, delete-account
                                           External: Gemini / Anthropic (AI),
                                           Paystack, Resend, Groq (P3)
```

**Rules:**
- **Request middleware:** use `middleware.ts` in the form OpenNext Cloudflare supports (Edge runtime). Do not use a Node-runtime `proxy.ts` unless OpenNext documents support for it.
- **Learning a new concept:** `POST /api/learn` → moderation → `topic_resolve` → if the concept has a published lesson, return it (no AI); else `enqueue_job('lesson_gen', dedupe lesson:{concept})`, and only if that created a new job, `consume_quota('new_lesson')` (refunded if the lesson fails its checks) and charge the library budget → client watches the job and shows the step list and a quick tutor explainer → publish on pass (F2-FR5).
- The browser talks to Supabase directly for **RLS-protected reads and low-stakes writes**: `lesson_progress` (UI resume state only), lab runs, goals, push subscriptions, skipping a plan task. **Learning evidence** (attempts and screen events) goes through `POST /api/sync`, which validates and re-grades it; review cards, mastery, task completion and `daily_activity` are written there too. Rewards and usage points read only these server-written rows.
- Anything that costs money, touches money, calls AI or needs the service role goes through **server code** (Next route handlers or Edge Functions). The service-role key never reaches the client.
- **Interactive** AI (tutor chat streaming, short checks ≤ 20 s) runs in Next route handlers on Cloudflare. **Long or batch** AI (lesson generation, item generation, OCR, curation, marking) runs as queued jobs in Edge Functions.

## 3. Repository layout

```
/                       Next.js app (single repo)
├─ CLAUDE.md
├─ app/
│  ├─ (marketing)/        landing, about, privacy, terms
│  ├─ (auth)/             sign-in, onboarding/*
│  ├─ (app)/              today, courses/[courseId], learn/[lessonId],
│  │                      lab/[slug], practice, snap, exam/[courseId] (P2),
│  │                      library, bank (P2), wallet (P2), groups (P3), settings
│  ├─ (teach)/teach/...   lecturer area (P2)
│  ├─ (admin)/admin/...   admin (P1 minimal)
│  └─ api/
│     ├─ tutor/route.ts            streaming tutor
│     ├─ verify/route.ts           server-side checks
│     ├─ sync/route.ts             offline outbox: attempts, task completions (re-graded)
│     ├─ jobs/enqueue/route.ts     authenticated job submission
│     ├─ courses/route.ts          create/search courses (normalise, near-duplicates, moderation)
│     ├─ courses/[id]/outline/route.ts  outline edits, uploads, AI draft; topic_resolve
│     ├─ learn/route.ts            "What do you want to learn?": resolve a topic to a concept, open or generate its lesson
│     ├─ lessons/[id]/route.ts     curator/admin edits and publishing (verification gate, audit)
│     └─ paystack/webhook/route.ts
├─ components/
│  ├─ ui/              design-system components (Button, Sheet, Card, Chip…)
│  ├─ lesson/          one renderer per Lesson DSL block type
│  ├─ labs/            lab modules: ohms-law/, pc-build/ (+ 2d fallback)
│  └─ app/             feature components (TodayTimeline, PathMap, Wallet…)
├─ lib/
│  ├─ ai/              gateway.ts, providers/*, skills/*, prompts/*, budgets.ts
│  ├─ dsl/             lesson schema (zod), validators, migrations
│  ├─ verify/          math verification (mathjs), equivalence, tolerances
│  ├─ agent/           planner.ts, triggers.ts, mastery.ts, fsrs.ts
│  ├─ economy/         client helpers only (all money logic is SQL)
│  ├─ pdf/             worker, outline, page-range matcher
│  ├─ supabase/        server/client factories, typed queries
│  └─ offline/         dexie schema, outbox, sync
├─ packages/core/      pure TS shared with Edge Functions (dsl, verify, prompts)
├─ supabase/
│  ├─ migrations/      SQL (schema, RLS, functions) — see 03
│  ├─ functions/       worker/ (one function; handlers/<queue>.ts), embed,
│  │                   export-data, delete-account
│  ├─ seed/            universities, micro-skill vocabularies, optional cache-warm list
│  └─ tests/           pgTAP RLS and ledger tests
├─ content/            DSL fixtures for tests, lab copy (no curated course content)
├─ e2e/                Playwright
└─ specifications/          this spec
```

**Shared code:** `packages/core` holds pure ESM TypeScript (no Node or browser APIs): the Lesson DSL schema, the verifier, prompt builders and constants. The Next app imports it directly; Edge Functions import it through the Deno import map. If Supabase bundling rejects imports outside `supabase/functions`, add `scripts/sync-core.ts`, which copies `packages/core` into `supabase/functions/_shared/core` before deploy (CI checks the copies are identical).

## 4. Jobs

Table-backed queue using **pgmq** (Supabase Queues). Queues: `lesson_gen`, `items_gen`, `ocr`, `curate`, `mark_transcribe`, `mark_verify`, `exam_extract`, `embed`, `notify`, `payouts`, `noop` (tests).

- **Enqueue** only via SQL function `enqueue_job(queue, payload, dedupe_key)`. It inserts a row into `jobs` (status tracking, visible to the owner via RLS) and sends to pgmq. A trigger calls the `worker` Edge Function via `pg_net` for low latency.
- **Worker** Edge Function: each invocation has a **130 s deadline** (free plan wall clock is 150 s per invocation, and only ~2 s of CPU per request, so heavy CPU such as verification or embedding is split into small steps). It reads **1 message** for heavy queues (`lesson_gen`, `items_gen`, `mark_transcribe`, `mark_verify`, `ocr`, `curate`, `exam_extract`) and up to 5 for light ones (`notify`, `embed` batches, `noop`), with a pgmq visibility timeout of 180 s so a crashed run reappears. On success it archives the message. On failure it increments `attempts`; after 3 attempts → `failed` with the error, and the user sees a retry button.
- **Sweeper:** `pg_cron` every minute calls `worker` (picks up anything the trigger missed).
- **Dedupe:** `dedupe_key` (e.g. `lesson:{concept_id}:v{dsl_version}`) unique on active jobs, so two students anywhere opening the same new concept create one job.
- **Splitting:** any job that could exceed the deadline is split into steps that enqueue the next step (e.g. OCR per page; lesson generation = outline job → blocks job → verify job).
- **Security:** `enqueue_job` is server-only (`03` §5). `/api/jobs/enqueue` accepts only user queues (`mark_transcribe`, `ocr`, private `lesson_gen`), applies the 30/day limit, and sets `owner_id` from the session. Handlers check that every id in a payload belongs to the job's owner or is shared.
- Clients watch job status via Supabase Realtime on `jobs` (fallback: poll every 3 s).

## 5. AI request paths
- `POST /api/tutor` (stream): auth → age/consent check → `consume_quota` (`04` §5) → query embedding → retrieval (`match_chunks` with the session user's id, `03` §9) → gateway stream (prose streamed; `ifiok-blocks` section held back) → verify blocks → send `blocks` event → persist messages + `ai_calls` row. Refund the quota if the model call fails.
- Queued skills (`lesson_gen`, etc.): payload references DB ids only; the worker loads data with the service role, calls the gateway, validates output with zod, verifies maths, writes the results and records `ai_calls`.

## 6. Offline and low-data
- **App shell** precached by Serwist (HTML shell, CSS, core JS, fonts subset).
- **Pinned topics:** "Pin for offline" downloads the lesson JSON, its items, KaTeX CSS and the lab chunk into IndexedDB/Cache Storage. Max 20 pinned topics (≈ 3 MB).
- **Outbox:** attempts and screen events are written to IndexedDB first with a client UUID, then sent to `/api/sync`, which re-grades, upserts on the client UUID (idempotent), updates mastery, review cards, `daily_activity` and task completion. Client clocks are clamped to the server receive time. A screen event is accepted only if the lesson is published or superseded and the user is enrolled, the `screen_id` exists in that lesson, screens arrive in order, it comes ≥ 5 s after the user's previous event, and a checkpoint screen has a matching attempt.
- **Data-saver** (auto-on when `navigator.connection.saveData` or effectiveType is 2g/3g): no 3D auto-load, no images except essential, lower-resolution uploads.

## 7. Performance budgets (CI-enforced where possible)
| Budget | Target |
|---|---|
| JS on Today (gzipped, initial) | ≤ 170 KB |
| JS on the lesson shell (gzipped, initial; KaTeX is pre-rendered HTML + CSS, plots use the AST interpreter, no mathjs) | ≤ 200 KB |
| Each lazily loaded block chunk (Mafs, a 2D lab) | ≤ 120 KB gz. MathLive (~225 KB gz) is the known exception: load it only when an `expression` item is on screen |
| LCP on Today, mid-range Android, 4G | ≤ 2.5 s |
| Lesson JSON payload | ≤ 60 KB |
| 3D lab chunk | ≤ 650 KB gz, lazy |
| Fonts | 3 families (display, text, mono for instruments only), subset Latin, self-hosted via `next/font`, `display: swap` |
| Images | AVIF/WebP, `next/image` with Cloudflare loader or plain `<img>` with explicit sizes |

## 8. Environments
- **local:** `supabase start` (Docker) + `next dev`. Seed with `supabase db reset`.
- **staging:** Supabase free project #2 + Cloudflare preview. Synthetic data only.
- **production:** Supabase project #1 (Free during the pilot, **Pro before any payment goes live**) + Cloudflare Workers Paid.

## 9. Configuration and secrets
Env vars (validated with zod at boot, see `lib/env.ts`):
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (server only), `GEMINI_API_KEY`, `ANTHROPIC_API_KEY`, `PAYSTACK_SECRET_KEY`, `NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY`, `RESEND_API_KEY`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `SENTRY_DSN`, `POSTHOG_KEY`, `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`, `GROQ_API_KEY` (P3).
Runtime config (in the DB, editable by admin, cached 60 s): model IDs per skill, quotas, Unit prices, pool percentage, kill switches. See `03` `app_config`.

## 10. CI (GitHub Actions)
On every PR: typecheck, lint, unit tests (Vitest), DSL fixture validation, bundle-size check. **Path-filtered** (to stay inside GitHub's free minutes): `supabase test db` only when `supabase/**` changes; Playwright smoke when `app/**` or `components/**` change; full Playwright nightly. AI eval suite (`11`): on any PR that changes `lib/ai/prompts`, `lib/ai/skills` or model routes (affected skills only), plus a weekly full run against staging; each run is capped at $2.
