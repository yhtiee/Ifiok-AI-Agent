# 06 · Economy: Units, rewards, contributor pool, payouts

**Stage:** 3 · Earn (`10` E-01–E-06). Nothing that moves money ships until Supabase is on Pro (daily backups), the business is registered (Paystack live mode needs a verified business), an accountant has reviewed §10, and a lawyer has reviewed the contributor, explainer and tutor terms (OWN-E1, OWN-E2).

## 0. How students earn (owner decisions `12` §4 Q39, Q40, Q41)

Ifiok serves students only for now; lecturer licences are deferred (the lecturer rows below stay for later). Students earn four ways, built in this order:

| Way to earn | What counts | Paid in | Funded by | Section | Ticket |
|---|---|---|---|---|---|
| **Verified uploads** | Notes, past questions, lab manuals and worked solutions shared to the contribution pool, approved by curation, used by other students | Units at first; cash once the pool is switched on | Contribution pool (35% of margin) | §2, §3, §4 | E-01, E-03, E-06 |
| **Curating** | Accepted reviews and fixes of AI lessons in subjects the student was approved to curate | Cash per accepted review | Ifiok's budget (a cost line) | §13 | E-02 |
| **Explainers** | Written, voice or short video explainers that other students finish | Usage points → Units, then cash | Contribution pool | §4, §14 | E-04 |
| **Tutoring** | Paid sessions with students who book them | Cash, minus Ifiok's commission | The learner's payment, held in escrow by a licensed partner | §12 | E-05 |

**Principle (unchanged):** learning earns credits (Units, never cashable); contributions other people use earn cash. Nobody can cash out by grinding lessons.

**Staged rollout:**
- **MVP (Q42):** sharing, explainers and usage points are live; Units earned are recorded as pending (`earned_units_pending`, append-only, server-written) and move into the wallet when it ships; **no cash moves and no naira estimates are shown** before a contribution pool exists. Tutor profiles exist; bookings don't.
- **Earn launch:** Units (top-ups, spending, earning) for everyone; contributors and explainer authors rewarded in **Units**; curators paid per accepted review by manual monthly transfer. ~~Lecturers are paid in cash under direct content licences~~ (deferred, Q39; fee basis kept in `app_config.licence_fee` for later).
- **Tutoring:** switched on once the escrow partner and tutor terms are in place (§12).
- **Automatic cash pool:** switched on with `app_config.cash_pool_enabled` only when the computed pool has been **≥ ₦250,000 for 2 consecutive months** and a lawyer has reviewed the contributor terms. Until then a pool smaller than that would leave most contributors below the ₦2,000 withdrawal minimum while carrying the full KYC, transfer and tax burden.

## 1. Two currencies

| | **Units** | **Earnings (₦)** |
|---|---|---|
| What | In-app credits for AI-heavy actions | Cash owed to contributors |
| Got by | Buying (top-up), learning (earned), converting earnings | Share of the monthly contributor pool, by usage |
| Spent on | Extra tutor messages, extra marking, private lessons, extra mocks | Withdraw to a bank account, or convert to Units (+20%) |
| Cash-out | **Never** | Yes, ≥ ₦2,000, after a 30-day hold |
| Expiry | Earned: 90 days. Purchased/converted: none | None while the account is active |

Learning earns **credits**. Contributions that others use earn **cash**. This separation stops farming: nobody can cash out by grinding lessons.

## 2. Prices and allowances (defaults in `app_config`; test in the pilot)

**Plans shown publicly (owner decision `12` §4 Q44):** **Free** forever (Path, shared lessons, labs, practice, exam patterns, study plan, a small monthly allowance of private lessons and tutor messages) and **Ifiok Plus ₦500/month or ₦1,500/semester** (unlimited private lessons from your own notes, unlimited practice papers and mocks, more tutor messages, priority lesson builds). Units top-ups (below) stay for extras and never expire. Plus is billed only once payments go live (Stage 3); until then the page says "Plus opens with payments" and everything is free. Exact allowances live in `app_config`.

**Top-up bundles** (VAT-inclusive placeholder prices; see §10): ₦500 → 50 Units · ₦1,000 → 105 Units · ₦2,000 → 220 Units. Minimum top-up ₦500 (keeps Paystack fees ≤ 1.5% plus no flat fee under ₦2,500). One Unit ≈ ₦9.1–10.

