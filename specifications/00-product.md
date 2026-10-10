# 00 · Product

## 1. One-line definition
Ifiok is an AI learning agent that teaches a student **whatever they choose to learn** (any course, any topic, any faculty) with lessons they can see and move, practicals they can run, and practice that adapts, so they learn faster and practise faster. Exam preparation is one mode of it.

**Student-led, not catalogue-led.** Ifiok has no fixed list of courses and does not depend on material we upload. Students create courses and pick topics; Ifiok reacts and builds what they need on demand. Everything a student triggers (a lesson, practice questions) is kept as a shared concept that the next student, at any university, reuses for free. Notes, past questions and other material uploaded by students and lecturers form a crowd-sourced bank that makes the AI's teaching better for everyone.

## 2. Problem (validated assumptions to re-test in pilot)
| Problem | Evidence we have | How we'll test it |
|---|---|---|
| Material is walls of text; ideas that need to be seen are only described | Founder experience; prototype feedback | Lesson completion and checkpoint accuracy vs reading the same pages |
| Practicals are learned from paper because labs lack equipment | Common across Nigerian universities (anecdotal) | Lab run completion; pre/post viva quiz scores |
| Teaching moves at one pace; small gaps grow unseen | Standard learning-science finding | Diagnosis triggers → mastery recovery rate |
| Good notes and past questions are scattered | WhatsApp groups, photocopies; competitors (Acadeva, UniPrep) built libraries | Bank uploads per week; % of lessons citing bank items |

## 3. Users

### Primary: undergraduate student, 18+, Nigeria
- Android phone (mid-range, 3–4 GB RAM), mobile data bought in small bundles, intermittent power.
- Studies at night and between lectures; heavy WhatsApp user; pays small amounts often (airtime mindset).
- Wants: understand fast, pass, not waste data or money.

### Secondary
- **Lecturer:** wants less repetitive explaining, visibility into where a class is stuck, recognition, some income. Won't adopt anything that adds admin work.
- **Course rep:** relays timetable changes and materials; a natural distribution channel; can lock a course outline.
- **Curator (volunteer or paid, optional):** checks and fixes lessons in a subject they know. Lessons never wait for a curator.
- **Admin (us):** moderates names and uploads, merges duplicate courses and concepts, pays contributors. We do not create or curate the course catalogue.

### Not served at launch
- Under-18 users (age gate; see `08-security-privacy.md`).
- Secondary-school (JAMB/WAEC) track: later, minors-safe provider + parental consent required.

## 4. Product principles (use these to settle arguments)
1. **Show, then tell.** Every lesson starts with something to look at or move.
2. **One idea per screen.** If a screen needs scrolling to make its point, split it.
3. **Never guess a number.** Computed or verified, or not shown.
4. **Cite the source.** Explanations link back to the page they came from.
5. **Cheap by default.** Reuse before generating; generate on demand, once per concept, not in bulk; Flash-Lite before Flash.
6. **Student-led.** Never block a student because a course, topic or lecturer isn't on Ifiok yet. They can always start.
7. **Data-light.** No video in core flows; lessons are JSON plus code.
8. **Honest AI.** Marks from AI are labelled estimates. Uncertainty is shown, not hidden.
9. **Student's time is the scarcest resource.** Default session is 15–30 minutes.

## 5. Scope by phase

Phases are cumulative. A feature is "in" a phase when its acceptance criteria in `01-features.md` pass.

### Phase P0 — Foundations (no users)
Auth, profiles, age gate, universities, student-created courses, outlines and concepts, design system, AI gateway with budgets, Lesson DSL renderer, maths verifier, CI.

### Phase P1a — Closed pilot "Learn" (free, ~100–300 students, invite-only, any course or topic)
- F2 Lessons on demand for **any course or topic**: student-created courses, outlines (upload, typed or AI draft), concept resolution, generated once per concept and shared
- F1 AI Tutor (grounded chat, verified maths)
- F11 crowd uploads and curation (no rewards yet), so the bank starts growing from day one
- F4 Virtual Lab (2D): Generate as part of the AI course learning for topic or course that would be best explained using this 2d interactions
- F5 Practice and progress (checkpoints, items, FSRS review, mastery per concept)
- F6 Learning agent: goals, daily plan, adapting (deterministic planner, course calendar)
- F7 Snap-and-mark (maths) with root-cause diagnosis
- F14 Low-data basics (PWA shell, pinned lessons offline)
- Course invite links (WhatsApp share)
- **Launch audience, not course list:** invite students through course reps at one or two universities so there's a community to grow from, but they can learn any course or topic. Labs and snap-and-mark are maths/physics-first because that is what the engines check; lessons and the tutor cover every faculty.

