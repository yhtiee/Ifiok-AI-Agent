# 08 · Security, privacy and compliance

Not legal advice. Items marked **[confirm]** need a Nigerian data-protection lawyer or a licensed Data Protection Compliance Organisation (DPCO) before the phase they gate.

## 1. Threat model (what we protect, from whom)

| Asset | Main threats | Primary controls |
|---|---|---|
| Student data (profile, progress, private textbook text, photos of working) | Other users reading it; staff over-reach; breach | RLS on every table, owner-only private content, private buckets, short retention |
| Money (Units, Earnings, payouts) | Forged credits, replayed webhooks, farming rings, account takeover → withdrawal | Ledger changed only by SQL functions, HMAC webhooks + verify call, idempotency keys, 30-day hold, name-match on bank accounts, MFA for admins |
| AI budget | Quota bypass, scripted abuse, prompt-stuffing to raise cost | Server-only AI calls, per-user quotas in DB, global daily cap, max tokens per skill, captcha on signup |
| Shared lessons and bank | Wrong or harmful content, copyright violations, prompt injection via uploads | Human publish in P1, verification, flags, curation pipeline, takedown flow, sources treated as data |
| Admin powers | Stolen admin session | TOTP MFA (aal2) required by `is_admin()`, audit log, no admin actions from shared devices |

## 2. Application security rules

### 2.1 Auth and sessions
- Supabase Auth with `@supabase/ssr` (PKCE, HTTP-only cookies). Session refresh in `middleware.ts`. Never store tokens in `localStorage`.
- Sign-in methods: Google OAuth and 6-digit email code. **Cloudflare Turnstile** (free) on the email-code request and signup (Supabase Auth supports a captcha provider natively).
- Admins: TOTP MFA mandatory. `is_admin()` checks the JWT `aal` claim is `aal2` (`03` §8). The admin route group redirects to MFA enrolment if missing.
- Lecturers: staff-email domain check plus admin approval (F12). Their role is set only by server code.
- `profiles.role`, `status`, `is_adult` and `birth_*` are not client-writable (column grants in `03` §8).

### 2.2 Server boundaries
- **Service-role key only on the server** (Cloudflare secrets, Supabase function secrets). A CI check fails the build if `SUPABASE_SERVICE_ROLE_KEY` appears in any file under `app/` that is a client component, or in the client bundle (grep the `.next`/OpenNext output for the key name and the key prefix).
- Every route handler starts with `requireUser()` (or `requireAdmin()`), then validates input with zod. No handler trusts IDs from the client without re-checking ownership in SQL.
- Anything that changes money, mastery, rewards or AI spend runs on the server: `/api/tutor`, `/api/sync` (attempts, re-graded), `/api/jobs/enqueue`, `/api/topup/*`, `/api/paystack/webhook`, economy SQL functions.
- **Low-stakes client writes** (`lesson_progress` as UI state only, lab runs, goals, push subscriptions, skipping a plan task) go straight to Supabase under RLS. **Evidence** (attempts and screen events) goes only through `/api/sync`, which validates it (`02` §6). Rewards (`earn_units`) and usage points (`record_usage`) read only server-written rows: attempts, `screen_events`, `mastery`. The earned-Units cap (40/month) and "Units never cash out" bound the damage of any remaining gaming.

