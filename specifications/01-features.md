# 01 · Features

Format for each feature: **Purpose · Stage · User stories · Functional requirements (FR) · Acceptance criteria (AC) · Edge cases · Trade-offs · Cost notes.**
IDs are stable; reference them in commits and tests (e.g. `F5-FR3`). Stages and tickets: `10-build-plan.md`. Pillars: `00` §1b.

## Feature map (by pillar and stage)

| Pillar | Feature | Stage 1 · MVP | Later |
|---|---|---|---|
| Foundation | **F0** Accounts, age gate, onboarding | Built | Email verification, Turnstile (Launch) |
| 1 · Learn | **F2** Lessons on demand, shared by concept | Built; private lessons from the student's materials (MVP-02) | Curator queue, trusted promotion, refresh (Earn) |
| 1 · Learn | **F3** Materials read on the device (all PDFs) | Page picker and text extraction (MVP-01) | Private textbook page matching (Grow) |
| 1 · Learn | **F5** Practice and progress | Items, `/api/sync`, mastery, weak areas (MVP-02, MVP-03) | Spaced review FSRS (Grow) |
| 1 · Learn | **F7** Diagnosis; check my working | Error tags and weak areas (MVP-03) | Snap-and-mark of handwritten working (Grow) |
| 1 · Learn | **F1** Grounded tutor | Stretch: "Ask about this" | Full tutor (Grow) |
| 2 · Prepare | **F8** Exam mode | Extraction, patterns, practice papers (MVP-04) | Style templates, mocks by blueprint (Grow) |
| 2 · Prepare | **F6** Goals and plan | Study plan to the exam date (MVP-04) | Full adaptive planner (Grow) |
| 3 · Practise | **F4** Virtual labs | Virtual experiment engine from a manual or a topic (MVP-05) | More engines, 3D PC build (Grow) |
| 4 · Teach and earn | **F11** Contribution pool (shared library) | Share, automatic checks, approval, usage points (MVP-06) | Curators, takedowns, cash shares (Earn) |
| 4 · Teach and earn | **F13** Units wallet and rewards | Units earned recorded as pending (MVP-06) | Wallet, top-ups, spending, payouts (Earn) |
| 4 · Teach and earn | **F18** Student explainers (text, voice, video) | Publish with AI + admin review, captions, usage points (MVP-06) | Curator review, scale (Earn) |
| 4 · Teach and earn | **F17** Peer tutoring (paid) | Tutor profiles only (MVP-06) | Bookings with escrow (Earn) |
| Platform | **F14** Access and low-data | — | PWA basics (Launch), full (Grow) |
| Platform | **F15** Admin and moderation | — | Launch |
| Platform | **F16** Notifications | — | Grow |
| Platform | **F9** Lecture preview and recap | — | Grow (learning parts only) |
| Not planned | **F10** Study groups | — | Deferred (Q40) |
| Not planned | **F12** Lecturers | — | Deferred (Q39) |

---

## F0 · Accounts, age gate and onboarding
**Purpose:** Get a student from install to their first "aha" (a lesson they can move) in under 3 minutes. **Stage:** built (MVP); email verification and Turnstile at Launch.

**Stories**
- As a student, I sign up with Google or email code, confirm I'm 18+, tell Ifiok my university and what I want to learn (a course or any topic), and land on Today with a first lesson ready or being built.
- As a lecturer, I sign up with my staff email and request verification.

**FR**
1. Auth: Supabase Auth with **Google OAuth** and **email one-time code** (6 digits). No SMS (costs money).
2. Age gate: date of birth (month and year) is the first onboarding step. **Under 18 → nothing is kept:** the server deletes the just-created auth user and profile immediately, shows why Ifiok is 18+ for now, and asks a parent or guardian to email us if they want to hear when minors are supported (`08` §3). 18+ → store year/month only and set `is_adult`.
3. Consents recorded with version and timestamp: Terms, Privacy, AI disclosure ("Ifiok is an AI; it can be wrong"). See `08`.
4. Onboarding steps (one per screen): date of birth → university (or "not at a university") → level → **"What do you want to learn?"** (search or create a course, or type any topic; several allowed; a course invite link pre-fills it) → daily study minutes (15/30/45/60, default 30). Department and goals can be added later.
5. On finish: the planner (F6) creates today's plan. If a shared lesson already exists for the first topic, it opens instantly; otherwise generation starts during onboarding and the student sees progress and a quick explanation meanwhile (F2-FR4).
6. Profile: display name, avatar initial (no photo upload in P1), locale, data-saver toggle.
7. **Course invite link** (P1): `/join/<course-code>?ref=<user>` with a WhatsApp share button and an Open Graph card; the course rep is the main distribution channel. Attribution recorded in PostHog.

**AC**
- New user reaches Today with ≥ 1 runnable task in ≤ 12 taps and ≤ 3 minutes after auth (the runnable-task part is tested from P1-06, when the planner and on-demand lessons exist).
- An under-18 DOB leaves no auth user, profile or other row behind (test), and never reaches any AI endpoint.
- Consent rows exist for every active user.

**Edge cases:** course not listed (the student creates it, F2-FR1); user changes university (keep history, re-plan; mastery is per concept, so it carries over).
**Trade-offs:** DOB is self-declared (no ID checks at P1). We accept this, state it in Terms, and add a stricter check before any minor-facing launch.

---

## F1 · AI Tutor (grounded, verified)
**Purpose:** Answer questions and explain topics using the student's course material, with maths that is computed, not guessed. **Stage:** MVP stretch ("Ask about this"); full tutor in Grow.

**Stories**
- I ask "Why is the derivative of x² equal to 2x?" and get a short explanation, a moving graph, and a link to the page in my notes.
- I tap "Explain it differently" and get a new angle (analogy, worked example or picture).
- I ask for a calculation and the numbers are right.

