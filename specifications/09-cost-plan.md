# 09 · Cost plan: launch cheap, stay solvent

Exchange-rate assumption: **₦1,500 = $1** (update in `app_config.fx_ngn_per_usd`; every naira figure below scales with it). Prices were checked in October 2026 from provider pages and third-party summaries. **Re-check each one before the phase that depends on it.**

## 1. Principles
1. Pay only for things that are needed for the next phase. Everything else waits.
2. Fixed costs stay near **$5/month until real money moves**, then about **$30/month**.
3. AI is the only cost that grows with users, so it gets hard caps (per user and global), not just alerts.
4. Shared generation (lessons, items) is paid once per concept, not per student or per course; exam maps once per course.
5. Cash payouts can never exceed what came in after costs (pool funded from gross margin, `06` §3).

## 2. Services and their free limits

| Service | Plan we use | What's included (verify) | What breaks first | Upgrade trigger |
|---|---|---|---|---|
| Cloudflare Workers | **Paid, $5/mo** from P1 | 10M requests/mo, 30M CPU-ms; Worker size up to 64 MiB on all plans (raised Sept 2026) | CPU time per SSR request if pages aren't cached | — |
| Supabase | **Free** in P0–P1 (2 projects: prod + staging) | 500 MB DB, 1 GB storage, 50k MAU, ~5 GB egress, Edge Functions 500k invocations/mo, 150 s wall clock; **pauses after 1 week of inactivity; no backups** | DB size (chunks + embeddings), storage (photos), no backups | Move to **Pro ($25/mo; 8 GB DB, 100 GB storage, daily backups, no pausing)** before P2 payments, or when DB > 350 MB |
| Gemini API | **Paid tier only** with real users (free tier = synthetic dev data only) | Pay per token; Batch 50% off | Spend | Caps in §6 |
| Anthropic API | Pay as you go (fallback) | Claude Haiku 4.5 $1 / $5 per 1M tokens | — | — |
| Paystack | No monthly fee | Local cards 1.5% + ₦100, ₦100 waived under ₦2,500, capped at ₦2,000; transfers ₦10 / ₦25 / ₦50 | — | — |
| Resend | Free | 3,000 emails/mo, 100/day | Daily limit once email-code sign-ins grow | Pro (~$20/mo) when > 70/day for a week; prefer Google sign-in and long sessions first |
| Cloudflare R2 | Free | 10 GB storage | — | Backups beyond 10 GB |
| Cloudflare Turnstile, WAF rule | Free | 1 rate-limiting rule | — | — |
| Sentry | Developer (free) | ~5k errors/mo | Error storms | Sample at 10% |
| PostHog | Free | 1M events/mo | Event volume | Sample or trim events |
| GitHub Actions | Free (private repo minutes) | 2,000 min/mo | Playwright + backups | Trim the matrix |
| Domain | `.com` or `.ng` | ~$10–20/year | — | — |
| Groq Whisper (P3) | Pay per use | ~$0.04 per audio hour | — | — |

**Region:** Supabase has no African region. Choose `eu-west-2` (London) or `eu-central-1` (Frankfurt) after measuring latency from Lagos/Uyo on MTN and Airtel (pick the lower p50).

## 3. Free-tier capacity check (sized with headroom: 300 sign-ups, ~120 weekly active; the P1a pilot plans 100–200)

| Resource | Estimate | Fits Free? |
|---|---|---|
| DB: shared content | (sized for 5 courses; P1a uses 2) 5 courses × 40 topics × (lesson 40 KB + 30 items 15 KB) ≈ 11 MB; course chunks (notes) 5 × 400 chunks × ~3 KB (text + 384-d vector + index) ≈ 6 MB | Yes |
| DB: per user | Attempts, cards, mastery, tutor messages, plan rows ≈ 0.4 MB/semester; private chunks ≈ 0.25 MB per private lesson × 3 | ~300 × 1.2 MB ≈ 360 MB worst case → **monitor; move to Pro at 350 MB** |
| Storage: snap photos | 200 KB each, typical 12/month per active user, **kept 7 days** → ~120 × 3 × 0.2 MB ≈ 70 MB steady | Yes |
| Storage: lecturer notes and seeds | ~200 MB | Yes |
| Egress | Lesson JSON + items + API, ~20 MB per active user/month → ~2.5 GB | Yes |
| Edge Function invocations | Jobs + sweeper (43k/mo from a 1-minute cron) + embeddings → ~80k | Yes |
| Realtime | Job status only, ≤ 200 concurrent | Yes (polling fallback) |
| Emails | Sign-ups + codes, ~40/day | Yes |

