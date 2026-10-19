# Landing page · 01 · SEO brief

**Owner:** SEO. **For:** content writer, designer, engineer. **Date:** 18 Oct 2026.
**Binding inputs:** `00` §1, §1b, §3, §6 · `06` §0, §2, §3, §12–§15 · `07` §1, §3.4, §5.11 · `10` Stage 1 · `12` §4 Q38–Q44 · CLAUDE.md guardrails 13 and the UI rules. Where this brief and the spec disagree, the spec wins.

**Honesty notes.** I can't see search volumes or keyword-tool data. Keywords below are ranked by **intent fit and winnability**, sanity-checked against live search results (Oct 2026). Anything marked *(assumption)* needs checking after launch with Google Search Console.

---

## 1. Audience and search intent

**Who lands here:** Nigerian undergraduates (18+), on a mid-range Android phone with mobile data bought in small amounts (`00` §3), mostly coming from a WhatsApp link a course rep or friend shared, and some from Google. A second, smaller group: hackathon judges and developers coming from Devpost or GitHub.

**What the search results show (Oct 2026):**
- **"<course code> past questions"** (MTH 101, PHY 101, GST/GSS 101) brings up PDF aggregators, Post-UTME sellers, student-uploaded libraries and spam pages. The intent is **"give me the file"**. Ifiok doesn't host past papers (students upload their own; past papers are never shown as files). **The home page shouldn't chase this term head-on**, because people who come for a download leave straight away. We target the next step instead: *"what do I do with these past questions?"*
- Course codes differ by school (GST vs GSS vs GSP), so copy uses codes as examples ("MTH 101, PHY 101, CHM 101") and never as a list of courses we cover.
- **"AI study app"** results are global listicles (ChatGPT, NotebookLM, Quizlet). None is Nigerian, priced in naira or built for low data. That gap is our angle.
- **"virtual lab / physics practical / simple pendulum / lab report"** results are foreign commercial labs, Scribd reports and Nigerian research papers that name the lack of lab equipment as a known problem. Students are looking for help with the **practical and the report**.
- **"make money as a student in Nigeria"** results are side-hustle blogs (selling notes, tutoring). The intent is real, but the traffic is mixed. Our copy must be plain about payouts opening with payments.

### Primary keyword set (homepage targets)
| # | Phrase (and close variants) | Intent | Section |
|---|---|---|---|
| P1 | AI learning app for Nigerian university students · AI study app Nigeria | Choosing a tool | Title, H1 area, hero line |
| P2 | exam preparation app · prepare for exams with past questions · study plan to exam date | Exam prep | Prepare |
| P3 | virtual lab · virtual physics lab · physics practical online · lab report | Practicals | Practise |
| P4 | interactive lessons from your notes · learn from lecture notes · course outline | Learning | Learn, How it works |
| P5 | Ifiok · Ifiok AI · Ifiok meaning | Brand | Title, footer, Organization schema |