**Free every day/month (no Units needed; these are the P1 pilot defaults. P2 defaults are set from pilot data so the average free learner costs ≤ ₦120/month in AI, see `09` §5):** published lessons (any concept), labs, practice and reviews, planner; 8 tutor messages/day; 2 snap-and-marks/day; 3 private lessons/month; 1 mock exam per course per week.

**Spend (Units):** tutor message beyond quota = 1 · snap-and-mark beyond quota = 3 · private lesson = 21 (one free trial) · extra mock = 5. Prices are set so each Unit spend covers its measured AI cost at least 1.5× (`09` §4); review them monthly.

**Earn (Units):** a concept reaches Mastered (+3, once per concept, max 10 per month) · 7-day streak +5 · approved bank upload +5 · each qualified consumer of your uploads +1 per month · accepted group answer +2 (P3). **Cap: 40 earned Units per user per month.** Earned Units are a subsidy (each one buys real AI), so the cap keeps their cost ≈ ₦30–60 per active learner per month, which is counted in `c` (target ≤ ₦120) in `09` §5.

## 3. Contributor pool (cash)

Applies from P2b (`cash_pool_enabled`). Until then `compute_period` still runs monthly as a dry run, so the owner can see what the pool would be.

**Funding:** at month end, `pool = pool_pct × gross_margin`, where
`gross_margin = recognised Units revenue (₦) − payment fees − AI spend (₦) − lecturer licence fees (₦) for the month`, and `pool_pct = 35%` (config). **Recognised revenue** = the month's postings to `units_sales_revenue`, i.e. purchased or converted Units actually **used** that month × their lot's `kobo_per_unit` (from `lot_moves`), not top-ups received. Top-ups are a liability until spent, so a big top-up month can't fund a pool whose AI cost lands later.

Funding from **margin**, not revenue, keeps the system solvent while AI costs are high. The pool can never exceed what came in after costs. If the margin is ≤ 0, the pool is 0 for that month, and the app says so plainly.

**Split:** each contributor gets `pool × their_points / total_points`, capped at 20% of the pool per contributor (the excess stays in the pool for next month).

## 4. Usage points

A point is recorded by `record_usage(kind, resource_id, consumer)` (server-side only) when a **qualified consumer** benefits from a contribution:

| Contribution | Event that records a point |
|---|---|
| Bank source (notes, past paper, lab manual, solution) | Consumer completes a lesson screen whose block cites a chunk from that source, or attempts an item/exam question derived from it |
| Student explainer (F18) | Consumer finishes the explainer (reaches the end of a written walkthrough, or plays ≥ 80% of the audio/video) |
| Lecturer source (deferred, Q39) | Same as a bank source, at **weight 2.0** |
| Accepted group answer (P3) | Another member taps "This helped" (max once per member) |

- **Dedupe:** one point per (resource, consumer, month) via a unique constraint. Re-reading the same thing doesn't add points.
- **Qualified consumer:** account ≥ 3 days old, email verified, ≥ 3 study sessions in the last 14 days, not the contributor.
- Points show on "My contributions" with a running estimate ("Est. ₦1,240 this month, final on the 1st").

## 5. Anti-fraud
1. Self-usage blocked (DB check constraint).
2. Points only from qualified consumers (above).
3. **Ring detection** (monthly, before approval), using graph signals rather than IP addresses (Nigerian mobile networks and campus Wi-Fi put many honest students behind one IP): flag a contributor if > 50% of their points come from consumers who (a) consume almost only that contributor's items, (b) were created in a burst (≥ 5 accounts within 48 h that all consume the same contributor), or (c) share a payout bank account with the contributor or each other. No device fingerprinting. Flagged lines are held for manual review.
4. Uploads must pass curation (F11); duplicates earn nothing for the later uploader.
5. Top 10 earners each month are manually reviewed before approval (P2).
6. 30-day hold before earnings become withdrawable, so fraud found later can be reversed.
7. Withdrawals require a bank account whose resolved name matches the **legal name the user enters** when adding the account (Paystack Resolve Account Number; similarity ≥ 0.8, otherwise manual review).
8. Chargebacks on top-ups: `reverse_topup(reference)` removes the Units left from that top-up's lot; if some were already spent, the account is frozen (`status = 'suspended'`) pending review.

## 6. Paystack flows