**Pausing:** a real pilot has daily traffic, so the prod project won't pause. The staging project will; that's fine (wake it when needed).

## 4. AI unit costs (planned at 2027 list prices, thinking included)

Plan with the prices that apply from **1 January 2027** (Gemini Flash doubles to $1.50 / $7.50 per 1M tokens; Flash-Lite 3.1 stays $0.25 / $1.50). Thinking tokens are billed as output and are included below at the lowest thinking level each skill allows. Token counts are estimates; replace them with measured `ai_calls` data in week 1 of the pilot.

| Operation | Model | Tokens in / out (incl. thinking) | Cost (USD) | Cost (₦) |
|---|---|---|---|---|
| Tutor message (avg 1.5 model rounds with tools) | Flash-Lite | 3,900 / 500 | $0.0017 | ₦2.6 |
| Tutor message on fallback | Haiku 4.5 | 3,900 / 500 | $0.0064 | ₦9.6 |
| Snap-and-mark, Flash-Lite transcription (**P1 target**) | Flash-Lite ×2 | 2,000/900 + 800/250 | $0.0024 | ₦3.6 |
| Snap-and-mark, Flash transcription | Flash + Flash-Lite | 2,000/900 + 800/250 | $0.0103 | ₦15.5 |
| Shared lesson (outline + blocks) | Flash | 18,000 / 8,300 | $0.0892 | ₦134 |
| Shared lesson with Batch API | Flash batch | same | $0.0446 | ₦67 |
| Private lesson on Flash-Lite (if its eval passes) | Flash-Lite | 18,000 / 8,300 | $0.0169 | ₦25 |
| Item set (30 items) | Flash | 6,000 / 9,000 | $0.0765 | ₦115 |
| Independent check of 30 items | Flash-Lite | 6,000 / 3,000 | $0.0060 | ₦9 |
| Teach-back check | Flash-Lite | 1,500 / 400 | $0.0010 | ₦1.5 |
| Bank curation | Flash-Lite | 4,000 / 400 | $0.0016 | ₦2.4 |
| Past paper extraction (6 pages) | Flash | 6 × (1,500 / 900) | $0.054 | ₦81 |

**Cost of one new concept** (paid once, then reused by every student at every university): topic resolution (≈ ₦0.5) + lesson + the first 10 practice items with their checks (generated lazily, only when someone practises):
- Flash path: ₦134 + ≈ ₦41 ≈ **₦175** ($0.12)
- Flash-Lite path (if the lesson eval passes for that subject): ₦25 + ≈ ₦11 ≈ **₦37** ($0.025)
- Add **×1.3 overhead** for repairs, retries after failed checks, refreshes, claim checks, `topic_resolve` model calls, outline drafts and scheme extraction: ≈ **₦230** (Flash) or **₦48** (Flash-Lite) per concept in practice.

**Cache warming (optional):** pre-generating the 300 most common first-year concepts (Batch API, Flash) ≈ 300 × ₦90 ≈ ₦27,000 ($18), half that before 31 Dec 2026. This only makes first experiences instant; it never limits what students can learn.

**Unit prices vs cost:** 1 Unit ≈ ₦9.5. Tutor message 1 Unit vs ₦2.6 cost; snap-and-mark 3 Units (₦28) vs ₦3.6–15.5; private lesson 21 Units (₦200) vs ₦25–134. Each spend covers its cost at least 1.5×.

## 5. Cost per learner, library growth and break-even

