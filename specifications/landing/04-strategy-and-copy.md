# Landing page · 04 · Strategy and copy (Learn, Prepare, Contribute, Teach, Earn)

**Owner:** SEO and copy. **For:** the owner, design, engineering. **Date:** 19 Oct 2026.
**Replaces:** the direction in `01-seo-brief.md` and `02-copy-deck.md` (keep them for history; the technical SEO and performance rules in `01` §3–§4 still apply unless this file says otherwise).
**Binding inputs:** CLAUDE.md (guardrails 2, 13, naming, UI rules) · `00` §1, §1b, §3, §6, §8 · `01` F17, F18, F2-FR (sensitive subjects) · `06` §0–§4, §12–§15 · `07` §1, §3.4, §5.11 · `10` Stage 1–3 · `12` §4 Q38–Q46 · `lib/features.ts`.
**Where this file and the spec disagree, the spec wins.** Proposed deviations are listed in §7 for a review-log entry.

**Honesty note on data.** I can't see search volumes. Keyword ranks below come from intent fit, live search results (Oct 2026) and Nigerian search habits; every volume statement is marked *(est.)*. Check them in Google Search Console within 4 weeks of launch.

**State of the repo (read before building).** `12` §4 Q45–Q46 describe a rebuilt landing page (demo islands, `StickyCta.tsx`, `app/robots.ts`, `app/sitemap.ts`, `/sign-in?mode=signup`). None of that is in the working tree on 19 Oct: `app/(marketing)/page.tsx` is the older version (H1 "See it. Try it. Master it.", lecturer FAQ, "pilot open by invitation"), `components/marketing/demos/` and `components/marketing/landing/sections/` are empty, there is no `robots.ts` or `sitemap.ts`, and `app/(auth)/sign-in/page.tsx` does not read a `mode` parameter. This document is written against what is on disk. Engineering dependencies are listed in §4.3.

---

## 1. Competitor teardown

Sources: live fetch on 19 Oct 2026 for Edves, AltSchool, Tuteria, Coursera and Kahoot; the owner's full-page screenshots for uLesson, Quizlet and Khan Academy (their fetches returned a 403 or an empty shell). "Not captured" means I couldn't see it; I haven't filled it from memory.