### Top-up
1. Client `POST /api/topup/init { bundle }` → server inserts a `topups` row (`reference` = UUID) → Paystack **Initialize Transaction** (amount in kobo, email, reference, `metadata.user_id`) → returns `access_code`.
2. Client opens Paystack Inline (popup) with the `access_code`.
3. **Webhook** `POST /api/paystack/webhook`: verify `x-paystack-signature` = HMAC-SHA512(raw body, secret key); reject on mismatch. On `charge.success`: call Paystack **Verify Transaction** for the reference (status success, currency NGN, amount equals the `topups` row) → `confirm_topup(reference, amount_kobo, fee_kobo)` (idempotent).
4. The client never credits itself; it polls `/api/topup/status` and shows the result.
5. **Reconciliation** cron (hourly): verify `initialized` top-ups older than 15 minutes against Paystack; confirm or mark failed.

### Withdrawal
1. Add bank: bank list (`/bank`), **Resolve Account Number**, compare the name, **Create Transfer Recipient** (`nuban`), store `recipient_code` and the last 4 digits only.
2. `request_withdrawal(amount_kobo, idem)` (user-callable): checks available ≥ amount ≥ ₦2,000, moves funds to `payout_clearing`, inserts a `withdrawals` row.
3. P2: admin approves a weekly batch → **Initiate Transfer** per withdrawal (`reference` = withdrawal id) → status `processing`.
4. Webhooks `transfer.success` / `transfer.failed` / `transfer.reversed` → `settle_withdrawal`.
5. Fees: Paystack NGN transfer fees (₦10 up to ₦5,000; ₦25 for ₦5,001–₦50,000; ₦50 above) are paid by Ifiok. Stamp duty (₦50 on transfers ≥ ₦10,000) is withheld: Ifiok sends `W − 50` and posts the ₦50 to the `levies` account (§7). The app shows it before confirming.

## 7. Ledger postings (signed double-entry; debit +, credit −)