### 2.3 HTTP hardening (set in `middleware.ts` / `next.config`)
- `Content-Security-Policy`: `default-src 'self'`; `script-src 'self' 'nonce-…' https://js.paystack.co https://challenges.cloudflare.com` (nonces only on dynamic app routes; static marketing pages use hashes so they stay cacheable); `style-src 'self' 'unsafe-inline'` (KaTeX and Paystack Inline set inline styles); `font-src 'self' data:`; `manifest-src 'self'`; `connect-src 'self' https://<project>.supabase.co wss://<project>.supabase.co https://*.ingest.sentry.io https://eu.i.posthog.com https://api.paystack.co`; `frame-src https://checkout.paystack.com https://challenges.cloudflare.com`; `img-src 'self' data: blob: https://<project>.supabase.co`; `worker-src 'self' blob:` (pdf.js worker). Start in report-only mode in P0, enforce from P1.
- `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=(self), microphone=()` (microphone only on the lecturer recording route in P3), `frame-ancestors 'none'`.
- All maths and markdown from AI or users is rendered through our components: KaTeX with `trust: false` and `maxExpand` limits; markdown through a sanitising renderer that allows only the DSL subset (no raw HTML, no links except `https:` with `rel="noopener noreferrer nofollow"`).

### 2.4 Rate limits and abuse
| Layer | Limit |
|---|---|
| Cloudflare WAF rate-limiting rule (free plan includes one rule) | Only on our own auth callback and webhook paths (`/auth/callback`, `/api/paystack/*`): 30 requests / 10 s per IP → block 60 s. Sign-in and email-code calls go from the browser straight to Supabase, so they are protected by Turnstile and Supabase Auth's own rate limits. **Not** on `/api/*` in general: Nigerian mobile networks (carrier-grade NAT) and campus Wi-Fi put whole hostels behind one IP |
| Per user (DB, `daily_usage`) | Tutor 8 free/day + Units; marks 2 free/day + Units; job enqueues 30/day; uploads 10/day; reports 20/day |
| Global (DB, `ai_calls`) | Daily AI spend cap (`04` §5) |
| Auth | Supabase Auth rate limits plus Turnstile |
| Withdrawals | 1 pending withdrawal per user; 2 per month |

### 2.5 Uploads
- **Stage 1 (MVP-01):** PDFs are read on the device with pdf.js; only the text of the pages the student picks is sent (`POST /api/materials`, personal data stripped by `redact.ts`) and no file is stored. The rules below apply to files that are stored (photos, explainer media, later uploads).
- Allowed: PDF, JPEG, PNG; ≤ 20 MB (bank), ≤ 2 MB (snap photos after client compression). Check **magic bytes** on the server, not just the extension or MIME type.
- Photos are re-encoded on the device through a canvas before upload, which **strips EXIF data (including GPS)**. The server rejects JPEGs that still carry GPS tags.
- Files live in private buckets and are served only through 60-second signed URLs after an RLS check, with `Content-Disposition: attachment` for downloads. PDFs are shown in our pdf.js viewer, never the browser's native viewer from our origin.
- No server-side antivirus in the cheap plan. The accepted-types list, private buckets and the pdf.js viewer are the mitigation. Revisit (e.g. ClamAV in a worker) when bank uploads exceed ~1,000/week.

### 2.5b Student-created names and content
- Course names, topic names and outline edits are user content: keyword filter + `moderate` before saving; blocked names never create concepts. Rate limits: 5 courses/day, 20 new concepts/day, 10 outline edits/day per user.
- **Squatting:** a course's title and subject are editable wiki-style with history (`/api/courses/:id`); a lecturer or rep claim locks them.
- **Vandalism:** outline edits only from users enrolled ≥ 3 days with ≥ 1 study session; edits by accounts with < 3 sessions wait for one other member to confirm; full history and one-tap revert; a lecturer or rep can lock the outline; repeated vandalism suspends editing for that user.
- **Concept spam:** concepts created from typed topics stay unlisted in search until their lesson is published and opened by ≥ 2 students.
- **Bank privacy and scraping:** clients can read only their own sources and chunks. Other students see crowd material only as cited snippets (`/api/citations/:chunk_id`, served only for chunks cited in a lesson or tutor reply they can see) and, for notes/lab manuals/solutions, as 60 s signed downloads for members of the source's course. Past papers are never shown; they feed exam maps and item style on the server.
- Crowd (bank) material is shown to students at other universities, so curation also strips personal data (names, phone numbers, matric numbers) from uploads before approval, and copyright checks apply globally.

