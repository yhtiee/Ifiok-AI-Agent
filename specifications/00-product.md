# 00 · Product

## 1. One-line definition
Ifiok is an AI learning agent that teaches a student **whatever they choose to learn** (any course, any topic, any faculty) with lessons they can see and move, practicals they can run, and practice that adapts, so they learn faster and practise faster. Exam preparation is one mode of it, and students earn when what they add helps other students.

**Student-led, not catalogue-led.** Ifiok has no fixed list of courses and does not depend on material we upload. Students create courses and pick topics; Ifiok reacts and builds what they need on demand. Everything a student triggers (a lesson, practice questions) is kept as a shared concept that the next student, at any university, reuses for free. A student's own notes, textbook pages, past questions and lab manuals ground their private lessons, exam prep and labs; materials they choose to share form a verified contribution pool that makes the AI's teaching better for everyone and pays them when others use it.

## 1b. Four pillars (owner decision, `12` §4 Q40)

Everything Ifiok does belongs to one of four pillars. A feature that fits none of them is out of scope.

| Pillar | What the student gets | Built from | Spec | When |
|---|---|---|---|---|
| **1. Learn: a path through any course or topic** | Upload the outline, notes and textbook pages (or just name a topic) and get an ordered Path of interactive lessons, practice and mastery per topic, with the weak areas called out and the next step | F2, F3, F5, F6 (light), F7 diagnosis | `10` MVP-01–03 | Stage 1 · MVP |
| **2. Prepare: exam- and goal-based study** | Upload past questions; Ifiok finds what the papers ask (topic frequency, question styles, flow of marks), builds a study plan up to the exam date, and runs assessments (practice papers, timed mocks) until the student is ready | F8, F6 goals, F5 | `10` MVP-04 | Stage 1 · MVP |
| **3. Practise: virtual labs on request** | Ask for a lab by uploading the manual or picking a lab topic; Ifiok configures an interactive experiment, the student takes readings, analyses them and gets a lab report | F4 (amended, Q38) | `10` MVP-05 | Stage 1 · MVP |
| **4. Teach and earn** | Get paid when what you add helps other students: **uploads** (notes, past questions, lab manuals) verified into the contribution pool; **explainers** you create (written, voice or short video) that others learn from; **curating** AI lessons in subjects you've mastered; **tutoring** sessions | F11, F13, F17, F18, `06` §12–14 | `10` MVP-06, then E-01–E-06 | Stage 1 · MVP: share, teach (text, voice, video), earnings recorded as points and Units · Stage 3 · Earn: real payouts, curators, tutoring bookings |

**Ifiok's lane (partner, not rival, to libraries such as Acadeva).** Ifiok is the *learning engine*: it turns materials into understanding (lessons, labs), readiness (exam prep, assessments) and earnings (the contribution pool). It is not a library, a document workspace, a timetable app or a social network. Where students already keep materials elsewhere (WhatsApp, Drive, a library app such as Acadeva), Ifiok imports from there rather than rebuilding it, so a library product can be a distribution partner: its materials become Ifiok lessons, labs and exam prep.

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
- **Student tutor** (Stage 3 · Earn, `12` §4 Q39): a student who has mastered a topic on Ifiok and teaches it to other students in paid sessions (F17). Wants income that fits around classes and recognition for being good at a subject.
- **Student curator** (paid, Stage 3 · Earn): a strong student who checks and fixes AI lessons in subjects they know (F2-FR6), paid per accepted review (`06` §13). Lessons never wait for a curator.
- **Lecturers are not served for now** (Q39): no lecturer accounts, uploads, class insight or licence payments. F12 stays in the spec for later.
- **Student creator** (Stage 3 · Earn, Q41): a student who has mastered a topic and publishes explainers (written, voice or short video) that other students learn from, paid by usage (`06` §14).
- **Course rep:** shares invite links and materials; a natural distribution channel; can lock a course outline.
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
7. **Data-light.** Lessons are JSON plus code. Video appears only as optional student explainers (Q41): short, compressed, never auto-played, captioned, and replaced by transcript and audio in data-saver mode.
8. **Honest AI.** Marks from AI are labelled estimates. Uncertainty is shown, not hidden.
9. **Student's time is the scarcest resource.** Default session is 15–30 minutes.

## 5. Scope by stage

Stages run in order; tickets and exit checks are in `10-build-plan.md`. A feature is "in" a stage when its acceptance criteria in `01-features.md` pass. (The earlier phases P0–P3 map roughly to: P0 + P1a core → Stage 1 and 2; P2 → Stage 3; P1b/P3 extras → Stage 4.)