Two kinds of AI cost behave differently:
1. **Per-learner cost `c`** (tutor, marking, teach-back, earned-Unit spending) grows with active learners.
2. **Library growth `L`** (new concepts and refreshes) grows with how much *new* ground students cover. Every concept is paid for once; as the library fills, more requests are reuse (the "library reuse" metric in `00` §7) and `L` flattens.

**P1 pilot, typical weekly active learner:** 60 tutor messages, 12 marks, 4 teach-backs per month ≈ **₦205 with Flash-Lite transcription, ₦350 with Flash** ($0.14–0.23). A free user who maxes every quota costs ≈ $1.00/month, which is why the per-user ceiling exists ($0.30 in P1, `04` §5).

**P1 library estimate:** ~200 students creating ~60 courses × ~14 topics ≈ 840 topics; concept matching merges ~30% and about half get opened in a semester → **~300–400 new concepts per semester**, front-loaded (~150/month at first). Flash path ≈ ₦26,000/month ($18); Flash-Lite path ≈ ₦6,000 ($4).

**P2 library estimate:** at a few thousand learners across many universities, expect ~1,000–2,000 new concepts a month at first, falling as reuse passes 85%. Blended (Flash-Lite where its eval passes, Flash for STEM lessons that need it) ≈ ₦80 per concept with overhead → **`L` ≈ ₦80,000–160,000/month** at first. If lessons must stay on Flash, `L` ≈ ₦230,000–460,000/month: that is why the Flash-Lite lesson eval is a P2 gate.

**Break-even model (P2).** Let:
- `N` = weekly active learners, `p` = share who top up in a month, `A` = average top-up per payer per month (₦1,000),
- `c` = AI cost of free usage per learner per month, **including what their earned Units buy** (₦),
- AI for paid usage ≈ 30% of what it earns, Paystack ≈ 1.5%,
- `F` = fixed costs ≈ **₦75,000/month** (Supabase Pro + Cloudflare + domain ≈ ₦47k, plus compliance and accounting ≈ ₦28k averaged),
- Ifiok keeps 65% of gross margin (35% is the contributor pool once it is switched on; before that it funds lecturer licences and Units rewards).

```
gross_margin = N × (p × A × (0.985 − 0.30) − c) − L
ifiok_net    = 0.65 × gross_margin − F        (if gross_margin > 0, else gross_margin − F)
```

Monthly net result, thousands of naira (A = ₦1,000, F = ₦75,000):

| `L` (library, ₦/month) | `c` | `p` | N = 1,000 | N = 3,000 | N = 6,000 |
|---|---|---|---|---|---|
| 0 (library mostly built) | 100 | 25% | −29 | +64 | +203 |
| 0 | 120 | 25% | −42 | +25 | +125 |
| 60,000 | 100 | 25% | −68 | +25 | +164 |
| 60,000 | 120 | 30% | −58 | +53 | +219 |
| 120,000 (early, fast growth) | 120 | 25% | −144 | −53 | +47 |
| 120,000 | 120 | 30% | −109 | +14 | +180 |
| 200,000 (Flash path) | 120 | 30% | −189 | −38 | +128 |
| 300,000 (Flash path) | 120 | 30% | −290 | −118 | +63 |

**What this means:**
1. The P1 free allowance is a deliberate pilot subsidy (≈ ₦200–350 per learner). It cannot carry into P2.
1b. Student-led learning makes the library a real cost line in the first months of P2. It pays off over time, because every concept built is reused by later students at no cost. Getting lesson generation onto Flash-Lite for the subjects where it passes the eval cuts `L` by about 4×.
2. Ifiok works when free usage costs **≤ ₦120 per learner per month**, **≥ 25% of active learners top up about ₦1,000/month**, and **Flash-Lite passes the lesson eval for ≥ 70% of concept volume**, at a few thousand active learners. All three are P2 gates, measured in the pilot (willingness-to-pay test in the last 4 weeks; library reuse and cost per concept from `ai_calls`).
3. Scale doesn't fix bad unit economics: at `c = ₦150` and 20% paying, more users means bigger losses.
4. Getting **snap-and-mark transcription onto Flash-Lite** is the single biggest lever: it moves a typical P2 learner from ≈ ₦215 to ≈ ₦120.

