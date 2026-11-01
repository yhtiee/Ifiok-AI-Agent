# Ifiok

**The AI learning agent for Nigerian university students.** *See it. Try it. Master it.*

Ifiok turns a student's own course materials into lessons that move, practice that finds their weak spots, exam prep, and virtual labs. Students also **earn** when what they share, explain or teach helps other students, paid through **PayPal**. An AI tutoring agent finds a peer tutor when a student is stuck and drafts the booking inside a limit the student sets; only the student's approval moves money.

Built for the **PayPal AI Hackathon** (2026). Licence: [MIT](LICENSE).

- **Live demo:** https://ifiok-ai-agent.vercel.app
- **Code:** https://github.com/yhtiee/Ifiok-AI-Agent
- **Demo video:** _added at submission_

> **All payments run in the PayPal sandbox with test money.** Every money screen in the app says "Sandbox: test money". No real money moves.

---

## For judges: test accounts

Sign in at **https://ifiok-ai-agent.vercel.app/sign-in** with email and password.

Every Ifiok user is a **student**. Learning, sharing, explaining and tutoring are things any student can do, not separate roles. The two student accounts are set up for different parts of the demo. The admin account sees only the admin interface.

| Account | Email | Password |
|---|---|---|
| Student 1 (Amara N., 200 level) | `student1@judges.ifiok.test` | `Ifiok-xedcNmFJ5bwTVCQ9` |
| Student 2 (Tunde B., 300 level) | `student2@judges.ifiok.test` | `Ifiok-xedcNmFJ5bwTVCQ9` |
| Admin | `admin@judges.ifiok.test` | `Ifiok-xedcNmFJ5bwTVCQ9` |