### 1.1 Edves (edves.com)
| Aspect | What they do |
|---|---|
| Sections in order | Hero → "One platform. Global impact." → "Five pillars of classroom excellence" (card grid) → "Choose your country" (US, UK, NG, GH cards) → Higher education tools → "14+ research-driven models" → "Start here" (company profile, buyer's guide, glossary) → "From Lagos to the world" timeline → Awards → "Trusted across four continents" (4 school testimonials) → Contact form |
| Hero formula | Abstract category claim: "Reimagine education with AI pedagogy" + "more than an LMS" + country list |
| CTA pattern | Two hero buttons ("Explore your country", "Discover pedagogy with AI"), then a "Learn more →" on every card; B2B end point: "Request a pilot", contact form. No self-serve sign-up |
| Proof devices | Big stat wall (2,300+ schools, 625K+ students, "+15% attainment", "95% prediction accuracy"), award and funder logos (World Bank, British Council, Seedstars), compliance badges (FERPA, COPPA, GDPR, NDPR), school testimonials, founding timeline |
| Audience split | By country, then by school type, then by role (teacher, leader, parent). The student is never the buyer |
| SEO notes | Title "EDVES Global \| AI-Powered Pedagogy Platform for K-12 Schools Worldwide"; heavy content hub (glossary, buyer's guide) for long-tail; country subdomains |
| Lift | The "Start here" reference hub idea, later (topic pages). The NDPR badge idea: state the law we follow in words |
| Avoid | Abstract hero, stat walls we can't support, five identical pillar cards |

### 1.2 AltSchool Africa (altschoolafrica.com)
| Aspect | What they do |
|---|---|
| Sections in order | Hero → employer logo wall ("Join 200,000+ graduates working at") → "Build and advance professionally" (4 paths: new to tech, switching, upskilling, business) → one section per path → enterprise → stats band → credential types (degree, diploma, masterclass, nano) → schools → licensed degree → featured programmes with enrolment counts → "Find a perfect program" quiz → community → student projects → 20% discount countdown → scholarships → testimonials → blog → news → final cohort CTA |
| Hero formula | Aspiration + identity: "Build the global career you were made for" |
| CTA pattern | "Find your program" hero; one "Explore…" button per audience block; urgency (countdown, "limited spots"); a no-sign-up advisor quiz ("about 3 minutes") |
| Proof devices | Graduate counts (200,000+ and 100,000+ on the same page, which contradict), employer logos, accreditation badge, GSV award, enrolment counts per course, learner testimonials. The stats band rendered "1", "0 %", "0 +" on fetch |
| Audience split | By life stage (beginner, switcher, upskiller, business), each with its own section and CTA |
| SEO notes | Meta: "Build practical skills with AltSchool Africa. Explore online programs in software engineering, data, cybersecurity, product and business. Find your path."; JSON-LD WebPage; blog for long tail |
| Lift | Audience-by-life-stage routing near the top. The short, no-sign-up "find my next move" interaction |
| Avoid | Countdown urgency; contradictory or broken numbers. **This is the clearest lesson: a proof device that's wrong costs more trust than no proof at all** |

### 1.3 Tuteria (v2.tuteria.com)
| Aspect | What they do |
|---|---|
| Sections in order | Nav with "What do you want to learn?" search + advisor contact (phone, WhatsApp, email) → "Africa's most-trusted tutoring company" + popular services grid → parent hero ("Better, brighter future for your kids") → stats band (10k+ tutors, 280k+ lessons, 38k+ students) → "We do home tutoring the right way" → "We deliver the best results, period" (3x better) → 5-step approach → parent testimonials → admissions and travel → test prep (JAMB, WAEC, IELTS…) → music and languages → **"Become a tutor and earn money teaching what you love"** → advisor contact again → company description → footer |
| Hero formula | Outcome for a third party (the parent's child) |
| CTA pattern | "Get started" on every card (dozens), "Learn how it works", "Apply to teach", "Request a call", WhatsApp link |
| Proof devices | Big counts, "3x better", "95% exam success", named schools and a JAMB score, many testimonials from Lagos, Abuja, Uyo |
| Audience split | Parents (main), students/adults (test prep, languages), tutors (one recruitment block near the end) |
| SEO notes | Title "Tuteria: Affordable Online & In-Person Lessons From Africa's Best Tutors"; one page tries to rank for every exam |
| Lift | Search-first entry ("What do you want to learn?"), which Ifiok already has in the app. WhatsApp as a channel. The tutor-recruitment block proves "teach and earn" is a known, wanted job in Nigeria |
| Avoid | "Earn money teaching" with no numbers; outcome percentages without method; card soup |

### 1.4 uLesson (ulesson.com)
| Aspect | What they do |
|---|---|
| Sections in order | Segment toggle at the very top ("For students" / "For teachers and schools") → "For home. For school. Across every grade" with two price cards (student app **₦25,000/year**, classroom product with a sales phone number) → "Download the learning app" (store badges, photo collage) → "Dive into our vast video library, quizzes and exams" (carousel) → Classboard for teachers → "Everything you need to excel" (video library, mock exams, tests and quizzes, learning reports) → "No one is left behind!" → star-rated testimonials → **"Refer and earn up to ₦10,000"** → "Government + uLesson = societal transformation" → "Schools that trust us" (crests) → contact phones → footer with NDPR audit badge |
| Hero formula | Audience coverage ("every grade") + price |
| CTA pattern | "Buy now" on the price card, store badges, "Learn more", "Contact us", phone numbers |
| Proof devices | Price upfront in naira, school crests, government partnership, star ratings, certification badges |
| Audience split | A hard toggle: students vs teachers and schools |
| SEO notes | Title "uLesson \| No. 1 Learning App for Primary, Junior Secondary & Senior Secondary school Students"; client-rendered (fetch saw only the title), which hurts crawling |
| Lift | Naira price shown early and plainly. A concrete earning line with a number (their referral cap) |
| Avoid | Self-declared "No. 1"; content invisible to crawlers; video-heavy positioning (we're data-light) |

### 1.5 Quizlet (quizlet.com)
| Aspect | What they do |
|---|---|
| Sections in order | Hero "How do you want to study?" → tool carousel (Record lecture, Study guides, Flashcards, Games) → **"Start strong: Any input. Instant study materials."** → **"Stay on track: Small habits. Big results."** → **"Finish strong: Your material. Zero surprises."** → Teachers block ("Empower your students") → big footer of SEO links (for students, for teachers, subjects, countries) |
| Hero formula | A question to the student + "discover, create and master your study material" |
| CTA pattern | "Sign up for free" (hero, and repeated in the journey blocks), "I'm a teacher" as a quiet text link, "Log in" top right, "Stay on track" |
| Proof devices | Product screens only; COPPA badge in the footer. No stats, no testimonials on this page |
| Audience split | Students first; teachers get one quiet link in the hero and one block at the end |
| SEO notes | Title and meta not captured (403). Footer link farm feeds tool and subject pages; the SEO weight is in millions of public study sets, not the home page |
| Lift | **The journey framing (start strong → stay on track → finish strong)**, which matches Learn → Prepare → … ; product screens as the proof; the secondary audience as a quiet text link, not a second hero button; "Your material" as the promise |
| Avoid | All-caps eyebrows ("START STRONG"), two-beat slogans ("Small habits. Big results."), stock photos of students |

### 1.6 Coursera (coursera.org)
| Aspect | What they do |
|---|---|
| Sections in order | Hero "Learn without limits" → promos (AI data analytics, Google AI Pro offer) → "Start, switch, or advance your career" → new and popular → "Learn from 350+ leading universities and companies" (logos) → AI series → three entry cards (career, business, degree) → categories → trending searches → Coursera Plus trial → "What brings you to Coursera today?" goal picker → job-ready certificates → "91% of learners achieved a positive career outcome" → 4 testimonials → **FAQ (7 questions)** → SEO footer |
| Hero formula | Abstract promise, then immediate catalogue |
| CTA pattern | "Join for free" and "Log in" side by side in the header on every screen; "Get started", "Explore programs", "Start 7-day free trial" |
| Proof devices | Partner logos (Google, IBM, Stanford…), one outcome stat with a methodology link, named testimonials |
| Audience split | By goal ("start my career", "change my career", "grow in my role", "explore"), plus Individuals/Businesses/Universities/Governments in the header |
| SEO notes | Title "Coursera \| Online Courses, Certificates, & Degrees" (category keywords after the brand); FAQ written as real queries ("Is a Coursera certificate worth it?", "Does Coursera offer free online courses?") |
| Lift | **"Join for free" + "Log in" both visible in the header**; FAQ phrased as the searcher's own question; one outcome stat *with* a method link (we'll do the same once we have real data, not before) |
| Avoid | Promo stacking; catalogue-first layout (we have no catalogue by design) |

### 1.7 Kahoot! (kahoot.com)
| Aspect | What they do |
|---|---|
| Sections in order | Hero "Make learning awesome!" → logo strip → "Kahoot! for every occasion" (work, school, home tiles) → four product cards with prices → "Why millions choose Kahoot!" (3 value props) → "Ready to make learning awesome?" → settings modal |
| Hero formula | Brand slogan with an exclamation mark |
| CTA pattern | "Get started for FREE!", "Sign up FREE", "Start for FREE" (three wordings for one action), "Log in", "No credit card needed" |
| Proof devices | "Loved by billions", logos, Microsoft/Google partner badges, "from $3/mo." prices, a sale deadline |
| Audience split | Work, school, home |
| SEO notes | Title "Kahoot! \| Learning games \| Make learning awesome!"; thin home page, no FAQ |
| Lift | "No credit card needed" style reassurance right under the button (ours: "Free. 18 and over.") |
| Avoid | Shouty caps, vague "millions", inconsistent button wording |

### 1.8 Khan Academy (khanacademy.org)
| Aspect | What they do |
|---|---|
| Sections in order | Donation banner → "Turn big learning goals into real results" with a **role picker** (Student / Family / Teacher) and "Already have an account? Log in" → stats band (180M+ users, 63B+ minutes, Free, 15+ years) → course chips → "Real progress starts with how students learn" → **"Every skill counts"** (skills mastered → percentage points gained) → Teachers / Students / Families tabs → stories (video + 3 quotes) → "Built for learning. Not for profit." → **FAQ** ("Is Khan Academy really free?", "Does it actually improve learning outcomes?") → "Strengthen every classroom" CTA |
| Hero formula | Outcome promise + "who are you?" picker instead of buttons |
| CTA pattern | Role picker rows as the primary choice; "Log in" text link under it; "Sign up" top right; "Get started" at the end |
| Proof devices | Large usage numbers, research-style claim ("10 skills mastered ≈ +5 percentage points"), stories, nonprofit status |
| Audience split | Student, family, teacher (picker and tabs) |
| SEO notes | Title and meta not captured. Course chips are internal links into a huge public content tree, which is where its search traffic comes from |
| Lift | **Mastery as the visible unit of progress** (we use the same ladder, `07` §2); "Already have an account? Log in" right under the picker; the FAQ question "Is it really free?" |
| Avoid | Mascot illustrations and sparkle shapes (banned for us, `07` §3.4) |

### 1.9 The shared industry pattern
1. **Hero → proof strip → audience routing → features → testimonials → final CTA → link-farm footer.** Eight of eight put a proof device (numbers, logos, crests) within the first two screens.
2. **Proof = scale.** Counts of users, schools, tutors, minutes; partner logos; star ratings. Nigerian sites lean on government ties, named schools and phone/WhatsApp contact.
3. **Audience routing by role** (student / teacher / parent / business) or by life stage (AltSchool, Coursera). Students are rarely the buyer on the Nigerian sites.
4. **Free sign-up + log in together** in the header (Coursera, Kahoot, Khan, Quizlet). The best ones put "Already have an account? Log in" right under the main action.
5. **Earning appears only as recruitment** (Tuteria "Become a tutor", uLesson "Refer and earn up to ₦10,000"), never as part of the learning journey and never with the rules.
6. **FAQ** only on the two global leaders (Coursera, Khan), phrased as the searcher's own words.
7. **Screenshots or photos, never a working product** on the page.

### 1.10 Gaps Ifiok can own
| Gap | Who leaves it open | Ifiok's move |
|---|---|---|
| **Nigerian undergraduates studying their own course** | uLesson and Tuteria serve K-12, JAMB and WAEC; AltSchool sells careers; Edves sells to schools; Coursera has a fixed catalogue | "Any topic in your course, at your university." No catalogue, so we never say "we don't have your course" |
| **Try it before sign-up** | All eight show screenshots | The hero is a working mini-lesson (`components/marketing/TangentHero.tsx`): the visitor drags a point and sees the slope change before reading a word of marketing |
| **Proof you can check instead of proof you must trust** | Everyone uses counts and logos; AltSchool's broken stats show the risk | "Every number is computed by a maths engine; lessons that fail the check are never shown"; public code; a plain "Open now / Building now" list. We have no counts yet, and the page says so by showing what works |
| **The full student journey in one place, ending in income** | Learning sites stop at "pass"; tutoring sites start at "earn" | Learn → Prepare → Contribute → Teach → Earn, each step unlocking the next (you teach what you've Mastered) |
| **Earning rules written down** | Tuteria and uLesson give no rules or only a cap | Rates, formula, caps, holds and "what isn't live yet" on the page, labelled "Launch rates, may change" |
| **Light on data, built for Android browsers** | uLesson is video-first; most push app installs | "Runs in your phone's browser. Lessons are small data files, not video." |
| **Exam prep without fortune-telling** | The Nigerian past-question market sells "likely questions" | "What your past papers asked, topic by topic", counts only (guardrail 13) |

---

## 2. Audience and jobs

Most visitors arrive on a phone from a WhatsApp link (a course rep, a classmate, a group), a smaller share from Google, and during the hackathon a group of judges from Devpost or GitHub.

| Visitor | Arrives from | First 10 seconds: what they're asking | What answers it | The one action |
|---|---|---|---|---|
| **New student (100–200 level)**, a new course, a scary topic | WhatsApp link, "<topic> explained" search | "Will this help me understand *my* course, and is it free?" | H1 + hero line + the draggable demo + "Free. 18 and over." | Start learning free |
| **Finalist or anyone before exams**, weeks out | "how to use past questions", "<course> past questions" | "Can this get me ready for *this* exam in the time I have?" | Journey row 2 (Prepare) with its status, and the Prepare section | Start learning free (and, while exam prep is building, start the course now so the Path is ready) |
| **Strong student who wants to earn** | "make money as a student in Nigeria", a friend's share | "How exactly do I get paid, how much, and is it real?" | Journey rows 3–5, the Earn section's rate table, "Cash payouts open after launch" | Start learning free (you earn from topics you've Mastered, so it starts with learning) |
| **Course rep** | Classmates, WhatsApp | "Can I bring the whole class into one course?" | Learn section line on shared courses and outlines; FAQ "Does it have my course?" | Start learning free, then create the course |
| **Returning student** | Bookmark, Google "Ifiok" | "Where do I sign in?" | Header "Sign in" on every width; "Already have an account? Sign in" under each primary button | Sign in |
| **Judge or developer** (to 12 Nov) | Devpost, GitHub | "Does it work, is PayPal real, is the AI used well?" | Trust section, public code link, the judges' FAQ group (flagged) | Sign in with the judge test account (from the README) |

**Decision:** one primary action for everyone: **Start learning free**. Earning is reached through learning (tutoring and explainers need Mastered, `06` §13–§14, `01` F17-FR1), so the earner's CTA is the same button with a different reason next to it.

---

## 3. SEO plan

### 3.1 Keywords

Volumes are *(est.)*: Nigeria is a Google-and-Android market where student queries usually carry a course code, "pdf" or "past questions and answers", and Pidgin rarely appears in typed searches.

**Primary (the home page competes for these)**
| # | Phrase and variants | Intent | Why we can win | Where |
|---|---|---|---|---|
| K1 | AI study app Nigeria · AI learning app for university students · AI tutor for Nigerian students | Choosing a tool | Results are global listicles and new local exam apps (Class54, Acedly, ExamPadi) aimed at JAMB/WAEC; few target undergraduates by course *(est.: low-to-medium volume, rising)* | Title, meta, hero paragraph |
| K2 | Ifiok · Ifiok AI · Ifiok meaning | Brand | Ours to own; "meaning" queries come from Ibibio/Efik speakers | Title, footer, Organization schema |
| K3 | interactive lessons · learn <topic> step by step · understand <topic> | Learning | Long tail; home page carries the pattern, topic pages (later) carry the volume | Learn H2 and items |
| K4 | how to use past questions · study plan for exams · exam timetable study plan | Exam prep, the step after downloading | The head term "past questions" is download intent (PDF sites); the "how to" step is less contested *(est.)* | Prepare H2, FAQ |
| K5 | make money as a student in Nigeria · get paid for your notes · become a tutor in Nigeria | Earning | High interest, mostly blog listicles; we can answer with real rules *(est.: medium volume, mixed intent)* | Earn H2, Teach, FAQ |

**Secondary (H3s, captions, FAQ; never stuffed)**
- Learn: "<course code> explained" (MTH 101, PHY 101, CHM 101 as examples only, never as a list we cover), "virtual lab", "physics practical online", "simple pendulum experiment", "lab report", "mastery".
- Prepare: "CBT practice" (common for GST/GNS papers *(est.)*), "timed practice paper", "worked solutions", "mock exam".
- Contribute: "share past questions", "upload lecture notes".
- Teach: "student tutor", "peer tutoring", "teach what you know".
- Trust: "is AI accurate for maths", "open source education app" (only once a licence exists).

**Not targeted on the home page:** "<course code> past questions pdf" (we never serve past papers as files, `10` MVP-04; visitors with download intent bounce), "predicted questions" (guardrail 13), "JAMB/WAEC" (under-18 audience, `00` §3).
**Later, separate decision:** public topic pages built from shared lessons are where K3 volume lives. Needs a spec decision (see §7, Q4).

### 3.2 Title, meta, H1
- **Title (≤ 60):** `Ifiok · AI learning agent for Nigerian university students` (59). Keep `Ifiok · the AI learning agent` as `title.default` for other pages.
- **Meta description (≤ 155), today:** `Interactive lessons for any topic in your course, built for Nigerian university students. Exam prep and ways to earn are coming next. Free, 18+.` (144)
- **Meta description, once `upload` + `examPrep` are open:** `Turn your course outline, notes and past questions into lessons you can move, exam prep and a study plan. Free for Nigerian university students, 18+.` (149)
- **H1:** `Learn any topic in your course with lessons you can move` (one H1; the category and audience go in the first sentence under it, so H1 + paragraph carry K1).

### 3.3 Headings and anchors
| Section | id | H2 |
|---|---|---|
| Hero | `#top` | (H1 above) |
| Journey | `#journey` | From your first lesson to getting paid for what you know |
| Learn | `#learn` | Learn: lessons you can move, for any topic |
| Prepare | `#prepare` | Prepare: get ready for your exam with your past questions |
| Contribute | `#contribute` | Contribute: share notes that help every student on the topic |
| Teach | `#teach` | Teach: explain topics you've Mastered, and tutor them |
| Earn | `#earn` | Earn: how Ifiok pays students |
| Trust | `#trust` | Every number is computed, not guessed |
| Pricing | `#pricing` | Free to learn. Plus for ₦500 a month. *(the only two-part H2; it's a price statement, not an aphorism)* |
| FAQ | `#faq` | Questions students ask |
| Final CTA | `#start` | Start with one topic tonight |

Rules: one H1; H2 per section; H3 per item; FAQ questions are `<summary>` text, not headings; sentence case; no phrase repeated in more than two headings. Header anchor links: Learn · Exam prep · Earn · Pricing (four; Contribute and Teach are reached from the journey list).

### 3.4 Links
- **Start learning free** → `/sign-in?mode=signup` (needs the sign-in page to open on Create account when `mode=signup`; until that lands, `/sign-in`). **Sign in** → `/sign-in`.
- `/ai` from the trust section ("Read how Ifiok uses AI"), `/privacy` from the textbook line and FAQ, `/terms` from Earn ("Read our terms") and the footer.
- GitHub `https://github.com/yhtiee/Ifiok-AI-Agent` from Trust and the footer, **only once the repository is public** (OWN-H7). Anchor text says where it goes.

### 3.5 FAQ questions that target real queries
Grouped and written in §5.10. They target: "what is Ifiok", "is Ifiok free", "does it have my course", "how to use past questions to prepare for exams", "does it predict exam questions", "can AI be wrong in maths", "virtual lab and lab report", "how to make money as a student in Nigeria", "when do payouts start", "how is my share calculated", "can I share notes I didn't write", "is my textbook uploaded", "who can tutor", "does it use a lot of data", "why 18+", "is it a solve-it-for-me app", "what works today", and four for judges.

### 3.6 JSON-LD (one `@graph`, built from the same constants the page renders)
- `Organization` (name, url, logo `apple-icon.png`, description with the name's meaning, `sameAs` GitHub only once public).
- `WebSite` (`inLanguage: en-NG`, `alternateName: ["Ifiok AI"]`).
- `WebApplication` (`applicationCategory: EducationalApplication`, `operatingSystem: "Any web browser"`, `isAccessibleForFree: true`, `audience: EducationalAudience` "Nigerian university students aged 18 and over", `featureList` generated **only from open flags**, `offers`: Free (`price 0`, NGN, `InStock`) and Plus monthly/semester **without `availability`** until billing is live).
- `FAQPage` with answers word for word as shown (no rich result expected; Google limits FAQ rich results, but it helps machines read the page).
- **Never** `aggregateRating`, `review`, or user counts. Add `SoftwareSourceCode` only once a `LICENSE` exists.
- Escape with `.replace(/</g, "\\u003c")` per `node_modules/next/dist/docs/01-app/02-guides/json-ld.md`.

### 3.7 Share title and text (WhatsApp first)
- `og:title`: `Ifiok · the AI learning agent for students`
- `og:description` (≤ ~110 so WhatsApp doesn't cut it *(est.)*): `Lessons you can move for any topic in your course. Free for Nigerian university students, 18+.` (94)
- `og:locale en_NG`, `twitter:card summary_large_image`, keep the generated `opengraph-image.tsx` (aim < 300 KB).
- **Suggested share text** (for a future "Share Ifiok" button and course reps): `I'm learning PHY 101 on Ifiok. You drag the graph and it shows you why. It's free: {SITE}` *(the course code is filled from the sharer's course; never a fixed list)*.

### 3.8 Technical carry-overs (from `01` §3–§4, still required)
Static `/` (no cookies, headers or Supabase); server components with ≤ 10 KB gz client islands (tangent demo, sticky bar, optional points calculator); `app/robots.ts` and `app/sitemap.ts`; `/sign-in` `noindex, follow`; `NEXT_PUBLIC_SITE_URL` required for production canonicals; KaTeX CSS out of the root layout; no third-party scripts; LCP = the H1 text.

---

## 4. Page flow

### 4.1 Section order (11 sections + header and footer)

| # | Section | Visitor question it answers | Funnel job | Proof it carries | CTA | When a flag flips |
|---|---|---|---|---|---|---|
| 0 | Header | "Whose page is this, where do I sign in?" | Orientation, return path | Wordmark | **Sign in** (text link, every width). Desktop also shows a secondary outline "Start free" | None |
| 1 | Hero `#top` | "What is it, is it for me, what does it cost?" | Hook and first try | **The working tangent mini-lesson** (no sign-up) | **Start learning free** (primary); "Already have an account? Sign in" under it | Hero paragraph switches to the upload version when `upload` opens |
| 2 | Journey `#journey` | "What can I actually do here, and what's ready?" | Self-select; honesty about status | Five rows with live status badges from `lib/features.ts` | Each row links to its section (text links) | Each row's badge and line change per flag |
| 3 | Learn `#learn` | "Will it help me understand my course?" | Core value | Hero demo already proved it; a real Path/lesson screen (once it exists), labelled | Sticky bar takes over as primary | Items move from "Building now" to normal copy as `upload`, `path`, `practice`, `weakAreas`, `labs` open |
| 4 | Prepare `#prepare` | "Can it get me ready for my exam?" | Second job, high-intent visitors | Example topic-share row labelled "Example" | Sticky bar | Whole section switches from preview to normal copy when `examPrep` opens |
| 5 | Contribute `#contribute` | "Can my notes help others, and are they safe?" | Turns learners into suppliers | The checks list (privacy, copyright, duplicates) | Sticky bar | Switches when `share` opens |
| 6 | Teach `#teach` | "Can I teach what I'm good at?" | Builds the earner story | Eligibility rules (Mastered only) | Sticky bar | Explainers when `explainers` opens; tutor profiles when `tutorProfiles` opens; bookings line when `sandboxPayments` (test) or `tutoringBookings` (real) opens |
| 7 | Earn `#earn` | "How much, how, and when?" | Converts the earner; protects trust | Rate table, formula, caps, holds, a points-only worked example | "Read our terms" link | "Points recorded" lines when `earnings` opens; sandbox line when `sandboxPayments` opens; cash lines only when `cashPayouts` opens |
| 8 | Trust `#trust` | "Can I trust an AI with maths and my notes?" | Objection handling | Maths-engine rule, citations, flags, on-device PDFs, sensitive-subject review, public code | "Read how Ifiok uses AI" link | GitHub line appears when the repo is public; licence named when `LICENSE` exists |
| 9 | Pricing `#pricing` | "What will it cost me later?" | Removes the price fear | Plain table with naira | None (sticky bar) | "Billing opens with payments" → real billing copy when `plusBilling` opens |
| 10 | FAQ `#faq` | Everything left | Objection sweep, SEO | Answers that match the spec | None | Answers have flag variants (§5.10) |
| 11 | Final CTA `#start` | "OK, where do I start?" | Close | One sentence of reason | **Start learning free** (primary); "Already have an account? Sign in" | None |
| — | Footer | "Who's behind this, legal?" | Trust, links | Name meaning, AI disclaimer | Sign in · Create account text links | GitHub link when public |

**One primary action per screen:** hero button → (scrolled out of view) the sticky mobile bar → hidden when the final CTA is on screen. On desktop there's no sticky bar; the header's outline "Start free" is the persistent secondary, and sections 3–10 carry no camwood button.

### 4.2 Flags the page reads

`lib/features.ts` today has `course`, `topic`, `outline` (open) and `upload`, `textbook`, `goal`, `tutor`, `labs`, `snap`, `library` (closed). The page needs these (engineering adds the missing keys; each ticket flips its own):

| Flag | Today | Opens with | Status badge while closed |
|---|---|---|---|
| `course`, `topic`, `outline` | open | P1-01 | — |
| `sharedLessons` *(new; or treat as always open)* | open | P1-02 | — |
| `upload` | closed | MVP-01 | Building now |
| `privateLessons` *(new)* | closed | MVP-02 | Building now |
| `path` *(new)* | closed | MVP-02 | Building now |
| `practice` *(new: items + mastery)* | closed | MVP-02/03 | Building now |
| `weakAreas` *(new)* | closed | MVP-03 | Building now |
| `examPrep` *(new)* | closed | MVP-04 | Building now |
| `labs` | closed | MVP-05 | Building now |
| `share` *(new, or reuse `library`)* | closed | MVP-06 | Building now |
| `explainers` *(new)* | closed | MVP-06 | Building now |
| `earnings` *(new: points and Units recorded)* | closed | MVP-06 | Building now |
| `tutorProfiles` *(new)* | closed | MVP-06 | Building now |
| `sandboxPayments` *(new, hackathon only)* | closed | MVP-07 | (hidden) |
| `tutor` (grounded "Ask about this") | closed | MVP stretch / Stage 4 | Coming later |
| `curating` *(new)* | closed | E-02 | After launch |
| `plusBilling` *(new)* | closed | E-03 | After launch |
| `tutoringBookings` *(new, real money)* | closed | E-05 | After launch |
| `cashPayouts` *(new)* | closed | E-06 | After launch |

**Badge vocabulary (sentence case, text plus a shape, never colour alone):**
- `Open now` (filled `--built` dot + text)
- `Building now` (open camwood ring + text) for Stage 1 tickets
- `After launch` (open `--ink-3` ring + text) for Stage 3 money features
- `Test run · PayPal sandbox` (outlined, `--ink-2`) only while `sandboxPayments` is on

Do not print dates next to badges; the schedule is internal (`10`) and a missed date on a public page costs trust.

### 4.3 Engineering dependencies (not copy, but the copy relies on them)
1. `/sign-in?mode=signup` opens the form on Create account (the page ignores `mode` today). Until then both CTAs go to `/sign-in` and the sign-in form must show "Create account" clearly.
2. The flags in §4.2.
3. A real Path/lesson screenshot for Learn once MVP-02 ships; until then the hero demo is the only product visual.
4. `robots.ts`, `sitemap.ts`, JSON-LD from shared constants.

---

## 5. Full copy deck

Notation: **H2** / **H3** are heading levels; `[Button]` is a styled link; `→` is the target; **⚑ flag** marks a line that depends on a flag, with **Open:** and **Not open:** variants. Lines without ⚑ are true today. Numbers in examples carry the word "Example".

### 5.0 Header
- Wordmark `ifiok` · descriptor (≥ 640 px): the AI learning agent · screen-reader label: Ifiok, back to top
- Anchor links (≥ 768 px): Learn → `#learn` · Exam prep → `#prepare` · Earn → `#earn` · Pricing → `#pricing`
- Text link, every width: **Sign in** → `/sign-in`
- Desktop only, outline (not camwood): [Start free] → `/sign-in?mode=signup`
- Nav landmark label: Page sections

### 5.1 Hero (`#top`)
**H1:** Learn any topic in your course with lessons you can move

**Paragraph ⚑ `upload`**
- **Not open:** Ifiok is the AI learning agent for Nigerian university students. Find or create your course, add the outline, and open a lesson for any topic: drag the graph, answer the question, see why. Exam prep, virtual labs and ways to earn from what you know are being built now.
- **Open:** Ifiok is the AI learning agent for Nigerian university students. Add your course outline and notes, or just type a topic, and get a Path of lessons you can move, built from your own material.

[Start learning free] → `/sign-in?mode=signup` *(primary, camwood)*
Under the button: Free. For university students 18 and over. · Already have an account? **Sign in** → `/sign-in`

**Demo (TangentHero, keep):**
- Label above: Try it: drag the point
- Caption: The steepness of y = x² at the point you choose. Drag it, or use the slider.
- Live readout (computed in code): At x = {x}, the slope is {2x}.
- Text summary (screen readers and no-JS): A curve y = x² with a tangent line at a draggable point. The slope at the point equals 2x.
- Footnote under the demo: This is one screen of a real Ifiok lesson.

### 5.2 Journey (`#journey`)
**H2:** From your first lesson to getting paid for what you know
**Intro:** Five steps, in the order most students take them. You teach and earn from topics you've Mastered, so it all starts with learning.

*(Five full-width rows on one Ink Line, not cards. Each row: step label, title, who it's for, one line, status badge, link.)*

| Label | H3 | For | Line | Badge | Link |
|---|---|---|---|---|---|
| Step 1 | Learn | Starting a course or stuck on a topic | Lessons you can move for any topic in your course, at any university. | Open now ⚑ *(if `upload`/`path` closed, add second badge: "Your notes and Path: Building now")* | See how lessons work → `#learn` |
| Step 2 | Prepare | Exams coming up | See what your past papers asked, topic by topic, then follow a plan to your exam date. | ⚑ `examPrep` Open now / Building now | See exam prep → `#prepare` |
| Step 3 | Contribute | Good notes or past questions to share | Share them once; after checks, they help every student learning the topic. | ⚑ `share` Open now / Building now | See how sharing works → `#contribute` |
| Step 4 | Teach | Strong in a subject | Explain topics you've Mastered in writing, voice or short video, and tutor them. | ⚑ `explainers` Open now / Building now | See how teaching works → `#teach` |
| Step 5 | Earn | Want income from what you know | Points and Units when your work helps others; cash payouts and tutoring income after launch. | ⚑ `earnings` "Points and Units: Open now" / "Building now" · always: "Cash: After launch" ⚑ `cashPayouts` | See how pay works → `#earn` |

Below the list, one line (true today): **Open now:** find or create your course, add the outline (snap it, type it, or let Ifiok draft one for you to check) and open shared lessons for any topic.

### 5.3 Learn (`#learn`)
**Label:** Step 1 · Learn
**H2:** Learn: lessons you can move, for any topic
**Intro:** Every lesson starts with something to look at or move, one idea per screen. You try first, then see the explanation, with the reason right under your answer.

**H3:** Your course, at your university
Search for your course or create it in under a minute. Add the outline three ways: snap a photo, type the topics, or let Ifiok draft one for you to check against your course. There's no fixed course list, so nothing waits for anyone else to add your course.

**H3:** Built once, then shared with every student
The first student to open a topic waits about a minute while its lesson is built. Every student after that, at any university, opens it at once.

**H3:** Lessons from your own notes ⚑ `upload` + `privateLessons`
- **Open:** Add your lecture notes, textbook pages or course outline. PDFs are read on your phone; you pick the pages and only their text is sent. Lessons built from your notes cite the page, like "From your notes, p. 12", and only you see them.
- **Not open:** *(badge: Building now)* Next: add your lecture notes or textbook pages and get lessons built from them, citing your own pages. PDFs will be read on your phone, and only the pages you pick are sent.

**H3:** A Path through the whole course ⚑ `path`
- **Open:** Your outline becomes a Path: every topic in order, what's ready, and the next one to learn. Each topic shows where you are: Not started, Familiar, Proficient or Mastered.
- **Not open:** *(Building now)* Next: your outline becomes a Path, every topic in order with your level on each: Not started, Familiar, Proficient, Mastered.

**H3:** Practice that finds your weak areas ⚑ `practice` + `weakAreas`
- **Open:** Practice questions for each topic, marked on our server. Weak areas shows what you keep missing, with the evidence, like "2 of 6 right this week", the usual mistake and one next step.
- **Not open:** *(Building now)* Next: practice questions for every topic, and a weak-areas list that shows what you keep missing and what to do about it.

**H3:** Virtual labs for your practicals ⚑ `labs`
- **Open:** Ask for a lab from your manual or by topic, such as the simple pendulum or Ohm's law. Take readings, plot the graph, work out the result, and get a lab report to print or save as PDF. Labs built from a topic say so.
- **Not open:** *(Building now)* Next: virtual labs from your lab manual or a topic. Take readings, plot the graph, work out g or R, and get a lab report.

Caption under any screenshot (once real screens exist): *"A real Ifiok Path for an example course. Topic names are examples."*

### 5.4 Prepare (`#prepare`)
**Label:** Step 2 · Prepare
**H2:** Prepare: get ready for your exam with your past questions
**Badge ⚑ `examPrep`:** Open now / Building now

**Intro ⚑ `examPrep`**
- **Open:** Upload past questions and Ifiok shows what the papers asked, topic by topic, then plans your study to the exam date.
- **Not open:** This is being built now. Here is what it will do, so you can start your course today and have it ready when exam prep opens.

**H3:** What your past papers asked
Each topic shows how often it was asked and its share of the marks across the papers you upload, and the question styles that keep coming back. It counts what was asked. It never says what will be asked.
*Example row (labelled "Example"):* Projectile motion · asked in 3 of 4 papers · about 24% of marks

**H3:** A study plan to your exam date
Set your exam date. Ifiok puts the topics with the most marks and the most mistakes first, and lays out daily sessions of lessons, practice and past questions up to the day.

**H3:** Worked solutions you can follow
Every step shown, with the method. Numbers are computed by the maths engine; anything it couldn't check is labelled "Unchecked".

**H3:** Timed practice papers
Sit a timed paper made from your past questions plus similar questions on your weak topics. Multiple choice and numeric answers are marked for you; for theory, you compare with the worked solution and mark yourself: Got it, Partly or Missed. Your plan updates from the result.

*(Not-open variant: each H3 body ends with nothing extra; the section badge carries the status. Do not use "will" in every sentence; the intro sets the frame once.)*

### 5.5 Contribute (`#contribute`)
**Label:** Step 3 · Contribute
**H2:** Contribute: share notes that help every student on the topic
**Badge ⚑ `share`:** Open now / Building now
**Intro:** Your notes, past questions, lab manuals and worked solutions can make every student's lessons on a topic better. You choose what to share; everything else stays private.

**H3:** What you can share
Notes you wrote, past questions, lab manuals and worked solutions. Published textbooks can never be shared, and textbook pages you add for yourself stay private.

**H3:** What happens before anyone sees it
Ifiok removes names and contact details, checks that it's readable and on the topic, looks for copyright signs and checks for duplicates. Then it's approved, or held with the reason.

**H3:** What other students see
Short, cited snippets inside their lessons, never your whole document. Past questions are used for their questions only and never shown as a file.

**H3:** What you get ⚑ `earnings`
- **Open:** +5 Units when an upload is approved, +1 Unit for each student who learns from it each month, and points toward the contribution pool. See how pay works → `#earn`
- **Not open:** Approved uploads will earn Units and points toward the contribution pool. See how pay works → `#earn`

Link (true today): Read what you can and can't share → `/terms`

### 5.6 Teach (`#teach`)
**Label:** Step 4 · Teach
**H2:** Teach: explain topics you've Mastered, and tutor them
**Intro:** When you reach Mastered on a topic, you can teach it. Mastered comes from your answers, checked on our server; nobody can just claim it.

**H3:** Explainers in your own words ⚑ `explainers` (badge Open now / Building now)
Write a walkthrough, record a voice note up to 5 minutes, or a short video up to 3 minutes. Every explainer is checked before anyone sees it, and voice and video get captions. Videos never play on their own and show their size first, and data-saver gives the transcript and audio instead. You earn a point for each student who finishes it, once per student a month.

**H3:** Tutoring ⚑ `tutorProfiles` / `sandboxPayments` / `tutoringBookings`
Tutor students who book you on topics you've Mastered. To tutor, your account must be at least 30 days old, with Mastered in each topic you offer and a verified payout account in your own name. You set your price within a range and keep 85% of it.
- Status line, `tutorProfiles` closed: Tutoring: Building now. Bookings and payments: After launch.
- Status line, `tutorProfiles` open, bookings closed: Set up your tutor profile now. Bookings open after launch.
- Status line, `sandboxPayments` on: Test run · PayPal sandbox: bookings are being tested with test money. The payment is held at booking and taken only after the session is confirmed. No real money moves.
- Status line, `tutoringBookings` open: The learner's payment is held until the session happens, released when they confirm or 24 hours after, and refunded in full if the tutor doesn't show.

*Example price (labelled):* On a ₦2,000 session you receive ₦1,700 and Ifiok keeps ₦300 (15%). Tutors set their own price.

**H3:** Curating lessons ⚑ `curating` (badge After launch)
Check and fix AI lessons in a subject you know. Curators need Mastered in at least 5 topics of the subject and must pass a short check: find and fix three planted mistakes. ₦1,500 for each accepted review, paid monthly.

### 5.7 Earn (`#earn`)
**Label:** Step 5 · Earn
**H2:** Earn: how Ifiok pays students
**Under the H2 (plain text, not a badge):** Launch rates, may change.
**Intro:** Learning earns Units, which you spend inside Ifiok and can't cash out. Work that other students use earns cash once payouts open. Keeping the two apart means nobody can cash out by grinding lessons.

*(Table; on phones render as stacked rows.)*

| Way to earn | What you get | Paid from | Status |
|---|---|---|---|
| Verified uploads | +5 Units when approved · +1 Unit for each student who learns from it each month · points toward the pool | Contribution pool | ⚑ `earnings`: Points and Units: Open now / Building now · Cash: After launch |
| Explainers | A point for each student who finishes it, once per student a month | Contribution pool | ⚑ `earnings` as above |
| Curating | ₦1,500 per accepted review | Ifiok's budget | After launch |
| Tutoring | 85% of your session price | The learner's payment | ⚑ After launch (or "Test run · PayPal sandbox" while `sandboxPayments` is on) |
| Learning | +3 Units when a topic reaches Mastered (up to 10 topics a month), +5 for a 7-day streak | Units only, never cash | ⚑ `earnings` |

Under the table: Earned Units are capped at 40 a month and last 90 days.

**H3:** How your share of the pool is worked out
1. **A student learns from your work.** They finish a lesson screen that cites your upload, answer a question built from it, or finish your explainer. That's one point.
2. **Points are counted fairly.** One point per student, per item, per month. Your own use never counts. Only active students count: an account at least 3 days old, a verified email and 3 study sessions in the last 14 days.
3. **The pool is set at month end.** 35% of Ifiok's margin for the month (what students paid for what they used, minus payment fees and AI costs). If the margin is zero, the pool is zero, and we say so.
4. **The pool is split by points.** Your share is your points divided by all contributors' points, up to 20% of the pool. Anything above that stays in the pool for next month.
5. **Checks, then a hold.** Unusual patterns are held for review, and the month's top earners are checked by hand. Earnings are held for 30 days, then you can withdraw ₦2,000 or more to an account in your own name.

**Worked example (labelled "Example", points and percentages only):** 30 students learn from your notes this month and 12 finish your voice explainer: 42 points. If all contributors have 1,400 points together, your share is 3% of the pool. Your 2 approved uploads earn 10 Units and the 30 students earn you 30 more: 40 Units, the monthly cap.
*(Optional island: "Work out your points": two steppers, students who used your uploads and students who finished your explainers, and an "all contributors' points" field; output = points, share %, capped at 20%. No naira, Q42.)*

**H3:** When money starts to move
- ⚑ `earnings` **Open:** Points and Units are recorded as you earn them. Earned Units move into your Units balance when it opens.
- ⚑ `earnings` **Not open:** Points and Units start being recorded when sharing and explainers open.
- Always: Cash payouts, curator pay and tutoring bookings open after launch, once payments are set up and the terms have had legal review. Cash shares from the pool start once the pool has reached ₦250,000 a month for two months in a row, so each share is worth withdrawing. Until then, contributors are rewarded in Units.
- ⚑ `sandboxPayments` only: For the PayPal AI Hackathon, the full loop is being tested in PayPal sandbox with test money: pool payouts split by points, and tutoring payments held, then taken or cancelled. No real money moves.

Link: Read our terms → `/terms` *(text: "Read our terms (contributor rules are added before any money moves)" until OWN-H6 lands)*

### 5.8 Trust (`#trust`)
**H2:** Every number is computed, not guessed
**Intro:** AI is good at explaining and bad at arithmetic, so Ifiok doesn't let it do the maths.

*(Four to six full-width rows with a thin rule between them, not a card grid.)*

**H3:** The maths engine has the last word
Every number you see comes from a maths engine, not the AI's memory. A lesson whose maths doesn't check out isn't published, and a practice question whose answer disagrees with the engine is dropped.

**H3:** You can see where it came from
Explanations cite their source. Anything not from a source says so, and marks from AI are labelled estimates.

**H3:** Students can flag a wrong step
Every block in a lesson has a flag. Lessons in medicine, nursing, pharmacy and law are checked by a person before anyone sees them.

**H3:** Your files stay yours ⚑ `upload`
- **Open:** PDFs are read on your phone and only the pages you choose are sent, with names and contact details removed. Lessons from your notes are visible to you alone. Your textbook is never uploaded.
- **Not open:** When uploads open, PDFs will be read on your phone and only the pages you choose sent. Your textbook is never uploaded.

**H3:** Light on your data
Ifiok runs in your phone's browser; there's nothing to install. Lessons are small data files, not video.

**H3:** The code is public ⚑ repo public (OWN-H7)
- **Public, no licence yet:** Ifiok's code is public on GitHub, so anyone can read how lessons are checked, how AI calls are budgeted and how pay is worked out. See the code on GitHub → repo
- **Licence added:** Ifiok is open source under the {licence} licence. See the code on GitHub → repo
- **Not public:** *(omit the row)*

Link under the section: Read how Ifiok uses AI → `/ai`

### 5.9 Pricing (`#pricing`)
**H2:** Free to learn. Plus for ₦500 a month.
**Intro ⚑ `plusBilling`**
- **Not open:** Core learning is free for good. Plus is for students who study heavily from their own notes. Plus opens with payments; until then everything is free.
- **Open:** Core learning is free for good. Plus is for students who study heavily from their own notes.

| | Free | Ifiok Plus | Units for extras |
|---|---|---|---|
| Price | ₦0, for good | ₦500 a month or ₦1,500 a semester | From ₦500 |
| Lessons for any topic, your Path, labs and practice | Included | Included | No |
| Exam patterns and your study plan | Included | Included | No |
| Private lessons from your own notes | A small allowance each month | Unlimited | Extra private lessons |
| Practice papers and mocks | A weekly allowance | Unlimited | Extra mocks |
| Tutor messages ⚑ `tutor` *(closed: "Tutor messages (coming later)")* | A small allowance | More each day | Extra messages |
| Lesson builds | Standard queue | Priority | No |
| Billing | Nothing to pay | ⚑ Opens with payments | ⚑ Opens with payments |

Under the table: Top up from ₦500: ₦500 → 50 Units · ₦1,000 → 105 Units · ₦2,000 → 220 Units. Units you buy never expire. Units pay for extras inside Ifiok; they can't be cashed out or transferred.
Footnotes: Exact allowances are shown in the app and may change. · Units you earn last 90 days. · Prices include any tax that applies.
*(Rows for features that aren't open yet keep "Included": the price commitment stands. "No" is text, not an em dash or a red cross.)*

### 5.10 FAQ (`#faq`)
**H2:** Questions students ask
*(Native `<details>`. Answers ≤ 60 words. JSON-LD uses the visible answer for the current flag state.)*

**What is Ifiok?**
Ifiok is an AI learning agent for Nigerian university students. Pick your course or type a topic and learn it with lessons you can move: drag, try, then see why. Exam prep, virtual labs and ways to earn by sharing and teaching are being added. The name means wisdom and knowledge in Ibibio.
⚑ when `upload`, `examPrep`, `labs` are open, replace the third sentence with: It also turns your past questions into exam prep and your lab manual into a virtual lab.

**Is Ifiok free?**
Yes. Lessons for any topic, your Path, labs, practice, exam patterns and your study plan are free for good. Ifiok Plus (₦500 a month or ₦1,500 a semester) adds unlimited private lessons from your notes, unlimited practice papers and mocks, and priority lesson builds. Plus opens with payments; until then everything is free.

**Does Ifiok have my course and my university?**
Yes, because there's no fixed list. Search for your course at your university; if nobody has added it, create it and add the outline by photo, by typing the topics, or with a draft from Ifiok that you check. Lessons are shared by topic, so many are ready the first time you open them.

**How do I use past questions to prepare for exams on Ifiok?** ⚑ `examPrep`
- **Open:** Upload your past papers and check the question list. Ifiok shows how often each topic was asked and its share of marks, builds a study plan to your exam date, shows worked solutions and gives you timed practice papers.
- **Not open:** Exam prep is being built now. You'll upload past papers, see how often each topic was asked and its share of marks, follow a study plan to your exam date and sit timed practice papers. Start your course now so its topics are ready when it opens.

**Does Ifiok predict exam questions?**
No. Ifiok shows what your past papers asked, such as "asked in 3 of 4 papers, about 24% of marks", and helps you practise in that style. It never says a question will come out.

**Can the AI be wrong? How are the numbers checked?**
Yes, AI can be wrong, so it doesn't do the maths. Every number comes from a maths engine; lessons that fail the check aren't published and practice questions that disagree with it are dropped. Explanations cite their sources, marks are labelled estimates and every block has a flag button.

**Can I do my physics practical and lab report on Ifiok?** ⚑ `labs`
- **Open:** Yes, as a virtual lab. Add your lab manual pages or pick a topic such as the simple pendulum or Ohm's law. Take readings, plot the graph, work out the result, and get a lab report to print or save. Activities that can't be measured honestly are declined, not faked.
- **Not open:** Virtual labs are being built now: from your lab manual or a topic like the simple pendulum, you'll take readings, plot the graph, work out the result and get a lab report. Activities that can't be measured honestly will be declined, not faked.

**How can I make money as a student on Ifiok?**
Four ways: uploads other students learn from, explainers, curating AI lessons and tutoring topics you've Mastered. Uploads and explainers earn points toward a monthly pool and Units. Curators get ₦1,500 per accepted review and tutors keep 85% of their price. These are launch rates; cash payouts, curating and tutoring bookings open after launch.

**When do cash payouts start?**
After launch, once payments are set up and our terms have had legal review. Cash shares from the contribution pool begin when the pool has reached ₦250,000 a month for two months running. Until then contributors are rewarded in Units. Earnings are held 30 days, and the minimum withdrawal is ₦2,000.
⚑ `sandboxPayments`: add "For the PayPal AI Hackathon, payouts are being tested in PayPal sandbox with test money."

**How is my share of the contribution pool worked out?**
Each month, 35% of Ifiok's margin forms the pool. You get one point when a student learns from one of your items, once per student, per item, per month; your own use never counts. Your share is your points divided by all contributors' points, capped at 20% of the pool.

**Can I share notes I didn't write, or past questions?**
Share notes you wrote yourself, not someone else's handout. Past questions are fine: Ifiok uses the questions only and never shows the file. Published textbooks are never accepted. Every upload is checked for copyright signs and duplicates, and a duplicate earns nothing.

**Is my textbook uploaded or shared?**
No. Ifiok reads your PDF on your phone and sends only the text of the pages you choose, with personal details removed. Lessons from your materials are for you alone, and textbook pages can never be shared.
⚑ `upload` closed: prefix with "When uploads open:".

**Who can tutor, and how much do tutors keep?**
Tutors need an account at least 30 days old, Mastered in each topic they offer, and a verified payout account in their own name. They set a price within a range and keep 85% of it. Tutoring bookings open after launch.
⚑ `tutoringBookings` open: replace the last sentence with "The payment is held until the session and refunded in full if the tutor doesn't show."

**Will it use a lot of data? Does it work on my phone?**
Ifiok runs in your phone's browser, so there's nothing to install, and it's built for mid-range Android phones. Lessons are small data files, not video. Student video explainers never play on their own, show their size first, and data-saver gives you the transcript and audio instead.

**Why is Ifiok 18+ only?**
Our AI providers' terms and Nigeria's data protection law set extra rules for under-18s, including a parent's or guardian's consent. Until we can meet them properly, Ifiok is for students 18 and over. If someone under 18 signs up, the account is deleted at once.

**Is Ifiok a "solve it for me" app?**
No. Ifiok teaches: you move the idea, try the question and see why the answer is right or wrong. Worked solutions show every step so you learn the method. It's built to get you to Mastered, not to hand you answers.

**What works today, and what's coming?**
*(Generated from the flags.)* Today: {list of open features in plain words}. Being built now: {list of Building now}. After launch, when payments are set up: Plus billing, Units top-ups, cash payouts, paid curating and tutoring bookings.
*Today's rendering:* Today: find or create your course, add the outline, and open lessons for any topic. Being built now: lessons from your notes, your Path, practice and weak areas, exam prep, virtual labs, sharing, explainers and earnings. After launch, when payments are set up: Plus billing, Units top-ups, cash payouts, paid curating and tutoring bookings.

*Judges and developers group* (a quiet body-style line "For judges and developers", not a heading; ⚑ show while `sandboxPayments` is on or until 12 Nov):

**Is the code public?** ⚑ OWN-H7
Yes. The code is on GitHub at github.com/yhtiee/Ifiok-AI-Agent, including how lessons are checked, how AI calls are budgeted and how pay is worked out.

**How does Ifiok use AI?**
AI drafts lessons, practice questions and lab set-ups, reads past questions and reviews explainers. It outputs data, never code, and a maths engine computes every number. In the pilot, text runs on GPT-OSS models on Groq, with Google Gemini for photos and as backup. Every call goes through our server, never your browser.
*(Name Whisper only once `explainers` is open; check model names against `app_config` before each deploy.)*

**How do payments work in the hackathon demo?** ⚑ `sandboxPayments`
Everything runs in PayPal sandbox with test money. Contributor payouts use PayPal Payouts, split by points with the 20% cap. Tutoring payments are authorised at booking, captured after the session is confirmed, and voided if the tutor doesn't show. Every money screen says "Sandbox: test money".

**Can Ifiok's AI move money on its own?** ⚑ `sandboxPayments`
No. When you keep missing a topic, the study agent can suggest a tutor who has Mastered it and draft the booking, but only your tap creates the payment. Payout explanations use the ledger's numbers, not the model's.

### 5.11 Final call to action (`#start`)
**H2:** Start with one topic tonight
Type a topic or find your course. If another student has opened it before, your lesson is ready at once; if it's new, it takes about a minute.
[Start learning free] → `/sign-in?mode=signup` *(primary, camwood)*
Free. For university students 18 and over. · Already have an account? **Sign in** → `/sign-in`

### 5.12 Sticky mobile bar
- Shows after the hero button scrolls out of view; hides when `#start` is visible; ≥ 44 px; no layout shift; no slide-in under reduced motion.
- Left, text link: **Sign in** → `/sign-in`
- Right, primary: [Start learning free] → `/sign-in?mode=signup`
- Screen-reader label: Start or sign in

### 5.13 Footer
- Wordmark · Ifiok is Ibibio for wisdom and knowledge.
- See it. Try it. Master it. *(the tagline lives here, not in the H1)*
- Ifiok is an AI and it can be wrong. Numbers are checked by a maths engine; marks are estimates.
- Links: Create account → `/sign-in?mode=signup` · Sign in → `/sign-in` · Terms of use → `/terms` · Privacy notice → `/privacy` · How Ifiok uses AI → `/ai` · ⚑ Code on GitHub (when public)
- Contact: privacy questions → `NEXT_PUBLIC_PRIVACY_EMAIL`
- © 2026 Ifiok

### 5.14 Microcopy and alt text
- Status badges: "Open now", "Building now", "After launch", "Test run · PayPal sandbox".
- Example label: "Example" (plain text, before the example, never only in a tooltip).
- Journey Ink Line SVG: decorative, `aria-hidden="true"`; the rows carry the meaning.
- Pool split illustration (if used): "A month's pool split by points among five example contributors; one share stops at 20% and the rest carries to next month."
- Error copy is not on this page; the sign-in form owns it.

---

## 6. What to drop or move from the current page (`app/(marketing)/page.tsx` on disk)

| Current item | Action | Why |
|---|---|---|
| H1 "See it. Try it. Master it." | **Move** to the footer | A three-beat slogan says nothing a searcher typed and breaks the no-aphorism rule; the H1 now names the job |
| "Built for the way you actually study" with Lesson, Lab, **Snap** previews | **Drop** Snap; keep Lab inside Learn behind `labs`; Lesson preview replaced by the hero demo and a real screen later | Snap-and-mark is Stage 4 (`10`); showing it as a feature is untrue |
| "Any course. Any topic. One loop." (five steps incl. "Practice comes back at the right time", "Your plan adapts every day") | **Replace** with the Journey section | Spaced review and the adaptive daily plan are Stage 4; the agent-loop framing doesn't match the owner's five-step sale |
| Promise "Light on your data: No video" | **Reword** ("Lessons are small data files, not video") | Student video explainers are allowed (Q41) |
| "Pin topics to keep studying offline" | **Drop** (FAQ can mention later) | Offline pinning is Stage 2 (L-05) |
| FAQ "Is Ifiok free? … 8 tutor messages and 2 snap-and-marks a day" | **Replace** with the Q44 pricing answer | Tutor and snap are closed; "pilot" wording is gone |
| FAQ "I'm a lecturer…" and the Lecturers row in contributors | **Drop** | Lecturers aren't served (Q39); "lecturer" is banned in landing copy |
| "During the pilot … rewards start at the paid launch" | **Replace** with the Earn section's status lines | Q42/Q44: points and Units are recorded in the MVP; rates are public |
| "The pilot is open by invitation" section | **Drop** | Sign-up is open; "invitation" is banned |
| `START_HREF = "/sign-in"` only, no Sign in link | **Split** into Start learning free and Sign in | Returning users had no visible path; every competitor shows both |
| Contributors section ahead of FAQ, alone | **Expand** into Contribute, Teach, Earn | The owner's five-part journey |

From the `01`/`02` briefs: the separate **Practise** pillar folds into Learn (the owner's five steps); the "four pillars index" becomes the status-driven Journey; the two earn sections merge into one Earn plus a Teach section; "How it works" is dropped (the Journey does its job); the open-source section moves into Trust; the judges' FAQs are flag-gated.

---

## 7. Open questions for the owner (log in `12` §4 if agreed)

1. **Five steps vs four pillars.** The page sells Learn, Prepare, Contribute, Teach, Earn; the spec's pillars (`00` §1b) have Practise (labs) as its own pillar and Teach-and-earn as one. Safer option taken: labs sit inside Learn, and the spec's pillars are unchanged. Confirm, or ask for a `00` §1b update.
2. **`/sign-in?mode=signup`.** Not supported on disk (Q46 says it was built). Restore it, or accept `/sign-in` for both CTAs until it lands.
3. **The Q45/Q46 rebuild isn't in the working tree.** Was it lost, or never committed? This deck assumes a rebuild from the current file.
4. **Public topic pages for SEO.** Long-tail traffic ("<topic> explained") needs public pages from shared lessons. Which shared content can be public, at what cost, under `shared_lesson_sources()` rules?
5. **Repository public and licence (OWN-H7).** The Trust row and footer link stay hidden until the repo is public; the licence is named only once `LICENSE` exists.
6. **Showing curator pay (₦1,500) and the tutoring example (₦2,000 → ₦1,700)** while both are "After launch". Q44 allows launch rates; confirm you're happy for them to appear before Stage 3, labelled "Launch rates, may change".
7. **"Building now" without dates.** I recommend no public dates. If you want "Opens in November" for hackathon judges, say so and it goes only in the judges' FAQ group.