| Event | Entries (account: amount) |
|---|---|
| Top-up ₦1,000, fee ₦15, 105 Units | NGN: `paystack_clearing` +98,500 · `payment_fees` +1,500 · `units_deferred_revenue` −100,000 (a liability until the Units are used). UNIT: `unit_issuance` +105 · `user_units_purchased` −105. Lot `purchased` 105 at `kobo_per_unit` = 952. |
| Earn 3 Units | UNIT: `unit_issuance` +3 · `user_units_earned` −3. Lot `earned` 3, expires +90 days. |
| Spend 10 Units | UNIT: user account(s) +10 (earned lots first, earliest expiry first) · `unit_issuance` −10. `lot_moves` rows record each lot used. NGN, for the purchased/converted part only: `units_deferred_revenue` +v · `units_sales_revenue` −v₁ · `earnings_conversion` −v₂, where v₁ comes from purchased lots and v₂ from converted lots (Σ units × `kobo_per_unit`). Revenue is recognised when Units are used; converted Units never count as sales revenue, so the pool can't fund itself from its own payouts. |
| Expire earned Units | Same as spend, from expired lots. |
| Fund pool (month) | NGN: `pool_expense` +X · `contributor_pool` −X. |
| Allocate to contributor | NGN: `contributor_pool` +A · `user_earnings_pending` −A. |
| Release after hold | NGN: `user_earnings_pending` +A · `user_earnings_available` −A. |
| Request withdrawal W | NGN: `user_earnings_available` +W · `payout_clearing` −W. |
| Transfer success (fee f, levy d) | NGN: `payout_clearing` +W · `transfer_fees` +f · `paystack_clearing` −(W−d+f) · `levies` −d. |
| Reserve Units for an AI call | UNIT: user account(s) +n · `unit_issuance` −n (same as spend, kind `reserve`). |
| Refund a failed call | Reverse of the reserve (kind `refund`, idempotent on the reserve's key). |
| Chargeback on a top-up | NGN: `units_deferred_revenue` +(unused value) · `units_sales_revenue` +(used value) · `paystack_clearing` −amount. UNIT: remaining lot Units back to `unit_issuance`. |
| Lecturer licence fee (manual, monthly) | NGN: `licence_fees` +L · `paystack_clearing` −L (or the bank account used). Counted as a cost in `gross_margin`. |
| Transfer failed/reversed | NGN: `payout_clearing` +W · `user_earnings_available` −W. |
| Convert ₦1,000 earnings to 120 Units | NGN: `user_earnings_available` +100,000 · `units_deferred_revenue` −100,000. UNIT: `unit_issuance` +120 · `user_units_purchased` −120. Lot `converted` 120 (no expiry, `kobo_per_unit` = 833). |

Display balance for user accounts = `−balance` (credit-normal). `post_txn` rejects any posting that would make a user's display balance negative.

## 8. Function contracts (`0007_economy_functions.sql`)

| Function | Caller | Behaviour |
|---|---|---|
| `ensure_user_accounts(uid)` | trigger on profile insert | Creates the 4 user accounts if missing |
| `confirm_topup(reference, amount_kobo, fee_kobo)` | webhook handler (service role) | Idempotent on `topup:{reference}`; posts the top-up; creates a lot; sets `topups.status` |
| `spend_units(uid, feature, amount, idem)` | server (service role) | Reserves before the AI call: consumes lots (earned first by expiry, then purchased/converted by age); posts; fails cleanly if insufficient |
| `refund_units(spend_idem)` | server | Reverses a reservation when the AI call fails; restores the same lots from `lot_moves` (and reverses the revenue recognition); idempotent |
| `reverse_topup(reference)` | admin / webhook (`charge.dispute`) | Chargeback handling (§5.8) |
| `earn_units(uid, reason, amount, idem)` | server | Enforces per-reason rules, reads only server-written evidence (`attempts`, `screen_events`, `mastery`), the monthly cap 40; idempotent per reason/period |
| `submit_to_bank(source_id)` | user (checks `auth.uid()` owns it) | Sets `review = 'pending'`, enqueues `curate`; the curate job (service role) sets `visibility`, `review` and reasons |
| `expire_units()` | pg_cron daily 01:00 WAT | Expires lots past `expires_at` |
| `record_usage(kind, resource_id, consumer)` | server | Resolves contributor and weight; checks consumer qualification; inserts (ignore duplicates) |
| `compute_period(period)` | admin | Computes margin, pool, points, capped lines; status `computed` |
| `approve_period(period)` | admin | Posts funding and allocations; `release_at` = approval + 30 days; status `approved` |
| `release_earnings()` | pg_cron daily | Moves due lines from pending to available |
| `request_withdrawal(amount_kobo, idem)` | user (checks `auth.uid()`; only when `cash_pool_enabled`) | As §6 |
| `settle_withdrawal(transfer_code, success, fee_kobo)` | webhook | Posts success or reversal; idempotent |
| `convert_earnings(amount_kobo, idem)` | user | Converts at `1 Unit = ₦10 / 1.2` (config), creates a `converted` lot |

## 9. Invariants (pgTAP tests must prove)
1. Every `ledger_txns` row's entries sum to 0 per currency.
2. No user account has a negative display balance after any function call.
3. `sum(remaining)` of a user's lots = their Units display balance (both user Units accounts).
4. Replaying any webhook or function call with the same idempotency key changes nothing.
5. `sum(payout_lines.amount_kobo)` for a period ≤ `payout_periods.pool_kobo`.
6. A contributor's line ≤ 20% of the pool.
7. Clients cannot insert or update any ledger table directly (RLS plus grants).
8. For every lot, `amount + Σ lot_moves.units = remaining`, and Σ over a user's lot moves matches the Units postings on their accounts.
9. `units_deferred_revenue` balance = Σ (remaining × `kobo_per_unit`) over purchased and converted lots.

## 10. Legal and tax notes (not legal or tax advice; get professional review)
- Register the business (CAC) before P2; Paystack live mode and Transfers require it.
- Units are **prepaid service credits**, non-refundable except for failed delivery, non-transferable, with no cash value. Don't call them a wallet balance or stored money in copy. Cash earnings are payments for a content licence, paid through a licensed payments provider.
- VAT: Nigerian VAT may apply to Unit sales; whether and how to register and charge depends on current thresholds after the 2025 tax reforms. Prices above are placeholders. Contributor payouts may be taxable income for recipients. Confirm both with an accountant.
- Terms must state the pool formula, the hold, the expiry of earned Units and how disputes work.

## 11. Sponsor prize pools (P3)
Admin creates a campaign `{sponsor, amount, course(s), rule (e.g. top 20 mastery gains with ≥ 10 sessions), period}`. Sponsor money is booked to `sponsor_pool`. Winners are credited to `user_earnings_pending` (same hold and withdrawal rules) or receive data bundles (fulfilled manually). Ifiok keeps a fee (default 15%) recorded as revenue.

## 12. Tutoring payments (P2, F17, owner decision 12 §4 Q39)
- **Money flow:** learner pays via Paystack → funds held by a **licensed escrow/payment partner** (chosen after legal review; Ifiok never holds tutoring funds) → on release, the partner pays the tutor's verified account minus Ifiok's commission (`app_config.tutoring_take_rate`, default 15%); refunds go back to the learner's payment method.
- **Ledger:** Ifiok records bookings and commission, not escrow balances: `tutoring_bookings` (state machine: `pending_payment → held → released | refunded | disputed`), commission posted as revenue at release via an idempotent SQL function keyed on the booking id (guardrail 5). Tutoring cash is separate from Units and from contributor Earnings.
- **Prices:** tutors set a price per session inside a band (`app_config.tutoring_price_band`, set from pilot data).
- **Tax and terms:** tutor income may be taxable; terms state the commission, release, dispute and refund rules. Legal review before launch.

## 13. Student curator pay (owner decision 12 §4 Q39)
- **Who:** students who **apply** to curate a subject and are **approved by an admin** after review (no mastery requirement; owner decision, `12` §4 Q54); verified payout account as in §5 rule 7.
- **Work:** the curator queue (flagged and `new` lessons in their subject, F2-FR6); a fix publishes a new version through `/api/lessons/:id` (verification gate, audit). Non-STEM lessons without sources go to curators first, which also answers the invented-facts risk (Q36 f).
- **Pay:** a fixed amount per **accepted** review (`app_config.curator_fee_per_review`; the `09` §7 placeholder is ₦1,500), paid monthly by transfer from Ifiok's budget (a cost line, not the contributor pool). A second curator spot-checks 1 in 10 reviews; rejected reviews are unpaid; monthly cap per curator in config.

## 14. Student explainers (owner decisions 12 §4 Q40, Q41; F18)
- **What:** any student publishes an explainer for a concept they choose (no mastery required, `12` §4 Q52; their Ifiok mastery shows when they have it): a written walkthrough, a voice note (≤ 5 min) or a **short video (≤ 3 min, 480p, ≤ 40 MB after on-device compression)**. Every voice and video explainer is transcribed so it has captions and can be searched and reviewed.
- **Checks before others see it:** AI review of the text or transcript, and of sampled video frames (`08` §7b); numbers checked by the engine where possible; curator review for each author's first 3 explainers; reports and the 3-flag hide rule apply.
- **Pay:** explainers earn usage points like uploads (§4: one point per qualified consumer per month who finishes it), so pay comes from the contribution pool, never from a price set by the author. Fairness comes from the same rules as uploads: one point per (explainer, consumer, month), qualified consumers only, no self-use, and the pool's 20% cap per person (§3).
- **Rights:** the author grants Ifiok the same licence as uploads (F11-FR5) and can withdraw it; withdrawn media is deleted from storage within 7 days.
- **Costs:** media storage and delivery are a cost line (`09` §2); one transcription per explainer.

## 15. PayPal sandbox for the hackathon (owner decision 12 §4 Q43; MVP-07)
- **Scope:** sandbox (test money) only, to demonstrate the full loop for the PayPal AI Hackathon. Real payouts still wait for Stage 3 (registered business, legal review, `06` §0 prerequisites); the production rails (Paystack, PayPal, or both) are chosen then.
- **Contribution pool:** for the demo, the pool is funded in the sandbox by the platform account (there is no Units revenue yet), and split by usage points with the §3 rules (20% cap). This is the real formula applied to test money; the screens say "Sandbox: test money".
- **Tutoring:** Orders v2 with `intent = AUTHORIZE` at booking (nothing captured), capture after confirmation or 24 h, void on tutor no-show; the tutor is paid out minus `tutoring_take_rate`. In production the lawyer decides whether this model (capture to the platform, then payout) is acceptable or whether a marketplace/escrow product is required so Ifiok never holds tutoring funds (§12).
- **Ledger:** sandbox payouts and bookings are recorded in their own tables with `environment = 'sandbox'` and never mix with production balances.