### Secondary clusters (use in H3s, captions and FAQ, naturally, never stuffed)
- **Learn:** "<topic> explained" (e.g. derivatives, Ohm's law), "how to understand <topic>", "AI tutor Nigeria", "100 level courses", "weak areas".
- **Prepare:** "how to pass <course>" (only as a question, never a promise), "how to use past questions", "timed practice / mock exam", "CBT practice", "worked solutions".
- **Practise:** "simple pendulum experiment", "Ohm's law experiment", "Hooke's law experiment", "lab manual", "no lab equipment".
- **Earn:** "earn money as a student in Nigeria", "get paid for your notes", "student tutor Nigeria", "share past questions and earn".
- **Trust:** "accurate AI for maths", "open source education app", "is my data safe".

**Later, not this page:** long-tail traffic ("MTH 101", "<topic> explained") would come from public topic pages built from shared lessons. That needs a spec decision first (which shared content is public, cost, `shared_lesson_sources()` rules). Raise it as an open question; the home page doesn't depend on it.

---

## 2. Page information architecture

Keep one H1. Each H2 is a section, and H3s are the items inside it. The heading text below is a **working draft for the writer**: keep the keyword idea and change the words to fit the voice table (`07` §1). Section order is set to cut bounce: show the value, let them try it, then answer cost and trust before they have to ask.

| # | Section (id) | Job | Heading outline |
|---|---|---|---|
| 0 | Header | Wordmark, 3–4 anchor links (Learn · Exam prep · Labs · Earn · Pricing). Desktop gets a **secondary-style** "Start free" button; the hero holds the primary. | none |
| 1 | Hero (`#top`) | In the first 360×640 viewport: **what it is, who it's for, try it now**. The live tangent mini-lesson (`07` §3.4 rule 7, §5.11), one primary action "Start learning free", and the line under it: "Free. For university students 18 and over." | **H1** (pick one): ① "Your course, made easy to see, try and master." *(preferred, the `07` promise line)* ② "Learn any course from your own notes." Then a supporting paragraph naming the category and audience: "Ifiok is the AI learning agent for Nigerian university students. Upload your outline, notes or past questions, or just type a topic." The tagline "See it. Try it. Master it." can sit in the demo caption or the wordmark lockup. Don't use it as the H1 alone: it says nothing a searcher typed. |
| 2 | Four pillars index | A short list of jump links (not a card grid) so people who skim go straight to their need. | H2 "One app for learning, exams, labs and earning" · four rows, each one sentence and an anchor link |
| 3 | Learn (`#learn`) | Pillar 1: from outline, notes or textbook pages (read on the phone; only the pages you choose are sent) to a Path, interactive lessons, mastery and weak areas. One real screen. | H2 "Turn your outline and notes into lessons you can move" · H3s: "Upload or just type a topic" · "A Path through the whole course" · "See your weak areas and the next step" |
| 4 | Prepare (`#exam-prep`) | Pillar 2: upload past questions and see **how often each topic appears and its share of marks**, a study plan to your exam date, worked solutions and timed practice papers. One real screen. Guardrail 13 applies. | H2 "Prepare for exams with your past questions" · H3s: "See what past papers ask, topic by topic" · "A study plan to your exam date" · "Worked solutions and timed practice" |
| 5 | Practise (`#labs`) | Pillar 3: a virtual lab from your manual or a lab topic (pendulum, Ohm's law, Hooke's law): take readings, plot, compute, get a lab report. Mention the shortage of lab equipment plainly, without statistics. Optional **second try-it** (§5). | H2 "Run your practicals in a virtual lab" · H3s: "From your lab manual or a topic" · "Readings, graph and result" · "A lab report you can print" |
| 6 | Teach and earn, summary (`#earn-intro`) | Pillar 4 in one screen: four ways to earn, with a link to the details (§10). | H2 "Get paid when your work helps other students" |
| 7 | How it works (`#how`) | Three steps in an Ink Line timeline (`07` §3.1), not five. | H2 "How Ifiok works" · H3 ×3: "Add your materials or type a topic" · "Get your Path" · "Learn, prepare, practise, and earn as you share" |
| 8 | Verified, not guessed (`#trust`) | The differentiator. Every number comes from a maths engine; explanations cite your pages; marks are labelled estimates; three flags hide a wrong step; textbooks stay on the phone; 18+; light on data. | H2 "Every number is checked, not guessed" · H3 per promise (4 max) |
| 9 | Pricing (`#pricing`) | Free / Plus / Units in a plain comparison table, **not three identical cards**. Say clearly: "Plus opens with payments. Until then everything is free." | H2 "Free to learn. Plus for ₦500 a month." · H3 "Free" · "Ifiok Plus" · "Units for extras" |
| 10 | Earn: how pay is calculated (`#earn`) | Rates and formulas, labelled **"Launch rates, may change"**: curators ₦1,500 per accepted review; tutors keep 85%; uploads and explainers share 35% of monthly margin by usage points (max 20% each); +5 Units per approved upload, +1 per student who uses it each month. "Payouts open with payments." During the hackathon only: "Payments are being tested in PayPal sandbox (test money)." | H2 "How Ifiok pays students" · H3 "Verified uploads" · "Explainers" · "Curating lessons" · "Tutoring" · "How your share is worked out" |
| 11 | Open source (`#open-source`) | The code is public: link to GitHub. Name the licence only once a `LICENSE` file exists (OWN-H7 is open, and the repo has no licence file today). | H2 "Open source, so you can check how it works" |
| 12 | FAQ (`#faq`) | Answer objections (§6). Native `<details>`; the same data feeds the FAQPage schema. | H2 "Questions students ask" · each question is the `<summary>`, not a heading |
| 13 | Final call to action | Repeat the single action with a short reason. | H2 "Start with one topic tonight" *(draft)* |
| 14 | Footer | Name meaning ("Ifiok is Ibibio for wisdom and knowledge"), AI disclaimer, links to /terms, /privacy, /ai, GitHub, © 2026. | none |

**Remove from the current page** (out of date per Q38–Q44): the lecturer FAQ and the lecturer earning row (Q39); snap-and-mark as a headline feature and "2 snap-and-marks a day" (deferred, Q38); "No video" (optional explainers allowed, Q41); offline pinning (deferred); the "pilot open by invitation" section (replace with the open call to action unless the owner says the pilot is still invite-only, then keep one line); "rewards start at the paid launch" (replace with the Q44 rates).

---

## 3. On-page SEO spec

### Title tag (≤ 60 characters; set `title: { absolute: … }` in `app/(marketing)/page.tsx`)
1. `Ifiok · AI learning agent for Nigerian university students` (58) **preferred**
2. `Ifiok · Interactive lessons, past questions and virtual labs` (60)
3. `Ifiok · the AI learning agent` (29), the current default. Keep it as `title.default` for other pages.

### Meta description (≤ 155 characters)
1. `Upload your course outline, notes or past questions and get interactive lessons, exam prep and virtual labs. Free for Nigerian university students, 18+.` (152) **preferred**
2. `Learn any course from your own notes, see the patterns in past questions, run virtual labs and earn by sharing. Free for Nigerian students, 18+.` (144)

### Open Graph and Twitter card (WhatsApp is the main share channel)
- `og:title` / `twitter:title`: `Ifiok · the AI learning agent`
- `og:description` / `twitter:description` (keep ≤ ~110 so WhatsApp doesn't cut it off *(assumption)*): `Lessons you can move, exam prep from your past questions, virtual labs. Free for students.`
- Keep the generated `opengraph-image.tsx` / `twitter-image.tsx` (1200×630, alt already descriptive). Keep the PNG small (aim < 300 KB; WhatsApp is known to drop large preview images *(assumption: test by sharing the production URL in WhatsApp)*). `og:locale` `en_NG`, `og:type` `website`, `twitter:card` `summary_large_image`.

### Canonical and origin
- `alternates.canonical: "/"` already exists and resolves against `metadataBase`. **Risk:** `app/layout.tsx` falls back to `http://localhost:3000` when `NEXT_PUBLIC_SITE_URL` is unset, so a production build without it publishes localhost canonicals and share images. Make the variable **required for production builds** (read it through `@/lib/env`, per CLAUDE.md, not `process.env` in the layout).
- Preview deployments must not be indexed. Vercel adds `X-Robots-Tag: noindex` to preview URLs by default *(verify)*. `robots.ts` should also return `disallow: "/"` outside production.
- The production domain is still open question Q7. Before any promotion, move to a custom domain and redirect the `*.vercel.app` URL to it.

### Heading rules
One H1 (hero). H2 per section, H3 per item, no skipped levels. FAQ questions are `<summary>` text, not headings. Sentence case; no all-caps eyebrows (`07` §3.4). Primary terms go in the H1 or first paragraph, the Prepare/Practise/Pricing H2s and the first sentence of each section. Never repeat the same phrase in more than two headings.

### Internal and external links
- Primary action → `/sign-in` (it also creates the account, P0-04). Link to the create-account view directly only if the sign-in page supports it; don't invent a parameter.
- `/ai` from the trust section ("How Ifiok uses AI"), `/privacy` from the textbook-privacy promise and FAQ, `/terms` from the earn section (contributor terms) and footer.
- GitHub `https://github.com/yhtiee/Ifiok-AI-Agent` from the open-source section and footer (`rel="noopener"`; no `nofollow` needed).
- Anchor text says where it goes ("Read how Ifiok uses AI"), never "click here". In-page anchors use the ids in §2.

### Illustration and image alt text
- Prefer inline SVG built as server components. A decorative SVG gets `aria-hidden="true"` and no alt.
- An illustration that carries meaning gets `role="img"` and an `aria-label` that states **what it shows and the takeaway**, e.g. "A course Path: five topics, two Mastered, the next one highlighted." Keep it under ~125 characters, no "image of", no keyword lists.
- Every plot has a text summary next to it (UI rule), and the hero demo keeps its live text readout.
- Real screenshots (if used, `07` §5.11): alt text describes the screen's point. They must show screens that exist; no mock data that looks like real users.

### Structured data (JSON-LD)
One `<script type="application/ld+json">` in `app/(marketing)/page.tsx`, escaped with `.replace(/</g, "\\u003c")` (per `node_modules/next/dist/docs/01-app/02-guides/json-ld.md`). Build it from the same constants the page renders: prices, the FAQ array, the site URL. `SITE` = the production origin.

```json
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization", "@id": "SITE/#org",
      "name": "Ifiok", "url": "SITE/",
      "logo": "SITE/apple-icon.png",
      "description": "Ifiok is the AI learning agent for Nigerian university students. Ifiok is Ibibio for wisdom and knowledge.",
      "sameAs": ["https://github.com/yhtiee/Ifiok-AI-Agent"]
    },
    {
      "@type": "WebSite", "@id": "SITE/#website",
      "name": "Ifiok", "alternateName": ["Ifiok AI", "Ifiok, the AI learning agent"],
      "url": "SITE/", "inLanguage": "en-NG", "publisher": { "@id": "SITE/#org" }
    },
    {
      "@type": "WebApplication", "@id": "SITE/#app",
      "name": "Ifiok", "url": "SITE/",
      "description": "<meta description>",
      "applicationCategory": "EducationalApplication",
      "operatingSystem": "Any (web browser on Android, iPhone or computer)",
      "browserRequirements": "Requires JavaScript",
      "inLanguage": "en-NG",
      "isAccessibleForFree": true,
      "audience": { "@type": "EducationalAudience", "educationalRole": "student",
                    "audienceType": "Nigerian university students aged 18 and over" },
      "featureList": ["Interactive lessons from your course outline and notes",
                      "Exam preparation from your past questions with a study plan",
                      "Virtual labs with readings, graphs and a lab report",
                      "Get paid for verified uploads, explainers, curating and tutoring"],
      "publisher": { "@id": "SITE/#org" },
      "offers": [
        { "@type": "Offer", "name": "Free", "price": "0", "priceCurrency": "NGN",
          "availability": "https://schema.org/InStock", "url": "SITE/#pricing" },
        { "@type": "Offer", "name": "Ifiok Plus (monthly)", "price": "500", "priceCurrency": "NGN",
          "priceSpecification": { "@type": "UnitPriceSpecification", "price": "500",
            "priceCurrency": "NGN", "billingDuration": "P1M", "unitText": "month" },
          "description": "Billing opens when payments go live. Until then everything is free.",
          "url": "SITE/#pricing" },
        { "@type": "Offer", "name": "Ifiok Plus (semester)", "price": "1500", "priceCurrency": "NGN",
          "priceSpecification": { "@type": "UnitPriceSpecification", "price": "1500",
            "priceCurrency": "NGN", "unitText": "semester" },
          "description": "Billing opens when payments go live. Until then everything is free.",
          "url": "SITE/#pricing" }
      ]
    },
    {
      "@type": "FAQPage", "@id": "SITE/#faq",
      "mainEntity": [
        { "@type": "Question", "name": "<question text>",
          "acceptedAnswer": { "@type": "Answer", "text": "<answer text exactly as shown>" } }
      ]
    }
  ]
}
```
Rules:
- The Plus offers carry **no `availability`** until billing is live (nothing here is honestly "InStock" or "PreOrder"). Add `InStock` when Plus opens.
- **Never add `aggregateRating` or `review`** until real reviews exist. Google's software-app rich result needs one of them, so we expect **no rich result for now**; the markup still helps Google understand what Ifiok is.
- FAQ rich results are limited to government and health sites, so FAQPage won't show as a rich result *(Google policy since 2023)*. Keep it anyway because it's cheap and helps machines read the page, and the answers must match the visible text word for word.
- Leave out the Units top-up from the schema (extras, shown on the page only). Add a `SoftwareSourceCode` node (`codeRepository`, `license`) only after the licence is chosen (OWN-H7).
- Validate with Google's Rich Results Test and validator.schema.org before merging.

### robots and sitemap (neither exists under `app/` today)
- **`app/robots.ts`** (production): `allow: "/"`; `disallow: ["/api/", "/auth/", "/today", "/courses", "/learn", "/practice", "/me", "/onboarding"]`; `sitemap: SITE/sitemap.xml`. Non-production: `disallow: "/"`.
- **`app/sign-in`**: `robots: { index: false, follow: true }` in its metadata (don't block it in robots.txt, or Google can't see the noindex).
- **`app/sitemap.ts`**: `/` (priority 1), `/ai`, `/privacy`, `/terms`, with `lastModified` from a constant updated when copy changes (not `new Date()` on every build).
- `middleware.ts` already skips `/`, icons, share images and `.txt`/`.xml` files. Keep that, so `/robots.txt` and `/sitemap.xml` stay static and outside the session middleware.
- After launch: verify the domain in Google Search Console and Bing Webmaster Tools, then submit the sitemap.

---

## 4. Performance and Core Web Vitals (landing page `/`)

**Targets** (mid-range Android, 4G, Lighthouse mobile and PageSpeed Insights on the production URL): **LCP ≤ 2.5 s · CLS < 0.1 · INP < 200 ms · TBT < 200 ms · Lighthouse mobile ≥ 90 in Performance, SEO, Accessibility and Best Practices.** There's no field data yet (new site), so test in the lab until real-user data (CrUX) shows up. Run Lighthouse on every landing PR; a CI job is the engineer's call.

**Rules**
1. **Static.** `/` renders at build time: no `cookies()`, `headers()`, Supabase, auth or `QueryProvider`. Confirm `/` shows as static (○) in `next build` output.
2. **Server components by default.** Client islands only for the interactive demos and the mobile sticky CTA. Budget: **each island ≤ 10 KB gz**. Page-specific JS on top of the framework stays ≤ 25 KB gz *(assumption: measure the framework baseline from the build first; the overall Today budget is 170 KB gz and the landing page should stay well under it)*. No zod, mathjs, KaTeX JS, TanStack, Zustand or Radix on `/`; demo maths is plain TypeScript formulas.
3. **Move `import "katex/dist/katex.min.css"` out of `app/layout.tsx`** into the layouts that render maths (lesson and app routes). Today every page, including `/`, loads it as render-blocking CSS. If the landing page shows a formula, pre-render it to HTML at build time and load only the CSS it needs.
4. **Fonts:** keep `next/font` (Bricolage display, Atkinson text). JetBrains Mono is loaded and preloaded on every route from the root layout: set `preload: false` or move it to Bench routes, and use `tabular-nums` in the landing demos. Load only the Bricolage weights the page actually uses.
5. **LCP element** = the H1 text. Nothing above it waits on JS, an image or a web font (`display: swap` plus the size-adjusted fallback next/font already gives).
6. **No CLS:** every SVG/demo has fixed `width`/`height` or `aspect-ratio`; the sticky CTA is `position: fixed` with bottom padding reserved on `main` from the first paint; FAQ uses native `<details>`; no banners injected after load.
7. **INP:** demo drag handlers do constant work per event, batched with `requestAnimationFrame`; `touch-action: none` only on the drag surface; keyboard and slider input work too (already in `TangentHero`).
8. **Illustrations are inline SVG** (no stock or photo images). If real screenshots are used: `next/image`, AVIF/WebP, explicit sizes, `loading="lazy"`, below the fold only, ≤ 60 KB each.
9. **No third-party scripts at load:** no analytics, chat widgets, embeds, YouTube or social pixels. If analytics are added later, they load after consent or idle, are first-party proxied and carry no personal data (guardrail 10).
10. **Total transfer for `/`:** aim ≤ 250 KB on first load, including fonts *(assumption, chosen for data-bundle users)*.

---

## 5. Bounce-reduction tactics (within the brand rules)

- **Try before sign-up.** The hero tangent demo works with no account. Optional second island in Practise: a pendulum "take a reading" demo (set the length, tap to time it, see T and the computed g), with numbers from the formula and never typed in by hand. A Prepare example ("topic share of marks") must use the owner's permitted demo papers (OWN-H1) or be labelled "Example". **Never invent data that looks real.**
- **The first screen answers three questions:** what is this (H1 + line), is it for me ("Nigerian university students, 18+"), what does it cost ("Free").
- **Skimmable:** the four-pillar jump list near the top; one idea per section; captions ≤ 2 sentences; lists and full-width rows, not identical card grids or cards in cards.
- **One primary action per screen.** Hero and final call to action are camwood; the header button is secondary. On mobile, a **fixed bottom bar** ("Start learning free") appears only after the hero action has scrolled out of view and hides when the final call to action is visible, so there's never more than one primary at a time. It's ≥ 44 px tall, causes no layout shift, and doesn't slide in when reduced motion is on.
- **Match the searcher's intent:** a visitor from "past questions" lands on copy that says right away what Ifiok does with *their* past questions. No page promises downloadable papers.
- **Answer objections on the page,** not behind sign-up: cost, data use, accuracy, privacy, age, "does it cover my course", payouts.
- **Transparent maths:** pricing and pay formulas shown in full, labelled "Launch rates, may change", with what isn't live yet stated plainly (Plus billing, payouts, tutoring bookings).
- **Not allowed:** countdowns, "only N spots left", fake testimonials, user counts, university logos, star ratings, "predicted questions", pop-ups, exit-intent modals, autoplay, fade-up-on-scroll, emoji, sparkle or "AI magic" language, naming or comparing competitors.
- **Measure (once consent-safe analytics exist):** hero demo interaction rate, primary call-to-action click-through, scroll depth to Pricing and FAQ. No numbers are promised.

---

## 6. FAQ questions (the writer answers; keep answers ≤ 60 words, matching the spec)

**Students**
1. What is Ifiok?
2. Is Ifiok free? What do I get with Ifiok Plus?
3. When can I pay for Plus, and how? (opens with payments)
4. Does it work for my course and my university?
5. What can I upload: outline, notes, textbook pages, past questions, lab manual?
6. Is my textbook uploaded or shared? What happens to my notes?
7. Does Ifiok predict exam questions? *(answer: no; it shows how often topics appear and their share of marks)*
8. Can the AI be wrong? How are the numbers checked?
9. How do virtual labs work, and can I get a lab report?
10. Will it use a lot of data? Does it work on my phone?
11. Why is it 18+ only?
12. How do I earn on Ifiok, and when do payouts start?
13. How is my share of the contribution pool calculated?
14. Who can tutor or curate, and how much do they get?
15. Can I share past questions or notes I didn't write? *(answer: only what you made or have the right to share; textbooks aren't accepted)*
16. Is Ifiok a "solve it for me" app? *(answer: no; it teaches and checks your own working)*

**Judges and developers**
17. Is Ifiok open source? Where is the code?
18. How does Ifiok use AI, and which models?
19. How do payments work in the hackathon demo? *(PayPal sandbox, test money only)*
20. How does Ifiok keep students' data private and AI costs under control?

---

### Open questions for the team (log in `12` §4 if the owner agrees)
- **Pool example in naira:** Q44 allows rates and formulas; Q42 forbids naira estimates of contributor earnings before a pool exists. Safer option taken: show the pool formula with a **points-only** example. Only curator (fixed ₦1,500) and tutoring (85%, with a clearly labelled example price) appear in naira.
- **Licence:** the page can say "the code is public on GitHub" once the repo is public, but it can't name a licence until `LICENSE` exists (OWN-H7).
- **Invite-only or open sign-up:** the current page says the pilot is invite-only, and Q44 doesn't say. Confirm before the writer drops that section.