**Starting P2 free allowances** (all in `app_config`): tutor **3/day**, snap-and-mark **1/day** (2/week if transcription still needs Flash), private lessons **one trial**, mocks 1/course/week, earned Units ≤ 40/month, per-user free ceiling **$0.10 (₦150)/month**. Expected typical `c` ≈ ₦120 including earned-Unit spending. Published lessons, labs, practice and reviews stay free and unlimited, because they cost no AI per learner.

**Contributor pool size at these numbers:** at N = 3,000, p = 25%, c = ₦120 the pool would be ≈ ₦54,000/month, too small to pay hundreds of contributors meaningfully in cash. Hence the staged rollout in `06` (Units for students first, licence payments for lecturers, automatic cash pool once it reaches ₦250,000/month).

## 6. Budget guards (built in, not optional)
| Guard | P1 | P2 |
|---|---|---|
| Global AI cap per day (per-learner skills) | $3 (≈ $90/mo) | `1.3 × (target_c × WAL_last_week + paid_spend_estimate) ÷ 30`, converted to USD; first month fixed at $10/day |
| Library generation budget (separate) | $20/day for the first 2 weeks, then $5/day; jobs over budget wait for the next day | Set monthly from the target `L` |
| Alert | 80% of the daily cap → email | same |
| At 100% | Non-essential skills off (brief rewrite, teach-back, private lessons); tutor and marking continue only for Unit spends (P2) | same |
| Per-user free ceiling | $0.30/month | $0.10/month |
| Max output tokens and thinking level | Per skill (`04` §3, §5) | same |
| Eval runs | $2 per run; PR runs only for changed skills; weekly full run | same |
| Kill switches | Per skill and per model (`app_config`) | same |

## 7. Phase budgets

| Phase | Fixed / month | AI / month | One-off | Notes |
|---|---|---|---|---|
| **P0 build (8–10 weeks)** | $0–5 | $5–10 (evals; Gemini free tier only with synthetic data) | Domain ~$15 | Local Supabase in Docker for most work |
| **P1 pilot (1 semester, any course or topic)** | $5 Cloudflare + $0 Supabase Free | ~$35–75 (≈ 100 WAL × $0.14–0.23, library growth $4–18, evals), hard cap $3/day | Optional cache warming ≤ $20; NDPC Ordinary-High registration ₦10,000; optional paid curators for the busiest subjects ≈ ₦1,500 per checked lesson (budget ₦60,000) | Total ≈ **$40–80/month** plus ≈ ₦70,000 one-off |
| **P2 paid launch** | ~$30 (Supabase Pro $25 + Cloudflare $5) + Resend Pro if needed; compliance and accounting ≈ ₦28k/month averaged | Capped by §6 | CAC registration, accountant, NDPC Extra-High (₦100,000) when > 1,000 users, DPCO audit fee **[confirm]**; keep the staging project in a separate free organisation so it doesn't bill as Pro | Payments go live only after Pro + registration |
| **P3 growth** | Supabase compute add-on and PITR only when metrics need them | Same rule | Glyph designer, cultural advisor (brand, `07`) | — |

## 8. Cost levers (in the order to pull them)
1. **Measure first:** the AI spend dashboard (F15) shows cost per skill, per learner and per course from `ai_calls` (including thinking tokens and tool rounds).
2. Move snap-and-mark transcription to Flash-Lite (eval gate in `11`).
3. Seed shared content before 31 Dec 2026 while Flash is at the introductory price, and always with the Batch API.
4. Cache shared outputs by content hash; never generate twice (`04` §5).
5. Lowest thinking level per skill; raise only when an eval fails.
6. Pre-compute obvious maths before tutor calls to save a tool round (`04` §4.1).
7. Context caching for the tutor's long system prompt when it passes the provider minimum.
8. Trim retrieval context (1,500 → 1,000 tokens) if the tutor eval holds.
9. Lower free quotas in `app_config` (no deploy needed).
10. Answer common questions from a per-topic FAQ built from recurring tutor questions (P3).