### 2.6 Prompt injection and AI output
- Uploaded or retrieved text is wrapped in `<source id=…>` tags and the system prompt says it is reference material, never instructions (`04` §7).
- Skills have no write tools. The tutor's tools are read-only (retrieval through `match_chunks`, which is `security definer`, service-role only and filtered by the session user; maths). AI output is parsed against zod schemas, so injected "instructions" cannot cause actions.
- AI output never contains executable code that runs on the client (Lesson DSL only, `05`).
- The `curate_classify` skill gets the upload text with any line that looks like an instruction to the model left in place but flagged; uploads that contain prompt-injection patterns ("ignore previous instructions", "system prompt") go to `needs_review`.

### 2.5c Explainer media (Stage 3, F18)
- Voice: WebM/Opus or MP4/AAC ≤ 5 min; video: MP4/WebM ≤ 3 min, 480p, ≤ 40 MB. The browser compresses before upload; the server checks magic bytes, duration and size and rejects anything else.
- Upload goes straight to a **private** object-storage bucket with a short-lived signed URL tied to the author and a pending explainer row; nothing is playable by others until review passes; playback uses short-lived signed URLs.
- Video metadata (including location) is stripped by re-encoding on the device; uploads that still carry GPS metadata are rejected.
- Withdrawn or rejected media is deleted within 7 days; transcripts of rejected media are deleted with it.

### 2.7 Payments
- Paystack webhook: verify `x-paystack-signature` (HMAC-SHA512 of the **raw** request body with the secret key) using a constant-time compare before parsing JSON. Then call **Verify Transaction** and compare amount, currency and reference with our `topups` row (`06` §6). Optionally also allow-list Paystack's published webhook IPs at the Cloudflare layer.
- All economy functions are idempotent on a key; replaying a webhook changes nothing (pgTAP test).
- Bank account numbers are never stored in full: we keep Paystack's `recipient_code`, bank code, last 4 digits and the resolved account name.

### 2.7c PayPal (MVP, sandbox; `12` §4 Q43)
- Sandbox credentials only; the app refuses to start PayPal calls when `PAYPAL_ENV` isn't `sandbox` until Stage 3 legal review approves live mode.
- Webhooks: verify with PayPal's verify-webhook-signature API (transmission id, time, cert URL, auth algo, signature, our webhook id) against the **raw** body, then fetch the order or payout from PayPal, then post via SQL (guardrail 12's pattern).
- All PayPal state changes go through idempotent `security definer` functions keyed on the PayPal ID (guardrail 5); payout and booking tables are not client-writable.
- PayPal emails are personal data: stored only for payouts, never sent to AI, covered by export and deletion.

### 2.7b Tutoring escrow (Stage 3, F17)
- Tutoring payments go to a **licensed escrow/payment partner**; Ifiok never receives or holds those funds. We store bookings, state transitions and the partner's references only.
- Partner callbacks are verified like Paystack's (signature on the raw body, then a server-side status lookup) before a booking changes state; every transition is idempotent on the booking id.
- Release, refund and dispute rules are enforced server-side (`06` §12); the client can only confirm, cancel within the allowed window or open a dispute.
- Tutors need a name-matched payout account (`06` §5 rule 7) and are 18+; the chat filters contact details until a booking is paid.

### 2.8 Secrets and keys
- Secrets live only in Cloudflare (Worker secrets), Supabase (function secrets) and GitHub Actions (CI). `.env.local` is git-ignored; `lib/env.ts` validates at boot and refuses to start with a missing secret.
- Rotate the Paystack, AI and service-role keys when anyone with access leaves, and at least yearly. Keep a key inventory in the private ops doc (not in the repo).