### Phase P1b — Pilot extensions (same pilot, once P1a exit checks pass)
- F3 Textbook → private lessons (on-device extraction and matching)
- F4 Virtual 3D lab (generated for advance labs using three js or can be built using native html, 2D fallback) this is generated on request and saved
- Teach-back (text)
- A willingness-to-pay test in the last 4 weeks of the pilot (price page and "notify me" bundles, no real charges) to measure `p` and `A` for `09` §5

### Phase P2 — Paid launch "Earn"
- F13 Units wallet (Paystack top-ups, spending, earned Units)
- F11 Resource Bank rewards: usage tracking; contributors rewarded in Units
- F12 Lecturers (verified accounts, notes upload, class insight); paid in cash under direct content licences
- F8 Exam mode (past-paper extraction, exam map, mocks)
- F9 Course space (timetable, lecture preview and recap, push notifications)
- **P2b:** automatic contributor cash pool and withdrawals, switched on only when the pool is ≥ ₦250,000/month for 2 months and the terms have had legal review (`06`)

### Phase P3 — Growth
- F10 Study groups (peer Q&A checked by AI)
- "Show me this" reader, essay/theory marking, sponsor prize pools, more labs (supply and demand, trial balance, titration, logic gates), Pidgin explanations, WhatsApp nudges, department dashboard and lab licences, lecture recordings (with consent), offline packs.

### Later (needs separate legal/product work)
Under-18 users and JAMB/WAEC track; AR; employer access; markets outside Nigeria.

## 6. Non-goals (we will say no to these)
- Video lessons or live classes.
- A general note-taking or document workspace (Notion/Acadeva territory).
- Redistributing copyrighted textbooks.
- AI-generated executable code shown to students at runtime.
- Predicting exam questions. We show topic frequency and style, never "this will come out".
- Native mobile apps before product–market fit (PWA first).

## 7. Success metrics

| Metric | Definition | P1 target | P2 target |
|---|---|---|---|
| Activation | New user completes 1 lesson and gets 1 checkpoint right within 24h | 50% | 55% |
| Weekly active learners (WAL) | ≥ 3 study sessions in a week (session definition in F6-FR6) | 40% of pilot | 3,000 |
| D30 retention | Active in week 5 after signup | 25% | 30% |
| Mastery gain | Topics reaching Proficient per WAL per week | ≥2 | ≥2 |
| Lesson correctness | % of lesson blocks hidden, or flagged "wrong" by ≥ 2 students | <1% | <0.5% |
| AI cost of free usage per WAL per month (`c`) | Free-tier AI spend (incl. earned-Unit spending) ÷ WAL | ≤ ₦350 ($0.23) | ≤ ₦120 ($0.08) |
| Paying share | WAL with ≥ 1 top-up in month | Measured by the P1b willingness-to-pay test | ≥ 25% |
| Bank health | Approved uploads per week; % of lessons citing bank | 20/wk | 100/wk; 30% |
| Library reuse | Share of lesson opens served from an existing shared lesson (no new generation) | ≥ 60% by pilot week 8 | ≥ 85% |
| Reach | Distinct courses and concepts students created | Tracked | Tracked |

**North-star:** weekly topics mastered per active learner.

## 8. Naming and words used in the product
- Product: **Ifiok**. Descriptor: **the AI learning agent**. Tagline (proposed): **See it. Try it. Master it.**
- **Units:** in-app credits. Never "coins", "gems" or "tokens".
- **Earnings:** cash owed to contributors.
- **Mastery levels:** Not started · Familiar · Proficient · Mastered (lifted from Khan Academy's ladder, renamed thresholds in `01-features.md` F5).
- **Bench:** any lab surface. **Path:** the ordered topic route for a course.