**PayPal sandbox logins** (used on PayPal's own sandbox pages, not in Ifiok):

| PayPal sandbox account | Email | Password | Used for |
|---|---|---|---|
| Student 1's PayPal | `sb-estth53638508-1@personal.example.com` | `Ifiok-xedcNmFJ5bwTVCQ9` | Approving a tutoring payment |
| Student 2's PayPal | `sb-estth53638508@personal.example.com` | `Cw7x/x><` | Receiving tutoring and contribution payouts |

Both students take the same course, **IFK 102 · Electricity and Magnetism (Ifiok demo)**: Ohm's law, Kirchhoff's laws, Thevenin's theorem and Capacitors. Its lessons are already built.

### A 5-minute walkthrough

**1. Student 1: learning, and the tutoring agent (agentic commerce)**
1. Sign in as Student 1. **Today** shows what to do next.
2. **Courses → IFK 102 → Path**, then open **Kirchhoff's laws**. The lesson moves screen by screen; its numbers are computed by a maths engine, not the AI.
3. **Practice**: *Weak areas* shows Kirchhoff's laws, with the evidence ("1 of 5 right this week") and the most common mistake.
4. Under it, **Ifiok's tutoring agent** → **Find me a tutor**. The agent looks at Student 1's weak topics and the tutors within their **$15.00 limit**. It picks a topic, a tutor and a time, and shows its working ("Looked at 1 weak topic and 1 tutor within your $15.00 limit…") and its reason.
5. **Review and approve** → **Approve with PayPal**. Log in with Student 1's PayPal sandbox account and approve. Back in Ifiok, the booking says *"Paid, held on PayPal until the session ends"*: the payment is **authorised, not captured**.
6. On the booking, **The session happened** captures the payment, and Student 2 is paid out **minus Ifiok's 15% commission**. Or book again and press **Tutor didn't show**: the hold is **voided** and Student 1 pays nothing.

**2. Student 2: earning**
1. Sign in as Student 2. **Me → My earnings**: usage points this month (Student 1 learned from Student 2's shared notes and explainer), the shared notes now in the Library, and **Payouts** (sandbox).
2. **Me → Tutor profile**: the topics Student 2 tutors and the $8.00 price.
3. **Library**: Student 2's notes and explainer, open to every student.

**3. Admin: payouts and tutoring** (AG Grid tables)
1. Sign in as Admin. Admins only ever see the admin interface.
2. **Payouts**: pick this month, keep the $50.00 sandbox pool, **Close month**. The pool is split by usage points, capped at 20% per contributor; the rest stays in the pool. **Send payouts** sends one PayPal Payouts batch, and **Check PayPal** reads each item's status (webhooks do the same).
3. Back as Student 2: **My earnings** shows the payout. **Why this amount?** has the AI explain it in plain words, using only the recorded numbers.
4. **Tutoring**: every booking, where its money is, and **Pay the tutor / Refund the learner** for disputed ones.

> To reset the demo to this starting point, the maintainer runs `node --experimental-transform-types scripts/seed-judges.mts`.

---

## The problem

Nigerian university students learn from dense handouts, photocopied textbooks and past questions, often on a mid-range Android phone with small data bundles. There's rarely anyone to ask when they're stuck. Students who *do* understand a topic, and could explain it well, have no way to earn from that.

Ifiok gives each student an AI learning agent built on **their own course**, and turns students' knowledge into income: shared notes, explainers and tutoring are paid through PayPal when they help someone learn.

## What it does

**Learn**
- **Student-led courses.** A student adds their course and its outline (typed, photographed or from a PDF); topics map to shared concepts used by every university.
- **Lessons that move.** Interactive screens (plots with sliders, checkpoints, diagrams) written by AI as structured data, checked by a maths engine, then published. A wrong number never reaches a student.
- **Your own materials.** Upload notes, a textbook, past questions or a lab manual (PDF, Word or photos, up to 20 MB). Text is read on the phone, or by AI for photos and scans. When a student opens a topic, Ifiok builds the lesson from the pages that cover it and cites them ("From your notes, p. 12").

**Practise**
- **Practice and weak areas.** Every answer is re-marked on the server. Weak areas show the evidence, the most common mistake and the next step.
- **Exam prep.** Past questions are read, tagged by topic and turned into a study plan to the exam date, with worked solutions and a timed paper.

**Labs**
- **Virtual labs** for practicals students can't do: a seeded experiment engine with readings, least-squares fits and a printable report.

**Earn** (the PayPal part)
- **Share and explain.** Shared notes are checked by AI for copyright signs, personal details and duplicates. Explainers (written, voice or video) are reviewed. Both earn **usage points** when they help other students.
- **Contributor payouts.** Each month the pool is split by points (20% cap per person) and paid with **PayPal Payouts**.
- **Tutoring.** Book a student tutor; PayPal **authorises** the payment at booking, **captures** it after the session, or **voids** it if the tutor doesn't show.
- **Ifiok's tutoring agent.** Drafts a booking for a topic the student keeps missing, inside the student's spending limit. The student approves it on PayPal.

## How PayPal is used

All PayPal calls run on the server, through one small client ([`packages/core/src/payments/paypal.ts`](packages/core/src/payments/paypal.ts)) that refuses to run unless `PAYPAL_ENV=sandbox`.

| PayPal product | Where | How |
|---|---|---|
| **Orders v2**, `intent: AUTHORIZE` | Tutoring booking | The order's `custom_id` is the booking. After the learner approves on PayPal, Ifiok authorises it: the money is held, not taken. |
| **Authorizations: capture / void** | "The session happened" / "Tutor didn't show", admin dispute decisions, 24 h auto-release (a worker job) | Capture takes the held payment; void releases it so the learner pays nothing. |
| **Payouts** | Monthly contributor pool; the tutor's share after capture | One batch per month (`sender_batch_id` = the period); each item's `sender_item_id` is the payout line or booking. |
| **Webhooks** + `verify-webhook-signature` | `/api/paypal/webhook` | The signature is verified on the raw body, then the item, authorisation or capture is **fetched from PayPal** before anything is recorded. |

**Money safety**
- Every state change goes through an **idempotent SQL function**, so a replayed webhook or retried request changes nothing twice (tested with 3× replays).
- Every money-moving POST carries a `PayPal-Request-Id`.
- The pool split runs in SQL with database checks: lines never exceed the pool, and no line exceeds 20%.
- Sandbox amounts are **USD**, because PayPal's sandbox doesn't hold naira. After the hackathon, real payouts move to a Nigerian provider in naira, because PayPal accounts in Nigeria can't receive money.

## How AI is used

Every model call goes through Ifiok's own **AI gateway** on the server: per-student daily allowances, a global spending cap, retries and fallback, JSON validation, and a cost log. No AI call is made from the browser. Model choices live in the database, not the code. Personal details are stripped from text before it's sent, and names are never put in prompts.

| Tool | Used for |
|---|---|
| **Groq · `openai/gpt-oss-120b`** | Lessons, lesson repair, practice questions, worked solutions, past-paper extraction, lab set-ups, **the tutoring agent** |
| **Groq · `openai/gpt-oss-20b`** | Topic matching, outline drafts, error explanations, curation checks, explainer review, answer checks, **payout explanations** |
| **Groq · `whisper-large-v3-turbo`** | Captions and transcripts for voice and video explainers |
| **Google Gemini · `gemini-3.5-flash`** | Images: photos and scanned pages (OCR), photographed course outlines, video frames; also the fallback for text |
| **gte-small** (Supabase Edge Function) | Embeddings for searching materials and grounding lessons |

**The model explains; engines compute.** Lessons are structured JSON (a lesson DSL), never HTML or code. Every number is checked by **mathjs**. Practice questions whose stated answer disagrees with the engine are dropped. Payout explanations keep the AI's wording only if every number in it comes from the ledger.

**The tutoring agent** ([`lib/payments/agent.ts`](lib/payments/agent.ts), [`agent-rules.ts`](lib/payments/agent-rules.ts)):
- The server gathers the student's weak topics (from server-recorded answers), the tutors who teach them **within the student's own limit**, and the sessions already booked.
- The model sees **reference codes** (W1, T1), never names or ids. It picks the topic, tutor and time and explains why.
- The server checks every reference, the time, and every number in the reason; if anything fails, simple rules pick instead.
- The draft is stored with a database check that it's within the limit. Only the student's approval on PayPal creates the payment.

## Other tools

- **Next.js 16** (App Router, TypeScript strict) on **Vercel**; Tailwind CSS v4, Radix UI and shadcn/ui; TanStack Query; zod.
- **Supabase**: Postgres with row-level security on every table, pgvector, pgmq job queues, pg_cron, Storage, Auth, and an Edge Function worker (Deno).
- **AG Grid Community** (sponsor tool): the admin Payouts and Tutoring tables.
- **pdf.js** and **mammoth** (reading PDFs and Word documents on the phone), **KaTeX** (maths), **mathjs** (the maths engine).
- **Playwright** and **Vitest** for tests, **pgTAP** for database tests.

---

## Run it yourself

**Needs:** Node 22+, pnpm 11 (`corepack enable`), a Supabase project, Groq and Gemini API keys, and a PayPal developer account with a sandbox app.

```bash
git clone https://github.com/yhtiee/Ifiok-AI-Agent.git
cd Ifiok-AI-Agent
pnpm install
cp .env.example .env          # then fill in the values below
```

**Environment** (all listed in [`.env.example`](.env.example)):
- **Supabase:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `INTERNAL_FUNCTION_SECRET`
- **AI:** `GROQ_API_KEY`, `GEMINI_API_KEY`
- **PayPal sandbox:** `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_WEBHOOK_ID`, `PAYPAL_ENV=sandbox`. Point the app's webhook at `https://<your-site>/api/paypal/webhook`, subscribed to payout item, authorization and capture events. Use **US** sandbox personal accounts for anyone who receives money.
- **Site:** `NEXT_PUBLIC_SITE_URL`

**Database and worker:**
```bash
pnpm exec supabase link --project-ref <your-project-ref>
pnpm db:push            # apply the migrations (seeds universities and app config)
pnpm setup:worker       # set the worker's secrets and the Vault secrets that wake it
pnpm deploy:worker      # deploy the job worker Edge Function
```

**Run:**
```bash
pnpm dev                                                   # http://localhost:3000
node --experimental-transform-types scripts/seed-judges.mts  # optional: demo accounts and course (needs JUDGE_PASSWORD in .env)
node --experimental-transform-types scripts/paypal-check.mts # optional: send a $1.01 sandbox payout to PAYPAL_TEST_RECEIVER
```

**Tests:**
```bash
pnpm check                          # typecheck, lint, unit tests, database tests (PGlite), formatting
PW_CHANNEL=chrome pnpm test:e2e     # end-to-end against your project (real AI and PayPal sandbox)
pnpm test:integration               # live checks: AI gateway, materials, PayPal sandbox
```

## Project structure

```
app/(app)            the student app: Today, Courses, Practice, Labs, Library, Me, tutoring
app/(admin)          the admin interface: Review, Payouts, Tutoring
app/api              route handlers (PayPal webhook, payouts, tutoring, materials, lessons, …)
components/          UI: lesson player, labs, admin grids, payments
lib/                 server services: payments, AI gateway access, materials, lessons, learning
packages/core        shared TypeScript (AI gateway and skills, PayPal client, jobs, lesson DSL and verifier)
supabase/            migrations, pgTAP tests, the worker Edge Function
specifications/      the full product spec, build plan and decision log
e2e/                 Playwright tests
```

The product spec and every design decision are in [`specifications/`](specifications/README.md). The decision log is [`specifications/12-review-log.md`](specifications/12-review-log.md); the PayPal decisions are Q43 and Q61–Q63. Rules for contributors and coding agents are in [`CLAUDE.md`](CLAUDE.md).

## Licence

[MIT](LICENSE) © 2026 Utibeabasi Ekpenyong