### 2.9 Logging and monitoring
- Sentry with `sendDefaultPii: false` and a `beforeSend` scrubber that drops request bodies, emails and anything under `tutor`, `submission` or `source` keys.
- PostHog events carry the user's UUID only: no names, emails, DOB, course text or tutor content. Autocapture off; session recording off.
- Prompts and AI responses are never written to logs (`04` §2). Tutor messages are stored only in `tutor_messages` for the owner.
- Alerts (email to the owner): AI spend at 80% of the daily cap, webhook signature failures > 5/hour, job failure rate > 10%/hour, any `post_txn` exception.

### 2.10 Backups and recovery
- **Pilot (Supabase Free has no backups):** nightly GitHub Action runs `supabase db dump` against the **session pooler** connection string (the direct database host is IPv6-only, which GitHub runners can't reach; the CLI also avoids `pg_dump` version mismatches), data and schema → encrypts with `age` → uploads to a private Cloudflare R2 bucket (10 GB free). Keep 14 daily and 8 weekly copies. Restore drill once before pilot start.
- **From P2 (Supabase Pro):** daily managed backups (7 days) plus the nightly R2 dump (kept for 90 days). Point-in-time recovery is a paid add-on; skip until revenue justifies it.
- Storage buckets are not in `pg_dump`: bank files are mirrored weekly to R2; private uploads are not (they are short-lived by design).

## 3. Age policy and minors

**Launch rule: 18+ only.** Two reasons, both binding:
1. Gemini API terms prohibit use in services "directed towards or likely to be accessed by individuals under the age of 18". Ifiok's default models are Gemini.
2. The NDPA treats a child as under 18 and requires consent from a parent or guardian and appropriate age verification before processing a child's data.

**Implementation (F0):** DOB (month and year) is the first onboarding step → `is_adult` computed server-side. **Under 18: we keep nothing.** The server deletes the auth user and profile in the same request and shows a plain explanation plus one line: "Ask a parent or guardian to email minors@… if you'd like us to tell you when Ifiok supports under-18s." No waitlist row is created for a child (the NDPA requires a parent's or guardian's consent). Server routes and Edge Functions also check `is_adult_active()` as a second line; tests prove that an under-18 sign-up leaves no rows and that a non-adult profile gets 403 from every AI endpoint.

**Known gap:** self-declared DOB. First-year undergraduates in Nigeria can be 16–17. Terms say users must be 18+; the onboarding copy asks honestly; accounts reported as minors are blocked pending review.

**Path to minors (Later, needs its own spec):**
- Route minor accounts only to a provider whose terms allow under-18 use with safeguards (Anthropic and OpenAI publish requirements), keep Gemini for adults.
- Implement those safeguards: age verification beyond self-declaration, verifiable parental consent (NDPA), stricter moderation on inputs and outputs, no open-ended chat outside study topics, no social features with adults, monitoring and reporting, and clear AI disclosure.
- DPIA specific to minors **[confirm]**.

## 4. NDPA 2023 and GAID 2025 compliance plan

The Nigeria Data Protection Act 2023 is enforced by the Nigeria Data Protection Commission (NDPC). The General Application and Implementation Directive (GAID) took effect on 19 September 2025.

| Obligation | What Ifiok does | When |
|---|---|---|
| Lawful basis per purpose | Contract (providing the service), consent (AI processing disclosure, marketing, lecturer recordings), legitimate interest (fraud prevention, security). Recorded in a processing register (`docs/ops/ropa.md`, private). | P0 |
| Transparent notice | Plain-language privacy notice (what, why, who processes it, where, how long, rights), linked at signup and in settings. Consent versions in `consents`. | P0 |
| Data minimisation | DOB year/month only; no phone number; no photo; private textbooks processed on-device; only confirmed page text stored. | P0 |
| Registration as a data controller of major importance | NDPC tiers (data subjects processed in 6 months): Ordinary-High > 200 (₦10,000, annual), Extra-High > 1,000 (₦100,000, plus annual compliance audit returns through a licensed DPCO), Ultra-High > 5,000 (₦250,000, plus annual returns). Sources disagree on GAID's figures, so take the stricter reading: a 300-student pilot is already above 200, so **register at Ordinary-High before the pilot opens** **[confirm with a DPCO]**. | P1 exit |
| Data Protection Officer | Required for controllers of major importance. Name a DPO contact at registration (founder as interim, `privacy@` mailbox); appoint a qualified DPO (can be outsourced) before Extra-High. | P1 exit / P2 |
| Compliance audit returns | Annual filing (by 31 March) via a licensed DPCO once Extra-High (> 1,000). Budget the DPCO fee in P2 (`09` §7). | P2+ |
| DPIA | Required before high-risk processing (profiling, automated decisions, AI). Write one DPIA covering the planner/mastery profiling, AI tutor and snap-and-mark before P1 opens; update before P2 (payments, payouts) and before any minors work. | P1 |
| Cross-border transfer | Data is stored outside Nigeria (Supabase has no African region; use `eu-west-2` London or `eu-central-1` Frankfurt, pick by measured latency from Lagos) and sent to AI providers in the US/EU. Basis: contractual necessity plus explicit consent at signup, documented in the register; review when NDPC issues further transfer instruments **[confirm]**. | P0 |
| Processor contracts | Accept/keep the DPAs of Supabase, Cloudflare, Google (Gemini API paid terms), Anthropic, Paystack, Resend, Sentry, PostHog. List them in the privacy notice. | P0 |
| Breach notification | Notify NDPC within **72 hours** of becoming aware of a breach likely to risk rights; inform affected users promptly with what happened and what to do. Runbook in `docs/ops/breach.md`. | P1 |
| Data subject rights | Self-serve in Settings → Privacy (§6). Respond to emailed requests within 30 days. | P1 |
| AI and automated decisions | Mastery levels, plans and estimated marks are recommendations, not decisions with legal effect. Every AI output is labelled; marks say "Estimated"; users can contest a mark (report) and edit transcriptions. | P1 |

## 5. Retention

| Data | Kept for | Then |
|---|---|---|
| Snap-and-mark photos (`submissions` bucket) | 7 days after marking | Deleted by daily cron; transcription and verdict kept |
| Private textbook chunks and private lessons | While the account exists | Deleted with the account; user can delete per book |
| Tutor threads | While the account exists; user can delete any thread | — |
| Lecturer raw audio (P3) | 7 days after transcript approval | Deleted |
| Lecturer verification ID photo | Until approval decision | Deleted the same day |
| `ai_calls`, `plan_events` | 13 months | Aggregated, then deleted |
| Ledger, top-ups, withdrawals, payout lines | Statutory retention for financial records **[confirm with accountant; commonly 6 years]** | Kept even after account deletion, linked to an anonymised profile |
| Backups (R2) | 90 days max | Rotated |

## 6. User rights (Settings → Privacy)
- **Download my data:** an Edge Function builds a JSON + CSV zip (profile, enrollments, progress, attempts, mastery, goals, tutor threads, private lessons, contributions, ledger history) and emails a 24-hour signed link.
- **Correct:** profile fields editable in place; transcriptions editable; report wrong marks.
- **Delete my account:** confirm by email code → Edge Function `delete-account`:
  1. Delete storage objects under `{user_id}/`.
  2. If none of the user's ledger accounts has any `ledger_entries` and the user has no `topups` in `success`, no `withdrawals` and no `payout_recipients` (always true in P1, before the economy exists): delete any `initialized`/`failed` top-ups, delete the user's empty ledger accounts, then the `auth.users` row (cascades to all content; non-financial references such as `lessons.verified_by` are set to null).
  3. If the user **has ledger entries** (money records must be kept): delete all learning content (private sources, chunks, lessons, attempts, tutor data, uploads not yet approved), withdraw bank contributions from future use, set `profiles.status = 'deleted'`, blank `display_name`, `birth_*`, `department`, replace the auth email with `deleted+<uuid>@invalid.ifiok`, and ban the auth user. Pending earnings are paid out first if ≥ ₦2,000 and a recipient exists; otherwise the user is told the amount will be forfeited and must confirm.
- **Withdraw consent:** AI-disclosure consent is required for the service (explained); marketing and recording consents can be withdrawn any time.

## 7. Content safety and moderation
- Moderation pipeline as `04` §7: keyword filter first, then `moderate` (Flash-Lite) when the filter fires, and always for group posts (P3).
- **Crisis content:** the tutor replies with a fixed, caring template and Nigerian support contacts from `app_config` (reviewed quarterly), and does not continue tutoring in that message.
- **Reports:** any lesson block, item, source, post or user can be reported (`reports`). Targets reported by 3 distinct users are auto-hidden pending admin review (lesson blocks via `lesson_flags`).
- **Academic integrity:** no help during flagged timed assessments; snap-and-mark gives hints first and a worked solution only after an attempt; exam features never claim to predict questions.

## 7b. Voice and video moderation (Stage 3, F18)
- **Before publication:** Whisper transcript → `explainer_review` on the transcript (harassment, sexual content, hate, contact details, personal data, copied material, accuracy) and on sampled video frames (nudity, violence, other people's faces, visible personal data, copied slides); any issue holds the explainer for a human. Each author's first 3 explainers always get a curator's review.
- **After publication:** Flag on every explainer; 3 flags from distinct students hide it pending review; repeat violations remove publishing rights.
- **People in videos:** authors may show only themselves; anyone else needs their consent; no recordings of lectures, classmates or exam papers.
- **Data:** transcripts and media are personal data of the author; they are covered by export and deletion (§6) and by the retention table (§5).

## 8. Copyright and takedown
- Private textbooks never leave the device as files; only the text of confirmed pages is sent and stored, for the owner only (F3). This is personal study use; no redistribution.
- The bank rejects published textbooks (attestation + detection, F11). Uploaders grant a non-exclusive licence (F11-FR5).
- **Takedown:** a public form (`/takedown`) → creates a report with the claimant's details → item hidden within 24 hours → review within 7 days → restore or remove, notify both sides. Repeat infringers (3 upheld takedowns) lose upload rights.
- Lesson `source_quote` blocks are capped at 40 words, which keeps quotes short and attributed.

## 9. Lecturer recordings (deferred, `12` §4 Q39)
Lecturers are not served for now; the earlier design (lecturer-only microphone, consent screen, transcript review, raw audio deleted after 7 days) stays in `archive/10-build-plan-v1.md` context and returns with F12. Student voice and video explainers follow §2.5c and §7b instead.

## 10. Security checklist per stage (exit gates)
- **Stage 1 · MVP:** RLS on every table (CI query: `select relname from pg_class … where relrowsecurity = false` returns no public tables), service-role grep check, env validation, under-18 tests passing, no stored PDFs, private materials never retrievable by another user (pgTAP), no prompts or content in logs; shared uploads stripped of personal data before approval; explainer media private until reviewed and approved (§2.5c, §7b), signed URLs only; textbook pages never shareable.
- **Stage 2 · Launch:** NDPC Ordinary-High registration filed and DPO contact named, CSP enforced, Turnstile on auth, admin MFA, rate-limit rules live, nightly backups with one restore drill, DPIA written, privacy notice and terms published, breach runbook, data export and deletion working.
- **Stage 3 · Earn:** Supabase Pro, Paystack webhook signature and replay tests, escrow partner callback tests, ledger pgTAP invariants, withdrawal name-match, explainer review before publication (tests), media deletion on withdrawal, NDPC tier upgraded (Extra-High) before 1,000 users, accountant review of Units/VAT and tutor income, lawyer review of contributor, explainer and tutor terms, takedown form live, admin audit review weekly.