### Stage 1 · MVP (hackathon, 27 Oct 2026)
- **Learn:** materials upload (PDF read on the device, chosen pages only), Path for a course or topic, lessons grounded in the student's own materials (private) or shared concept lessons, practice items, mastery, weak areas, Today (F2, F3 light, F5, F7 diagnosis)
- **Prepare:** past-question extraction and patterns, a study plan to the exam date, worked solutions, timed practice papers (F8, F6 light)
- **Practise:** the virtual experiment engine, labs from a manual or a requested lab topic, lab reports (F4)
- **Teach and earn:** share materials to the library (checked and approved), explainers in text, voice or short video for mastered topics, usage points and Units earned recorded server-side, My earnings, tutor profiles (MVP-06). No cash moves until Stage 3 (Q42).
- Stretch: grounded "Ask about this" tutor (F1)

### Stage 2 · Launch (real students, free)
Security and observability with PostHog usage analytics, admin and moderation, email verification and recovery, privacy self-service and retention, bad-network basics (PWA, pinned topics, offline sync), invite links. Launch audience: course reps at one or two universities; anyone can learn any course or topic.

### Stage 3 · Earn (real money)
- Shared library at scale: curator-reviewed holds, takedowns, full qualified-consumer rules (F11; the basics ship in the MVP)
- Paid student curators and the curator queue (`06` §13)
- Units wallet, Paystack top-ups and contributor rewards in Units (F13)
- Explainers at scale: curator review, reporting, points converted to Units and cash shares (F18, `06` §14; publishing ships in the MVP)
- Paid peer tutoring through a licensed escrow partner (F17, `06` §12)
- Cash payouts from the contribution pool, switched on only when the pool is ≥ ₦250,000/month for 2 months and the terms have had legal review (`06` §3)

### Stage 4 · Grow (by usage)
Chosen from usage data: spaced review (FSRS), the full adaptive planner and goals, the grounded tutor, check-my-working (snap-and-mark), more labs and the 3D PC build, lecture preview and recap, push reminders, private textbook matching, Pidgin explanations and WhatsApp nudges, sponsor prize pools, department lab licences.

### Not planned now (owner decisions)
Lecturer accounts and licences (F12, Q39); general study groups (F10, Q40); timetable/reminder app, book library, "solve this for me" (Q40).

### Later (needs separate legal/product work)
Under-18 users and JAMB/WAEC track; AR; employer access; markets outside Nigeria.

## 6. Non-goals (we will say no to these)
- Video lessons produced by Ifiok, or live classes. (Student video explainers are allowed as optional, short, reviewed contributions, Q41; tutoring sessions happen by chat and the call or meeting the two students arrange.)
- A general note-taking or document workspace (Notion/Acadeva territory).
- A downloadable book library, standalone timetable/reminder app, or general group chat: library and workspace apps do these; Ifiok imports from them (pillar boundary, Q40). Lecture preview and recap (F9) stay because they are learning, not scheduling; general study groups (F10) are deferred.
- "Solve this for me" answer apps. Snap-and-mark (F7) checks the student's own working and diagnoses the mistake; it never just hands over an answer.
- Redistributing copyrighted textbooks.
- AI-generated executable code shown to students at runtime.
- Predicting exam questions. We show topic frequency and style, never "this will come out".
- Native mobile apps before product–market fit (PWA first).

## 7. Success metrics

| Metric | Definition | Launch target | Earn target |
|---|---|---|---|
| Activation | New user completes 1 lesson and gets 1 checkpoint right within 24h | 50% | 55% |
| Weekly active learners (WAL) | ≥ 3 study sessions in a week (session definition in F6-FR6) | 40% of pilot | 3,000 |
| D30 retention | Active in week 5 after signup | 25% | 30% |
| Mastery gain | Topics reaching Proficient per WAL per week | ≥2 | ≥2 |
| Lesson correctness | % of lesson blocks hidden, or flagged "wrong" by ≥ 2 students | <1% | <0.5% |
| AI cost of free usage per WAL per month (`c`) | Free-tier AI spend (incl. earned-Unit spending) ÷ WAL | ≤ ₦350 ($0.23) | ≤ ₦120 ($0.08) |
| Paying share | WAL with ≥ 1 top-up in month | Measured by a willingness-to-pay test before Stage 3 | ≥ 25% |
| Contribution pool health | Approved shared uploads and explainers per week; % of lessons citing the pool | 20/wk (from Stage 3) | 100/wk; 30% |
| Earning students | Students paid in a month (curating, uploads, explainers, tutoring) | — | Tracked; target set from pilot |
| Library reuse | Share of lesson opens served from an existing shared lesson (no new generation) | ≥ 60% by pilot week 8 | ≥ 85% |
| Reach | Distinct courses and concepts students created | Tracked | Tracked |

**North-star:** weekly topics mastered per active learner.

## 8. Naming and words used in the product
- Product: **Ifiok**. Descriptor: **the AI learning agent**. Tagline (proposed): **See it. Try it. Master it.**
- **Units:** in-app credits. Never "coins", "gems" or "tokens".
- **Earnings:** cash owed to contributors.
- **Mastery levels:** Not started · Familiar · Proficient · Mastered (lifted from Khan Academy's ladder, renamed thresholds in `01-features.md` F5).
- **Bench:** any lab surface. **Path:** the ordered topic route for a course.