**FR**
1. Chat bound to what the student is learning: a course, a topic, or nothing in particular (context picker at top; defaults to the current task's course and concept).
2. Retrieval: hybrid search (Postgres full-text + `gte-small` embeddings) over (a) approved crowd material for the concept from any university, (b) course-only material such as a lecturer's notes when the student is in that course, and (c) the student's own private chunks. Top 6 chunks, max 1,500 tokens.
3. Responses have two parts (contract in `04` §4.1): streamed markdown prose, then a held-back JSON section `{ blocks, citations, grounded }` validated on the server and sent as a separate event. Tutor blocks are limited to `math`, `stepper`, `plot`, `checkpoint`. Blocks use the Lesson DSL (`05`) so the tutor can drop in a plot, stepper or checkpoint.
4. Tools available to the model: `math_evaluate`, `math_simplify`, `math_derivative`, `math_check_equivalent`, `math_solve`, `math_integrate_check` (verifies a claimed antiderivative by differentiating it), `retrieve(query)`. Any number in the reply that came from a calculation **must** come from a tool result. At most 2 tool rounds per message. Blocks that fail verification (`05` §6) are dropped (no retry, the prose is already shown); unmatched numbers in prose get a "Check this number" marker (`04` §4.1).
5. Modes: "Explain differently" (re-asks with a style hint: analogy / worked example / visual / step-by-step); "Simpler" and "Deeper".
6. Citations render as chips: "Handout p. 12". Tapping opens the source snippet.
7. If retrieval finds nothing relevant (max similarity below threshold), the tutor says so and answers from general knowledge with the label "Not from your course material".
8. Streaming: stream the prose tokens; render blocks when their event arrives.
9. Free quota: **8 tutor messages/day** in P1 (P2 start: 3/day, `09` §5). In P1 there are no Units: when the quota is used, show the reset message (`04` §5). From P2, 1 Unit per extra message (F13). Quota counter visible.
10. Safety: system prompt plus input/output moderation (see `04` §7). Off-topic chat is allowed but counts towards the quota.

**AC**
- On a 50-question calculus eval set, 0 numeric errors in final answers (all numbers from tools) and ≥ 90% judged correct by rubric (`11`).
- Citations present on ≥ 80% of answers when relevant chunks exist.
- p95 time to first token (from Lagos, 4G) ≤ 2.5 s without tool calls, ≤ 4 s with tools.

**Edge cases:** image question → route to F7 capture flow; prompt injection inside uploaded material (treated as data; see `04` §7); user asks for exam leaks or cheating during an exam → refuse; very long thread → summarise older turns server-side (keep last 6 turns).
**Trade-offs:** blocks arrive after the prose. We accept that, because verifying blocks before showing them matters more than a single stream.
**Cost notes:** ~3.9k input (incl. tool rounds) + 500 output (incl. thinking) on Flash-Lite ≈ $0.0017 (₦2.6) per message (`09` §4). Free messages are the main cost driver.

---

## F2 · Lessons on demand for any course or topic (generated once, shared by concept)
**Purpose:** A student names what they want to learn (any course, any topic, any faculty) and gets an interactive lesson for it. Nothing is pre-loaded or curated by Ifiok. The first request for a concept generates the lesson; every later student who needs that concept, at any university, reuses it. **Stage:** built; private lessons from the student's own materials in MVP (MVP-02); curator queue, trusted promotion and refresh in Earn (E-02).

**Stories**
- I type "MTH 101 at Uniuyo". It doesn't exist yet, so I create it and snap the course outline from my handout. Ifiok turns it into a list of topics and I fix two of them. I open week 3, "Limits", and get a lesson in about a minute.
- I don't have an outline. Ifiok drafts one from the course title and level, clearly labelled as a draft, and I edit it. Classmates who join later see the same outline and can improve it.
- I'm not doing a course: I just want to understand "Fourier series" or "judicial precedent". I type it and learn it.
- A student at Unilag opens "Limits" in MTH 111. The lesson I triggered is already there, so it loads instantly at no AI cost.

**FR**
1. **Starting points** (one search box, "What do you want to learn?"):
   - **A course:** search courses at the student's university by code or title. If none matches, create it (`/api/courses`: normalises the code, shows near-duplicates first, moderates the title, 5 new courses per user per day). No admin approval.
   - **A topic:** free text, resolved to a concept (FR3) and followed in `concept_follows`, with or without a course.
   - **A goal:** practical, exam (P2) or master a course; these sit on top of courses and topics (F6).
2. **Course outline** (shared by everyone enrolled in that course, edited wiki-style with full history in `outline_revisions`):
   - From an **upload or photo** of the outline (scheme of work, course outline, syllabus) → `scheme_extract` → the student confirms the extracted list.
   - From **typed topics**.
   - From an **AI draft** (`outline_draft`, using the course title, level, university and any approved materials already in the bank), labelled "Draft outline. Check it against your course." until a student confirms it.
   - Any enrolled adult can edit (add, rename, reorder, archive topics). A verified lecturer or the course rep can lock the outline. Edits are rate-limited and revertible.
3. **Concept resolution** (`topic_resolve`): every topic (from an outline or typed alone) is mapped to a global **concept** (`03` §2): embedding similarity against existing concepts in the same subject and level band → ≥ 0.88 auto-match; 0.80–0.88 a Flash-Lite check decides; below that a new concept is created. The course keeps its own wording; the concept carries the lesson, items and mastery. Admins can merge duplicate concepts later (lessons, items and mastery move to the survivor).
4. **Generation on demand:** opening a concept with no published lesson starts a `lesson_gen` job (one per concept: the dedupe key stops two students triggering two jobs). Inputs: the concept, the course's wording and outline context, level, subject profile (STEM / social science / humanities), and **approved crowd sources for that concept**, fetched only through `shared_lesson_sources` (approved bank chunks from any university; never a student's private chunks, never course-only material such as a lecturer's handout, never past papers). Course-only material helps students in that course through the tutor (and, in P3, course supplements). Output = Lesson DSL (`05`): 6–12 screens of 1–3 blocks, ≥ 2 checkpoints, ≥ 1 interactive block where the subject allows. While it runs (≈ 30–90 s) the student sees the step list and a short tutor explainer labelled "Quick explanation while your lesson is built".
5. **Publishing without a human gate (most subjects):** a generated lesson that passes every automatic check is published at once with `trust = 'new'` and a visible label. Checks: schema, size, source quotes, and
   - **STEM:** maths verification (`05` §6). Label: "New lesson. Checked by Ifiok's maths engine".
   - **Everything else:** a **claim check**: Flash-Lite lists the lesson's factual claims and checks each against the cited chunks; unsupported claims are removed or the lesson is labelled "General explanation (not from course material)". Label otherwise: "New lesson. Based on N sources".
   - **Sensitive subjects** (`subjects.sensitive`: medicine, nursing, pharmacy, law at launch): the lesson waits for a curator before it is shown; until then the student gets the tutor with the "General explanation" label.
   - It becomes `trusted` after ≥ 20 completions, with "wrong" flags from distinct students (confirmed or not) on < 2% of completions and no hidden blocks, **or** when a curator approves it (a second curator is needed once the lesson has ≥ 50 completions).
   - A lesson that fails a check goes to `review`; the student gets the tutor explainer and a retry.
6. **Quality loop:** "Flag this" on every block. Flags from 3 different students hide the block pending review. Curators (volunteer or paid subject reviewers, optional except for sensitive subjects) work a queue of flagged and `new` lessons per subject, and fix blocks through `/api/lessons/:id` (verification gate, audit). A fix creates a new version; the old one becomes `superseded` (still readable, so progress keeps its version). A lesson is global, so curators fix errors and clarity, not a single university's notation or emphasis; course-specific emphasis belongs in course supplements (P3).
7. **Getting better with crowd material:** when a concept gains ≥ 5 new approved crowd chunks since its lesson was generated, or ≥ 3 confirmed flags, it is queued for a **refresh** (regenerate with the new sources, run the checks, publish as a new version).
8. **Quota on new generation:** opening an existing lesson is always free and unlimited. Triggering a **new** concept lesson counts against a monthly quota (P1: 10 per user per month; P2 start: 3, then Units, `09` §5), charged only when the request actually creates a new job (a student whose request joins someone else's job is not charged) and refunded if the lesson fails its checks. Library generation has its **own daily budget** (`04` §5): when it is used up, the job waits in the queue and the student sees "Your lesson will be ready by tomorrow morning" plus the tutor explainer now. Popular concepts can be pre-generated as a cache (e.g. common first-year topics) to make first experiences instant; that is warming the cache, not limiting what students can learn.

**AC**
- A student can create a course, get an outline (upload, typed or AI draft) and open a lesson for any topic in it without any admin action.
- A second student requesting the same concept (same subject and level band, any university) gets the existing lesson with no AI call (test).
- Each published lesson passes schema validation and verification; ≥ 2 checkpoints; every number in `stepper`, `plot` and `checkpoint` blocks is traceable to a checked expression; non-STEM claims cite sources when sources exist, otherwise the lesson is labelled "General explanation".
- p95 time from request to a published new lesson ≤ 120 s; lesson JSON ≤ 60 KB.
- `topic_resolve` matches the right existing concept ≥ 90% of the time on its eval set and creates a duplicate concept ≤ 5% of the time (`11` §3).

**Edge cases:** joke or abusive course/topic names (moderation, then blocked); the same course created twice with different spellings (normalised code + near-duplicate prompt; admin merge); a topic too broad ("Physics") → asked to pick a narrower topic from suggestions; a topic outside any syllabus ("how to fix my generator") → tutor answers, no lesson; a concept requested at the wrong level (student can switch level band); non-English topics (P1 English only).
**Trade-offs:** no human gate means faster coverage of any subject, but a wrong lesson can reach students before anyone checks it. Mitigations: automatic verification, citations, visible "new" labels, the 3-flag hide rule, curator queues and refresh. Revisit if confirmed-wrong blocks exceed 1%.
**Cost notes:** one lesson ≈ $0.089 on Flash or ≈ $0.017 on Flash-Lite (`09` §4), paid **once per concept**, not per student. Cost grows with the size of the library, not with users; `09` §5 models it.

---

## F3 · Materials read on the device (textbooks and every PDF)
**Purpose:** Turn the topics a student is studying into lessons from their own textbook, without storing or sharing the book. **Stage:** MVP for on-device extraction of every PDF upload (MVP-01, Q38: notes, past questions and lab manuals use the same page picker, so nothing is stored as a file); private textbook page matching in Grow.

**Stories**
- I pick my textbook PDF. Ifiok shows which chapters match this week's topics. I confirm, and a lesson is built from those pages for me.

**FR**
1. PDF processed **in the browser** with pdf.js: extract text per page and the outline (TOC). The file itself is **never uploaded** for private textbooks.
2. Pages without a text layer (scans): render to image at 1,280 px on the device, and send only the pages the student confirms for a topic to OCR (vision model). Show the page count and Units cost before sending.
3. Topic → page matching **on the device only**: the server sends the titles, descriptions and keywords of the student's topics (from their course outline or followed concepts); the browser scores TOC headings and extracted page text with a small BM25 keyword scorer in the PDF worker. Show the top 3 page ranges with snippets; the student confirms or adjusts. **No page text leaves the device before confirmation.**
4. For the confirmed range (max 25 pages / 12k tokens), generate a **private** lesson (owner-only RLS) in the Lesson DSL, with citations to pages.
5. Store only: extracted text chunks for confirmed ranges (owner-only), the lesson JSON and the book's title/hash. No full-book text is stored.
6. Cost: P1b: 3 private lessons free per month (no Units yet). P2: one free trial lesson, then Units priced from measured cost (default 21 Units, `09` §4–§5).

**AC**
- On a mid-range Android phone (pdf.js in a Web Worker, file read in ranges with `PDFDataRangeTransport` over `File.slice`): a 400-page PDF with an outline is matched in ≤ 20 s; without an outline, full-text matching shows progress, can be paused, and finishes in ≤ 90 s. Files over 100 MB are refused with a message.
- No request ever contains more than the confirmed pages' text (test with network capture).
- Private lessons are invisible to everyone but the owner (RLS test).

**Edge cases:** password-protected PDF (ask to remove); PDFs over 100 MB (refuse, suggest splitting); non-English books (P1 English only); EPUB (later).
**Trade-offs:** on-device processing saves storage and protects copyright, but old phones are slow. Mitigation: page-range picker before extraction, worker thread, progress UI, "do this on Wi-Fi" hint.

---

## F4 · Virtual Lab (2D and 3D)
**Purpose:** Run practicals that behave like the real apparatus, on request, for practicals the student's lab can't run. **Stage:** MVP (virtual experiment engine, MVP-05); more engines and the 3D PC build in Grow.

> **Amended by `12` §4 Q38/Q40:** besides hand-built labs, the hand-built **virtual experiment engine** (`05` §9) is configured by AI from a student's lab manual or a requested lab topic. The AI outputs only a configuration (variables, governing relation, noise, procedure, analysis, accepted value); every reading comes from the engine; configurations whose analysis doesn't recover their constant are rejected, and non-measurement activities are declined.

**Stories**
- I wire the Ohm's law circuit, take readings, plot V against I, find R, and get a lab report.
- I assemble a PC in 3D; if I forget the 8-pin CPU cable, the CPU debug LED stays lit.

**FR**
1. Labs are code modules registered in a **lab registry** (`05` §8): `{ slug, title, subject, engine: '2d'|'3d', paramsSchema, stations[], reportSchema }`.
2. P1a labs: `ohms-law` (port the prototype: build → measure → analyse → report; physics solver with internal resistance, meter loading, heating) and `simple-pendulum` (PHY 107, 2D). P1b: `pc-build` (port the three.js prototype: parts, slots, rules, debug LEDs, beep codes, thermal model) for CSC/computer engineering.
3. Lessons can embed a lab via the `sim` block with params (e.g. resistor value range). The AI picks and configures; it never writes lab code.
4. Lab runs save to `lab_runs` (readings, result, score, report). The report can be copied or exported as a PDF (client-side print-to-PDF via a print stylesheet).
5. 3D labs load three.js only on the lab route (code-split). Device check: if WebGL is unavailable or the device is weak (≤ 2 GB RAM via `navigator.deviceMemory`, or < 30 fps over the first 3 s), switch to the **2D fallback** (top-down SVG version with the same rules).
6. Every lab has a text-only accessible mode: steps as a list, readings as a table.

**AC**
- Ohm's law lab: computed R within ±2% of the hidden true value when readings are taken correctly; heating behaviour reproducible from seed.
- Simple pendulum lab: g within ±3% for a correct procedure (≥ 5 lengths, ≥ 10 oscillations timed); reaction-time error and large-amplitude effects reproducible from seed.
- PC build: all failure modes from the prototype reproduce (no 24-pin, no 8-pin, no RAM, single channel, no GPU power, no SSD, no cooler, no paste, lever open).
- 3D lab JS chunk ≤ 650 KB gzipped; first interaction ≤ 4 s on a mid-range phone on 4G.

**Edge cases:** device rotates mid-lab (keep state); backgrounded tab (pause timers); offline (labs work fully offline once loaded).
**Trade-offs:** hand-built labs limit coverage (a few per term), but they are correct and reusable. That is the right trade for trust.
**Cost notes:** zero AI cost at runtime.

---

## F5 · Practice and progress
**Purpose:** Make learning stick through practice at the right time, and show students where they stand. **Stage:** MVP (items, server-graded attempts, mastery, weak areas); spaced review in Grow.

**FR**
1. **Items** (practice questions) per concept (shared across courses and universities): types `mcq`, `numeric`, `expression`, `short_text`, `order`, `match`. Each has a verification spec (`05` §6). Items come from (a) lesson checkpoints, (b) batch generation per topic (shared), (c) past papers (F8), (d) bank (F11).
2. Item generation is shared per concept and lazy: the first 10 items are generated when the first student starts practising a concept (not when the lesson is made), up to 30 at three difficulties as demand grows. Items start in `review` and are auto-published only after the two independent checks (`05` §4); the rest go to the review queue. More are generated when a user exhausts the pool.
3. **Spaced review** with FSRS (`ts-fsrs` library). A review card is created for an item the student got **wrong**, and for one representative item per micro-skill once the topic reaches Proficient (so cards stay in the dozens, not hundreds). Cards are written by `/api/sync` only. Reviews are due per FSRS; the planner (F6) puts due reviews into the day.
4. **Mastery per concept** `m ∈ [0,1]` (so it carries across courses and universities):
   - Correct: `m ← m + (1−m)·0.18·w`; wrong: `m ← m − m·0.22·w`, where `w` is the difficulty weight (easy 0.7, medium 1.0, hard 1.3).
   - Levels: **Not started** (no attempts) · **Familiar** (m ≥ 0.30) · **Proficient** (m ≥ 0.60) · **Mastered** (m ≥ 0.85 **and** a correct spaced review ≥ 3 days after reaching Proficient).
5. **Teach-back** (P1 text, P3 voice): the student explains a topic in their own words; a Flash-Lite rubric checks key ideas from the lesson and asks one probing question. Counts as a hard attempt.
6. Progress: per course (its outline as a path with mastery levels) and for followed topics; due reviews; weak micro-skills.

**AC**
- FSRS scheduling matches the `ts-fsrs` reference for 20 synthetic histories.
- Mastery transitions are unit-tested at boundaries.
- Practice works offline for pinned topics; attempts sync when online without duplicates (idempotent client IDs).

**Trade-offs:** a simple mastery formula over full Bayesian Knowledge Tracing. It is explainable and tunable; revisit with pilot data.

---

## F6 · Learning agent (goals, plan, adapting)
**Purpose:** The student says what they want; Ifiok decides what to do today and changes course when needed. **Stage:** MVP for a deterministic study plan to an exam date (MVP-04); goals, triggers and the adaptive daily plan in Grow.

**FR**
1. **Goals:** `understand_topic(topic, by?)`, `practical_ready(lab, date)`, `master_course(course, by)`, `exam(course, date)` (P2). Max 3 active goals.
2. **Daily plan** is computed by a deterministic planner (`lib/agent/planner.ts`), not an LLM:
   - Inputs: goals, daily minutes, mastery (per concept), due reviews, the course outline order, the course calendar (`course_terms`: week 1 date and any override, so "current week" follows strikes and holidays; any enrolled member can set the start date once, later changes have history and revert), followed topics, timetable (F9, P2), exam weights (F8, P2), diagnosis flags.
   - **No calendar yet** (common for student-created courses): follow outline order from the student's first topic that isn't Proficient. `concept_prereqs` refine the order only where links exist.
   - Candidate tasks and base priority: due reviews (P=90, capped at 30% of minutes), lecture preview/recap (P=85, P2), remediation for diagnosed gaps (P=80), next topic in outline order (or a followed topic) whose known prerequisites are ≥ Familiar (P=70), practical prep if a lab date is ≤ 7 days away (P=75), exam topics weighted by `exam_share × (1 − m)` (P=60–88, P2), weekly mock (P=65, P2).
   - Fill greedily by priority using time estimates (lesson 12 min, review 1 min per card, lab 15 min, practice set 8 min).
3. **Adapting (re-plan triggers):**
   - Missed day: roll unfinished tasks forward; if behind schedule for a dated goal, raise daily minutes suggestion (never silently).
   - 3 wrong answers sharing an error tag within 14 days → insert a remediation micro-lesson for that micro-skill (F7 §diagnosis).
   - Mastery jump (Proficient reached early) → skip ahead.
4. **Brief:** each morning, a 2-sentence message ("Today: finish Limits, then 12 reviews. You're on track for your 12 Dec exam."). Template-first; an LLM rewrite is optional (Flash-Lite, ≤ 120 tokens) and can be turned off.
5. All planner decisions are logged in `plan_events` with a reason string shown to the user ("Added because you missed sign rules 3 times").
6. Task completion is set by the server from evidence (`/api/sync`: attempts and `screen_events`); the client can only skip a task. A **study session** is ≥ 1 server-recorded attempt or screen event within a 30-minute window; `daily_activity` holds sessions per Lagos day and drives streaks and the WAL metric.

**AC**
- Planner unit tests cover each trigger; the plan for a fixed state is deterministic.
- Plan generation runs in < 200 ms server-side per user.
- Every task shows its "why".

**Trade-offs:** a rules engine instead of an autonomous LLM agent. It is less magical but predictable, testable and nearly free. The "agentic" behaviour is the loop: read → plan → teach → check → adapt.

---

## F7 · Snap-and-mark and root-cause diagnosis
**Purpose:** Mark a photo of handwritten working line by line, and find the real gap behind repeated mistakes. **Stage:** diagnosis from practice and exam attempts in MVP (MVP-03); photo marking in Grow. Framed as "check my working": it marks the student's own steps and names the mistake, never just hands over an answer (Q40).

**FR — capture**
1. Camera or gallery → crop to one question → client compresses to max 1,600 px longest side, JPEG q=0.7 (~150–250 KB).
2. Optional: link to an item/question (from practice or a past paper), or type the question.

**FR — pipeline (worker queues `mark_transcribe` and `mark_verify`)**
3. Two queued jobs with a pause between them. `submissions.status`: `transcribing` → (`needs_confirmation`) → `marking` → `done` | `failed`.
   - `mark_transcribe`: vision transcription → JSON per `04` §4.4 (`lines: [{latex, mathjs, confidence, bbox}]`). Model: Flash-Lite if it passes the transcription eval (P1 goal, `11` §3), else Flash.
4. If any line confidence < 0.75, status becomes `needs_confirmation` and the student confirms or edits the transcription (MathLive). `POST /api/snap/:id/confirm` then enqueues `mark_verify`. If all lines are ≥ 0.75, `mark_verify` is enqueued straight away.
5. `mark_verify` checks each step using the `mathjs` form of each confirmed line (the transcription returns it; MathLive edits produce it via `latexToMathjs` in `packages/core/verify`, with Cortex Compute Engine as the fallback parser). Each step gets `ok`, `wrong` or `unchecked` (`05` §6). The first `wrong` step is flagged; `unchecked` lines are shown as "Couldn't check this line" and never cost marks.
6. Explanation: Flash-Lite gets the two lines around the break plus the question and returns `{ what_went_wrong, fix_hint, error_tag }`. `error_tag` comes from the subject's controlled vocabulary of micro-skills (e.g. `algebra.sign_rules`, `algebra.expand_brackets`, `calc.power_rule`, `calc.limits_eval`).
7. Marks: if the item has a marking scheme (method and accuracy marks), award method marks for steps up to the first `wrong` step, plus the accuracy mark only if the final answer is correct and equivalent. Always labelled **"Estimated marks"**.
8. Result screen: the photo with the flagged line highlighted (bounding box from transcription), the fix hint, and "Practise this" (3 targeted items).

**FR — diagnosis**
9. Error tags accumulate from snap-and-mark and practice. If one tag appears ≥ 3 times in 14 days, or a prerequisite micro-skill tag appears in failures on a dependent topic, the planner inserts a **remediation micro-lesson** from the shared foundation library (pre-generated, reviewed), then 3 practice items, then returns to the original topic.

**AC**
- On a 40-photo handwritten eval set (`11`): transcription line accuracy ≥ 92% after confirmation; first-error localisation correct ≥ 85%; zero cases where a correct solution is marked wrong after the student confirms the transcription.
- Free quota: 2 marks/day in P1 (P2 start: 1/day); from P2, 3 Units each beyond the quota.

**Edge cases:** multiple questions in one photo (ask to crop one); non-maths (P1: politely decline, "Theory marking is coming"); illegible (ask to retake, tips); diagrams in working (ignore, note "Diagrams aren't marked yet").
**Trade-offs:** the confirmation step adds a tap but prevents the worst failure (wrongly marking correct work). We keep it.
**Cost notes:** ≈ $0.0024 (₦3.6) per mark with Flash-Lite transcription; ≈ $0.010 (₦15) on Flash at 2027 prices (`09` §4). Getting Flash-Lite through the transcription eval is a P1 goal.

---

## F8 · Exam mode
**Purpose:** When an exam is coming, show what gets asked and practise in that style. **Stage:** MVP (moved up from P2 by Q38): extraction, patterns (topic frequency, share of marks, question styles), study plan to the exam date, worked solutions, practice papers (MVP-04). The exam map's "≥ 3 papers" rule applies to the recency-weighted map; with fewer papers, show plain counts.

**FR**
1. Past paper ingestion: photo/PDF → vision extraction to `exam_questions` `{year, number, sub, text_latex, marks, type: calc|theory|definition|proof|diagram}`. The student reviews the extraction (editable table) before saving.
2. Concept classification: Flash-Lite maps each question to a concept, preferring the concepts in the course's outline (top-1 plus confidence; < 0.6 → "Unsure", admin queue). The uploader picks the course for a course-free paper at extraction; papers with no course aren't used for exam maps.
3. **Exam map:** share of marks per concept for a course `(course_id, concept_id)` over the available papers, weighted by recency (weights 1.0, 0.8, 0.6, 0.5 …). Requires ≥ 3 papers, otherwise show "Not enough papers yet (2/3). Add more to the bank."
4. Style templates: cluster similar questions (embedding similarity ≥ 0.85) to find recurring formats. Generate new items "in the style" with verification.
5. **Mock exams:** blueprint = topic distribution × marks × duration from the map; timed; CBT mode (MCQ) and written mode (answers marked via F7 photo or typed).
6. Exam goal feeds the planner (F6) with topic weights.
7. Wording rule: never "likely to appear" or "predicted". Use "asked in 6 of 8 papers" and "carries ~24% of marks".

**AC:** extraction accuracy (question boundaries + marks) ≥ 90% on a 10-paper eval set; the exam map matches a hand-computed map on 3 student-created courses with real papers.
**Edge cases:** papers with "answer any 4 of 6" (store rubric); duplicate papers (hash + text similarity).
**Cost notes:** one-off per paper (~5–8 pages × Flash vision) ≈ $0.02–0.05; shared.

---

## F9 · Course space (timetable, lecture preview and recap)
**Purpose:** Fit Ifiok around the real week and make every lecture count. **Stage:** Grow, learning parts only (preview and recap); no standalone timetable or reminder product (Q40).

**FR**
1. Timetable: per course, entries `{weekday, starts, ends, venue, week_range}`; scheme week ↔ date comes from `course_terms`. Course reps/lecturers can publish the class timetable; students can override privately.
2. **Preview:** 60 minutes before a lecture whose topic is known (outline week ↔ calendar mapping from `course_terms`, editable by enrolled students), push a 5-minute preview task (a short shared micro-lesson: 4–6 blocks + 1 checkpoint).
3. **Recap:** 2 hours after the lecture, push 3 recap questions from the topic pool.
4. Rep broadcasts: course reps can post announcements (text, ≤ 500 chars) to the course; rate-limited to 5/day.
5. P3: **"Show me this" reader**: highlight text in an uploaded handout → "Show me this" → tutor builds a small Lesson DSL explanation for that paragraph.

**AC:** preview/recap notifications fire within ±5 minutes; no notifications between 22:00 and 07:00 local unless the user opts in.

---

## F10 · Study groups
> **Deferred (owner decision, `12` §4 Q40):** general group chat is a library/workspace app's lane. Peer help happens through tutoring (F17) and explainers (F18).

**FR:** auto course group plus private groups (≤ 50 members); threads of question → answers; the asker accepts an answer; Ifiok checks answers (Flash-Lite with course sources) and labels them "Ifiok agrees / has a concern / unsure", with reasons; accepted answers earn Units (F13) and usage points if reused; report and moderation; Supabase Realtime for live updates (falls back to polling).
**AC:** toxicity filter blocks slurs/harassment before posting; posts load in < 1 s for 50 items.

---

## F11 · Contribution pool (shared library of verified student materials)
**Purpose:** Students and lecturers upload notes, past questions, lab manuals and worked solutions so the AI learns each concept better for everyone: grounding for the tutor, sources and citations for lessons, real question styles for practice and exam maps. Contributors are rewarded when their material helps others. **Stage:** MVP (MVP-06, Q42): a student can share their own materials to the contribution pool, where automatic checks approve or hold them and usage is recorded as points and Units; Earn (E-01) adds curators, takedowns and cash shares.

**FR**
1. Upload kinds: `notes` (students: **your own notes only**, not lecturer handouts), `past_paper`, `lab_manual`, `solution` (worked solutions). **Not allowed:** published textbooks or copyrighted books (attestation checkbox plus detection).
   - **Past papers** are used for their extracted questions and statistics only (exam map, item style). The file itself is never shown to other students.
   - Uploads start as private sources; `submit_to_bank(source_id)` (server) moves them into curation. Clients can never set `review`, `visibility` or the lecturer flag (`03` §8).
2. Pipeline (`curate` queue job): file type/size check (PDF/JPG/PNG, ≤ 20 MB) → text extraction/OCR → checks: readable (OCR confidence), on-topic and **concept tagging** (classifier maps pages to concepts, using the course outline when the upload came from a course), duplicate (SHA-256 + MinHash/embedding similarity ≥ 0.92 against existing), copyright signals (ISBN, publisher names, "All rights reserved", match against a list of known textbook titles) → decision: `approved`, `needs_review` or `rejected` (with a reason shown to the uploader).
3. Approved uploads are tagged with concepts (and course and year when known). They become **crowd sources** for every student learning those concepts at any university (lessons, refreshes, tutor answers, items, exam maps); lecturer handouts can be kept course-only. From P2 the uploader earns Units (F13).
4. **Usage points:** see `06` §4. Shown to the contributor on their "My contributions" page.
5. Licence: the uploader grants Ifiok a non-exclusive licence to use and display the material and derived lessons; they can withdraw an item (future use stops; existing derived lessons stay, minus direct quotes).
6. Takedown flow for rights holders (form → item hidden within 24 h → review).

**AC:** duplicate detection catches ≥ 95% of re-uploads of the same paper (photo vs PDF) in tests; rejected uploads always give a reason.
**Trade-offs:** automatic approval speeds growth; `needs_review` catches risky items. Crowd uploads start in P1 (P1-03b) with a manual review of everything for the first 2 weeks to calibrate thresholds.

---

## F12 · Lecturers
> **Deferred (owner decision, `12` §4 Q39):** Ifiok serves students only for now. Nothing below is built until this note is removed. Course reps (not lecturers) lock outlines in the meantime.

**Purpose:** Lecturers share once and reach every student; they gain tools, insight, recognition and earnings. **Phase:** P2 (notes, insight), P3 (recordings).

**FR**
1. Verification: staff email domain (configurable per university, e.g. `@uniuyo.edu.ng`) + email code → `lecturer_pending`; admin approves after a quick check (department page or ID photo, deleted after verification).
2. Lecturer can: claim courses they teach (admin approves), upload notes/slides (crowd or course-only), confirm and lock the course outline and timetable, and act as a curator for their subject (fix lessons; trust rules in F2-FR5). Lecturers are welcome contributors, never gatekeepers: students never need a lecturer for Ifiok to work.
3. **Class insight** (aggregate only): mastery distribution for each concept in the course's outline, among students enrolled in that course, most common error tags, checkpoint miss rates. **k-anonymity:** hide any statistic computed from fewer than 5 students.
4. Earnings: from P2, lecturers whose materials are used are paid under a **direct content licence** (a simple signed agreement, paid monthly by bank transfer from Ifiok, `06` §3). When the automated contributor pool is switched on, lecturer usage points count at 2× weight.
5. Rule: a lecturer's own enrolled students always get that lecturer's material free. Lecturers cannot sell to their own class.
6. P3 recordings: lecturer-only microphone; explicit consent screen; a class notice template; transcription via Whisper (Groq); the lecturer reviews the transcript before it is used; raw audio deleted after 7 days.

**AC:** no student-level data is visible to lecturers (RLS test); statistics with n < 5 render as "Not enough data".

---

## F13 · Rewards and Units wallet
**Purpose:** Steady learners use Ifiok free; heavy users pay small amounts; contributors earn cash. **Stage:** Earn (E-03, E-06). Full rules in `06`.

**FR (summary)**
1. Wallet screen: Units balance (purchased + earned, earned shown with expiry), Earnings balance (₦, pending vs available), history.
2. Top-up via Paystack: bundles ₦500 / ₦1,000 / ₦2,000. Webhook-confirmed only.
3. Earn Units (full rules in `06` §2): a concept reaches Mastered (+3, once per concept, max 10 a month), 7-day streak (+5), approved upload (+5), usage of your uploads by others (+1 per qualified consumer per month), accepted group answer (+2, P3). Cap: 40 earned Units per month. Earned Units expire after 90 days.
4. Spend Units: extra tutor messages (1), extra snap-and-mark (3), private lesson (21, set from measured cost), extra mock exam (5). Units are reserved before the AI call and refunded if it fails.
5. Cash earnings (when `app_config.cash_pool_enabled`): monthly pool split by usage points; withdraw ≥ ₦2,000 via Paystack Transfer after a 30-day hold; or convert to Units at +20%. Off at P2 launch; switched on by rule (`06` §3).

**AC:** see `06` §9 (ledger invariants tested; webhook idempotent; no negative balances).

---

## F14 · Access and low-data
**Stage:** basics at Launch (L-05: PWA, pinned topics, offline sync); full in Grow.
**FR:** installable PWA (Serwist); data-saver mode (no images except essential, system fonts, no 3D auto-load); **pin a topic** for offline (lesson JSON, items, lab code cached); offline attempts queue in IndexedDB; P3: English/Pidgin toggle for explanations; WhatsApp nudges.
**AC:** a pinned lesson and its practice work in airplane mode; Today shows the offline state clearly; attempts sync exactly once.

---

## F15 · Admin and moderation
**Stage:** Launch (L-02), extended in Earn (payout approval, curator and explainer review).
**FR:** admin dashboard (Linear-style density): lessons in `review` and flagged lessons, concept merges and blocked names, course merges, curator approvals, bank review queue, user reports, lecturer verification, payout approval, AI spend dashboard (daily cost by feature, top users), feature flags, kill switches (disable a feature or model instantly).
**AC:** every admin action is audit-logged (`admin_audit`).

---

## F16 · Notifications
**Stage:** Grow (study-plan reminders, preview/recap, email digests).
**FR:** Web Push (VAPID, free); email via Resend free tier (verify the limit at signup); quiet hours 22:00–07:00; max 3 pushes/day; every notification type can be turned off in settings.

---

## F17 · Peer tutoring (paid)
**Purpose:** Students who have mastered a topic earn by teaching it to other students; students who are stuck get a human who has just learned the same course. **Stage:** Earn (E-05; needs a registered business, Paystack live mode, a licensed escrow/payment partner and legal review of the terms). Owner decision `12` §4 Q39.

**Stories**
- I'm stuck on "Thermodynamic cycles" two days before the test. I book Ada, a 300-level student who mastered it on Ifiok, for 45 minutes. I pay ₦X; the money is held until the session ends; afterwards I confirm and she is paid.
- I'm good at circuits. Ifiok invites me to tutor "Kirchhoff's laws" because I reached Mastered there; I set my price and the times I'm free.

**FR**
1. **Who can tutor:** adult, active account ≥ 30 days old; **Mastered** in each concept they offer (from server-written attempts, never self-declared); a verified payout account whose resolved name matches their legal name (`06` §5 rule 7); agreed to the tutor terms. A tutor profile lists concepts, price per session (within a band in `app_config`), availability and their record (sessions completed, ratings, learning gain).
2. **Booking:** the learner picks a concept, a tutor and a time; pays through Paystack into **escrow held by a licensed partner** (Ifiok never holds the funds itself); the booking shows "Paid, held until the session ends".
3. **The session** happens by chat in Ifiok plus a call or meeting the two arrange; Ifiok does not host video (a non-goal). Ifiok gives both a session page: the concept's lesson, a short practice set, and a 3-question check before and after.
4. **Release:** the learner confirms the session happened, or it releases automatically 24 h after the scheduled end if no dispute is opened. Ifiok's commission (`app_config.tutoring_take_rate`, default 15%) is deducted at release.
5. **Disputes and refunds:** tutor no-show → full refund; learner no-show → tutor paid in full; disputes opened within 24 h freeze the release and go to admin review with the booking record (not chat content, guardrail 10).
6. **Learning gain:** the before/after checks give each tutor a "learning gain" score shown on their profile alongside ratings. That is the quality signal no generic marketplace has.
7. **Safety:** 18+ only; in-app chat filtered for harassment and for sharing contact details before a booking is paid; report and block; in-person safety guidance; repeated refunds or disputes suspend tutoring.
8. **Anti-fraud:** a tutor can't book themselves or pay through a linked account; pairs that repeatedly book and refund, or rings of accounts rating each other, are flagged (graph signals as in `06` §5).

**AC:** funds never touch an Ifiok bank account (partner integration test); release happens exactly once per booking (idempotent on the booking id); a tutor without Mastered in a concept cannot list it (test); refunds and auto-release follow the rules above (test).
**Trade-offs:** a human market adds trust and payment risk; escrow and Mastered-only tutors keep it honest. Revisit the take rate after pilot data.

---

## F18 · Student explainers (text, voice, video)
**Purpose:** Students who have mastered a topic teach it once and get paid every time it helps another student; learners get a peer's explanation in the form that works for them. **Stage:** MVP (MVP-06, Q42) for publishing with AI review plus admin approval, captions and usage points; Earn (E-04) for curator review and converting points into Units and cash. Owner decisions `12` §4 Q40, Q41, Q42.

**Stories**
- I finally understood Kirchhoff's laws. I record a 2-minute video on my phone showing how I set up the loop equations; after review it appears under the topic, and I earn when other students finish it.
- I'm on a small data bundle. Ifiok shows me the explainer's transcript and plays the audio only.

**FR**
1. **Who can publish:** an adult, active account with **Mastered** in the concept (server-written evidence); explainer terms accepted (licence as F11-FR5; withdraw any time).
2. **Formats:** written walkthrough (Markdown with inline maths); voice note (≤ 5 min); **short video (≤ 3 min, 480p, ≤ 40 MB)** recorded in the browser or uploaded, compressed on the device before upload. One explainer covers one concept.
3. **Processing:** media goes to object storage behind a CDN (`02` §1); the worker transcribes voice and video with Whisper (Groq) for captions, search and review; a poster frame and duration are recorded.
4. **Review before anyone sees it:** AI review of the text or transcript (on-topic, accurate against the concept, no harassment, sexual content, hate, contact details or personal data) and of sampled video frames (`08` §7b); any number stated is checked by the engine where it can be, otherwise the explainer is labelled "Numbers not checked"; each author's first 3 explainers also need a curator's approval. Reports and the 3-flag hide rule apply.
5. **Playback:** never auto-play; captions on by default; data-saver mode and slow networks show the transcript and the audio track only; a "Load video (≈ N MB)" button shows the size first.
6. **Where explainers appear:** under the topic in the Path, after a wrong answer on that topic ("A student explains this"), and in exam prep for that topic. Shared lessons stay the primary teaching; explainers are optional.
7. **Pay:** usage points when a qualified consumer finishes an explainer (`06` §4, §14), so pay follows real use, from the contribution pool.
8. **Rules:** no faces of other people without their consent; no material copied from textbooks or lecturers' slides; no selling or contact details; 18+ only.

**AC:** no explainer is visible before it passes review (test); every video has captions from its transcript; data-saver never downloads video bytes (Playwright); one usage point per (explainer, consumer, month) (pgTAP); a student without Mastered cannot publish for that concept (test).
**Trade-offs:** video costs data, storage and moderation effort; short limits, on-device compression, transcript-first playback and review-before-publish keep it within the data-light principle.
**Cost notes:** storage and CDN egress for video (`09` §2); one Whisper transcription per explainer (free tier during the pilot).
