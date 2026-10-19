# Landing page · 05 · Design spec (look, illustration, components)

**Owner:** design. **For:** engineering, the owner. **Date:** 19 Oct 2026.
**Builds on:** `04-strategy-and-copy.md` (section order, CTAs, every word of copy). **Binding:** CLAUDE.md UI rules and budgets, `07` §1–§3, §6–§7. Where this file asks for something `07` doesn't allow, it is listed in §10 "Deviations from 07" and needs a review-log entry before it ships.
**Mockup:** `specifications/landing/mockups/index.html` (static HTML/CSS, inline SVG, about 11 KB raw (3.7 KB gz) of vanilla JS for the interactions; open it in Chrome). Screenshots in `mockups/shots/` (§12). The mockup renders today's flag state: only `course`, `topic`, `outline` open.

---

## 1. Reference analysis

| Site | Does well (visually) | Does badly | Take |
|---|---|---|---|
| **Edves** | Confident navy hero, serif display with a blue accent phrase, generous section spacing | Stat wall, logo strip, five identical icon cards, eyebrow pills on every section, glow in the hero, dark "14+ models" icon grid. Reads as any B2B SaaS | Nothing visual. The dark band as a rhythm break (we use the Bench) |
| **AltSchool** | One clear blue CTA in the hero; life-stage toggle row; a warm cream band behind the routing | Centred two-line hero, logo wall, ticker, stats band on black, three coloured-header cards. The page has no image of the product | Routing near the top (our Journey) |
| **Tuteria** | Heavy rounded display face, saturated purple/navy bands, yellow CTA: energetic and Nigerian | Photo collage of faces, floating WhatsApp bubbles over content, many CTAs per screen, stock-like portraits | The energy of a heavy display face on flat colour; full-bleed colour bands |
| **uLesson** | Naira price in big type; one strong plum brand colour; rounded 32 px panels; colour tied to the audience toggle | Photo circles, carousels, empty white stretches (lazy content didn't render), star ratings | Big rounded "stage" panels; the price stated plainly in display type |
| **Quizlet** | Journey framing with one product picture per step; text left, picture right; product UI as the image on a coloured field | All-caps eyebrows, two-beat slogans, stock photos in two of the four steps, link-farm footer | **The structure**: one step per band, coloured field holding the evidence |
| **Coursera** | Dense, useful; "Join for free" + "Log in" always visible | Promo stacking, catalogue grid soup, gradient promo tiles | Sign in visible on every width |
| **Kahoot** | Playful, saturated, unmistakable; tiles in their own colours | Shouty caps, gradient-ish purple, 12 identical tiles, inconsistent CTAs, seasonal clutter | Per-category colour as a navigation aid, used once |
| **Khan Academy** | The friendliest of the eight: a flat geometric mascot on a ruled path, role picker as rows, FAQ as rows, coloured quote cards, generous white ground | Sparkle shapes, stat strip, three coloured testimonial cards of equal size | **A flat, geometric, ink-outlined character on the learning path**; white ground with coloured blocks; FAQ in two columns |

**The shared industry pattern.** White or near-white ground; a heavy sans display face at 48–64 px; one saturated brand colour for buttons; full-bleed tinted bands that alternate; rounded 16–32 px panels holding a product image or photo; a proof strip (logos, counts) by the second screen; identical icon-card grids for features; a dark band near the end; FAQ; link-heavy footer. Photography of smiling students is the default image.

**Direction chosen for Ifiok.** Keep the industry's friendliness and colour (white ground, heavy display type, saturated per-path colour on big rounded stages, a dark band) but replace both its proof and its imagery with the product's own subject matter: every picture on the page is a flat, ink-outlined cartoon *made from a learning object* (the plot point, a lesson page, a stack of past papers, a notebook, a speech bubble, a calabash), and every one of them does something when you touch it. The page itself is a Path: one hand-drawn Ink Line runs from the Journey list down the left rail through Learn, Prepare, Contribute, Teach and Earn, with a node in each path's colour, and **Dot**, the camwood tittle of the wordmark, is the character who walks it. The hero is the same lesson screen the product ships, with Dot standing on the tangent.

**Deliberately avoided.** The template sequence (pill → centred hero → logo strip → stats → icon-card grid → testimonials → three pricing cards → "Ready to get started?"); stock or photo collages of students; Khan/Duolingo-style blob mascots with no connection to the subject; and the anti-slop overcorrection (grey paper, mono labels, one rust accent, no pictures). There is no proof strip because there is nothing true to count yet; the working demo and the "Open now / Building now" badges carry the proof.

---

## 2. Tokens

`E` = existing in `app/globals.css` / `07` §3.3. `N` = new (add to `globals.css` and the `@theme inline` map). Contrast is WCAG 2.x, measured with the formula in the mockup's build notes (values rounded down).

### 2.1 Page colour roles

| Token | Light | Dark | Use | Contrast (light / dark) |
|---|---|---|---|---|
| `--surface` E | `#FBFCFD` | `#161D25` | **Landing page ground** (§10 D1), sticky header, sticky bar | — |
| `--paper` E | `#F2F4F7` | `#0E1318` | Alternate bands (Journey, Prepare, Teach, FAQ), worked-example box | — |
| `--ink` E | `#131B26` | `#E5EBF1` | Text, Ink Line, outline button border | 16.86 / 14.14 on surface; 15.72 / 15.54 on paper |
| `--ink-2` E | `#4A5563` | `#A9B4C2` | Body copy under headings, leads, captions | 7.38 / 8.08 on surface; 6.88 / 8.88 on paper |
| `--ink-3` E | `#5D6876` | `#97A4B2` | After launch ring, axis ticks | 5.51 / 6.69 on surface |
| `--line` E | `#DDE2E8` | `#2A3542` | Hairlines between rows | decorative |
| `--line-strong` N | `#C3CAD3` | `#3A4757` | Badge outline, status-line rule | decorative (text inside carries meaning) |
| `--change` E | `#B0500F` | `#F08A45` | Primary button, Building now ring | `--on-change` on it 5.25 / 7.49 |
| `--change-hover` N | `#963F07` | `#F5A26B` | Primary button hover | white on it 6.97; `#0E1318` on it 9.12 |
| `--change-soft` E | `#F8E8DB` | `#3A2616` | Plus column in the price table | ink 14.48 / 11.90. **Never put `--change` text on it (4.39, fails)** |
| `--quantity` E | `#2650B8` | `#7FA2F0` | Focus ring, Learn identity | 7.00 / 6.74 on surface |
| `--built` E | `#1C7A5A` | `#4FBF96` | Open now dot, mastery fills | 5.14 / 7.46 on surface |
| `--prep` N | `#F0B429` | `#F2C14E` | Prepare identity fill (pip, node, character). **Fill only, never text on light** | ink on it 9.29 |
| `--prep-soft` N | `#FDF1D3` | `#30260F` | Reserved for a Prepare band if one is ever needed | ink 15.42 / 12.40; ink-2 6.75 / 7.09 |
| `--prep-ink` N | `#7A5300` | `#F2C14E` | Prepare text when text must be yellow-family (labels, links) | 6.67 / 10.12 on surface; 6.10 / 8.88 on prep-soft |
| `--teach` N | `#A3366B` (zobo) | `#F08DBF` | Teach identity, text-safe | 6.20 / 7.49 on surface; 5.29 / 6.90 on teach-soft |
| `--teach-soft` N | `#F8E5EE` | `#371A2A` | Reserved for a Teach band | ink 14.38 / 13.01 |
| Bench `--bench*` E | unchanged | same in both themes | Trust band | bench-ink 15.29, `#B9C3CF` body 9.71 on bench, 8.47 on bench-2 |

**Path identity map** (alias tokens, so components never name a hue): `--path-learn: var(--ill-learn)`, `--path-prepare: var(--ill-prep)`, `--path-contribute: var(--ill-contribute)`, `--path-teach: var(--ill-teach)`, `--path-earn: var(--ill-earn)`. Learn = quantity blue, Prepare = palm yellow, Contribute = built green, Teach = zobo (hibiscus) red-violet, Earn = camwood. The path colour is always paired with the step number and name; it never carries meaning alone.

### 2.2 Illustration tokens (N, **fixed in both themes**)

The stage is always "lit" (§10 D4): illustrations never re-colour for dark mode, so one drawing works everywhere and outlines never vanish.

| Token | Value | Use |
|---|---|---|
| `--ill-line` | `#131B26` | Every outline, pupil, limb; text inside stages |
| `--ill-white` / `--ill-paper` | `#FFFFFF` / `#FBFCFD` | Eye whites, paper, hint pill |
| `--ill-dot` | `#C2581A` | Dot (camwood, one step lighter than `--change` so the ink outline reads) |
| `--ill-learn` | `#3F6AD8` | Page, the curve |
| `--ill-prep` | `#F0B429` | Papers |
| `--ill-contribute` | `#2E9A72` | Note, ticks, Mastered step |
| `--ill-teach` | `#C2457F` | Bubble |
| `--ill-earn` | `#D0661F` | Calabash and bowls |
| `--ill-built-1` / `--ill-built-2` | `#CDEBDD` / `#7CC4A6` | Familiar / Proficient steps |
| `--stage-learn` … `--stage-earn` | light `#E2EAFB` `#FDF1D3` `#DDF2E9` `#F8E5EE` `#F8E8DB`; dark `#A9BDEB` `#E3CB86` `#9ACDB7` `#DDA9C3` `#E2B08E` | Stage fields. Ink on dark stages 8.69–10.85 |
| `--stage-ink-2` | light `#3E4856` (7.68 on learn stage), dark `#2B3440` (6.69) | Secondary text inside a stage |
| `--readout-rate` | light `#9A440B` (5.43 on learn stage), dark `#6E2E04` (5.43 on dark learn stage) | Slope number in the hero readout. Quantity number `#1D44A6` (7.16 light, 4.60 dark; 24 px 600 = large text) |

Curve `--ill-learn` on the stage is 4.08:1 and Dot/tangent `--ill-dot` 3.70:1: both pass the 3:1 non-text rule for graphics.

### 2.3 Type

Faces unchanged (`07` §3.3): Bricolage Grotesque 800 for H1, H2, the wordmark and big numbers only; Atkinson Hyperlegible Next 400/600 for everything else, including H3; JetBrains Mono only for the engine readout on the Bench.

| Role | Phone (390) | Desktop (≥1024) | Setting |
|---|---|---|---|
| H1 | 32 px | 56 px | `clamp(2rem, 1.35rem + 2.9vw, 3.5rem)`, 800, line-height 1.04, tracking −0.03em, max 15ch, `text-wrap: balance` |
| H2 | 28 px | 44 px | `clamp(1.75rem, 1.3rem + 1.9vw, 2.75rem)`, 800, 1.08, −0.025em, max 22ch |
| Journey step title (H3) | 26 px | 26 px | Bricolage 800, −0.02em (the only display-face H3) |
| H3 | 20 px | 22 px | Atkinson 600, 1.25 |
| Lead | 17 px | 19 px | Atkinson 400, 1.5, `--ink-2`, max 36em |
| Body | 17 px | 17 px | 1.5, max 36em (≈ 65–72 characters) |
| Small | 15 px | 15 px | Captions, under-button line, badges' rows, table cells |
| XS | 13 px | 13 px | Badge text, table mobile labels (floor; never smaller) |
| Big number | 24 px | 24 px | Bricolage 600, tabular (readout, calculator output) |

New tokens: `--text-4xl: 2.75rem` (44), `--text-5xl: 3.5rem` (56); fluid sizes live as `--fs-h1`, `--fs-h2`. Ratio display : body is 3.3 on desktop.

### 2.4 Space, radius, layout

- **Spacing scale (4 px grid):** 4 · 8 · 12 · 16 · 24 · 32 · 40 · 48 · 64 · 88 · 112. Inside a group 4–12, between items 20–24, between blocks 32–48, between sections the section padding.
- **Section rhythm:** padding-block 64 px phone, 88 px tablet (≥768), 112 px desktop (≥1024). Hero: 28/56 phone, 56/96 desktop.
- **Gutters:** 16 px phone, 24 px tablet, 40 px desktop. **Max content width** 1200 px. Reading measure 36em.
- **Grid:** phone 1 column; tablet 1 column with wider measure; desktop: hero 5 : 7 columns, gap 56; path sections `64px rail | 1fr text | 1.08fr stage`, gap 28; FAQ 4 : 7; Trust 1 : 1.
- **Radius family:** 6 input, 8 Bench (engine stage, bench button), 12 inline panels (worked example, Plus column), **24 phone / 32 desktop stage (N `--radius-stage`)**, 999 buttons, badges, segmented buttons. Concentric rule: anything inside a stage is pill or ≤ 12.
- **Elevation:** none. Header and sticky bar separate with a 1 px `--line` border, never a shadow. Illustration ground shadows are flat ellipses at 10% ink (part of the drawing).
- **Breakpoints:** 640 (descriptor shows), 768 (anchor nav; tables become real tables; sticky bar off), 1024 (two-column layouts, rail, outline "Start free", sticky stages).

---

## 3. Illustration system: "the Marks"

### 3.1 Style rules
- **Built from learning objects.** Every character is a thing from studying (a plot point, a lesson page, past papers, a notebook, a speech bubble, a calabash, a maths engine). No humans, no animals, no blobs. Nothing is a real nsibidi sign.
- **Line:** one weight per scale: 4 units on 400-unit scenes, 3.5 on the 600-unit hero, 2.5 on 48-unit nodes; round caps and joins; `--ill-line` everywhere. Lines are drawn straight or with one gentle curve; the brush wobble is reserved for the Ink Line.
- **Fill:** flat, one path colour per character plus white. No gradients, no shading, no highlights, no texture. One flat ground ellipse at 10% ink.
- **Faces:** two eyes, each a white circle (r 9 on scenes, r 7 on Dot) with a 3 px ink ring and an ink pupil (r ≈ 0.47 of the eye). Mouth only when it says something (smile, flat, "o"). No eyebrows, no blush, no hands beyond a round stub.
- **Proportions:** the object *is* the body; legs are two short strokes ≈ 0.25 of body height with oval feet; arms are single strokes. Eyes sit in the top third.
- **Palette per scene:** ink, white, the path's colour, its stage tint, and at most one other role colour when it means something (green ticks = passed checks; camwood = the rate/tangent).
- **Resting frame first.** Every scene is complete as static SVG in the HTML: it tells its story with JS off and under reduced motion.
- **Size:** each scene ≤ 6 KB of SVG markup; all scenes plus the hero ≤ 30 KB raw (mockup: 28 KB, 4.9 KB gz).

### 3.2 Shared behaviours (all characters)
| Behaviour | Spec | Reduced motion | No JS |
|---|---|---|---|
| **Eyes follow the pointer** | On `pointermove`/`pointerdown` (window, passive), each visible eye's pupil moves toward the pointer by `min(1, d/160) × 2.4` units; batched in one `requestAnimationFrame`; skip eyes outside the viewport | Off, pupils centred | Pupils centred |
| **Perk on hover/focus** | The character's `.perk` group scales to (1.03, 1.05) from its feet, 180 ms `cubic-bezier(.2,.8,.2,1)`; reverses on leave | Off | — |
| **Tap = the scene's one action** | Each scene is wrapped in a real `<button>` (or has real buttons under it) with an `aria-label` saying what happens | Same result, no tween | The resting frame shows the end state's story |
| **Hint pill** | Top-left of every stage: ink-outlined white pill with a camwood dot: "Tap the page", "Tap the papers", "Tap the note", "Pick a level" | — | Shown (it's harmless; the button exists) |

### 3.3 The cast and their scenes

**Dot** (camwood circle, the tittle of the `ifiok` wordmark). The guide. Appears in the hero, on the Journey line and in the final CTA.
- *Hero (signature).* Dot stands on the tangent line at the draggable point, feet on the point. Resting frame: x = 1, slope 2, Dot leaning −19°. Drag the plot or the slider: Dot slides with the point, leans by half the tangent's screen angle clamped to ±28° (it stays upright enough to read), mouth flat; when |slope| < 0.3 Dot smiles; when |slope| > 3.4 its arms go out for balance and its mouth makes an "o". Movement follows the pointer directly (no easing; it's direct manipulation). Reduced motion: identical (it's state, not animation). No JS: resting frame plus the text summary.
- *Journey.* A small Dot (r 11) perches on top of the active step node. Pointer-enter or focus a row → Dot moves along the Ink Line to that node: `transform` 380 ms `cubic-bezier(.34,1.45,.55,1)` (a small overshoot = a hop). This is the page's one "Ink Line advance" (07 §3.1). Reduced motion: jumps without transition. No JS: Dot on Step 1.
- *Final CTA.* A big wordmark `ıfiok` drawn without its tittle sits on an Ink Line; Dot stands at the end of the line, one arm waving. Tap (button "Put the dot back on the i") → Dot hops onto the ı and becomes the tittle (420 ms hop easing); tap again → hops back. Reduced motion: moves instantly. No JS: Dot beside the word. In production draw the wordmark as paths (the designer's final logo), not SVG text.

**Page** (Learn, blue lesson page with a folded corner and a white screen on its belly).
- Resting: screen 1, a mini parabola with a camwood tangent and a drag arrow.
- Action: tap Page or one of three pill buttons "Drag the graph" · "Answer the question" · "See why" (words from 04 §5.1) → the screen content cross-fades (200 ms) and Page squashes horizontally 1 → 0.86 → 1 over 260 ms (a page turn). Live note under it: "Screen 1 of 3: something to move." / "Screen 2 of 3: you try first." / "Screen 3 of 3: the reason, right under your answer."
- Reduced motion: no squash, instant swap.

**Papers** (Prepare, a yellow past paper with three white papers behind).
- Resting: a fanned stack, the yellow paper in front with a smile.
- Action: tap → the four papers deal out into a row (transform 420 ms hop easing, 50 ms stagger); ticks pop above three papers and a dash above the fourth (fade 200 ms, 300 ms delay); the highlighted line on each paper is the same topic. The stage caption carries the copy deck's example row: "**Example** Projectile motion · asked in 3 of 4 papers · about 24% of marks". Tap again → restack. The picture counts; it never predicts (guardrail 13).
- Reduced motion: instant layout change.

**Note** (Contribute, green spiral notebook) and **the gate** (four lamps).
- Resting: Note left of an ink gate with four empty lamps; three small lesson cards on the right; the check list under the picture, all empty.
- Action: tap → Note walks 34 units up to the gate (420 ms); lamps turn green one by one and the matching list rows tick (260 ms apart): "Names and contact details removed", "Readable and on the topic", "Copyright signs checked", "Duplicates checked", then "Approved"; then a green snippet appears in each lesson card ("short, cited snippets", not the whole note). Tap again → reset. The list is `aria-live="polite"`.
- Reduced motion: all checks tick at once.

**Bubble** (Teach, zobo speech bubble) on the **mastery ladder** (four ink-outlined steps filled white → `--ill-built-1` → `--ill-built-2` → `--ill-contribute`).
- Resting: Bubble on Mastered, smiling, under a white speech banner with three format icons (pen, waveform, video frame).
- Action: four pill buttons "Not started · Familiar · Proficient · Mastered" (the official ladder) move Bubble to that step (420 ms hop easing). Below Mastered the banner fades out and the mouth goes flat; note reads "Familiar: teaching opens at Mastered." At Mastered: "Mastered: write, record a voice note or a short video."
- Reduced motion: instant.

**Calabash** (Earn, the month's pool) and **five bowls**.
- Resting: the calabash (carved zigzag band, eyes) above five bowls joined by a dotted pour line. Bowl fill height = share ÷ 20%. Example bowls: one full and spilling into a dashed "Next month" bowl (label "20% cap"), then 11%, 7%, 4%, and the bold "You" bowl at 3%. `role="img"` with the 04 §5.14 alt text.
- Action: the "Work out your points" calculator under it (04 §5.7 optional island): two steppers (Students who used your uploads, Students who finished your explainers) and an "All contributors' points" field. Output: Your points, Your share (one decimal under 10%), "of the pool" or "of the pool, capped at 20%". The You bowl's fill tracks the share (instant). All contributors is clamped to at least your points. **Points and percentages only, no naira (Q42).** Labelled "Example".

**The engine** (Trust, on the Bench: an instrument box with two gauge eyes, a readout, three keys).
- Resting: an "AI draft" bubble says `2 × 1.5 = 3.5`; the readout shows `– – –` in JetBrains Mono.
- Action: "Check the step" (bench outline button) → readout shows the computed `3.00` in `--bench-built`, a `--bench-change` strike crosses "3.5", note: "The engine computed 2 × 1.5 = 3. The step that said 3.5 is dropped." Button becomes "Reset". The number is computed in code (`2 * 1.5`), never typed.

### 3.4 Microcopy the illustrations add (needs copy sign-off)
04 has no words for these; they're my proposals, kept factual: the four hint pills; Learn notes ("Screen 1 of 3: something to move." etc.); Teach notes ("…teaching opens at Mastered."); Contribute check labels (shortened from 04 §5.5 "What happens before anyone sees it"); Trust "AI draft", "Maths engine", "Check the step", the engine note; Earn "You", "20% cap", "Next month", "Your points", "Your share", "of the pool, capped at 20%"; journey "For:" prefix; Journey Step 5 and the Earn table show "Points and Units: Building now" (04 gives bare "Building now" for the closed `earnings` variant; I name what is building so it can't be read as cash). Logged as a question in §11.

---

## 4. Sections (in 04 order)

Common to sections 3–7 (**path sections**): label row "Step n · Name" (15 px 600, preceded by a 22 px pip in the path colour with a 2.5 px ink ring; sentence case, not tracked), H2, optional section badge, lead. Phone order: head → stage → items. Desktop: rail column (Ink Line + 30 px node in path colour aligned to the label row) | head then items | stage, `position: sticky; top: 100px`. Items are a list of rows separated by `--line` hairlines: H3, inline badge after the H3 when the item has its own status, body in `--ink-2`. No cards. No camwood button in sections 2–10 (the sticky bar or header carries it).

### 0. Header
- 60 px phone / 68 px ≥768, `--surface` with bottom hairline, sticky. Left: wordmark (30 px Bricolage 800, camwood tittle) + descriptor "the AI learning agent" (≥640, hidden 768–1100 to make room for the nav), the pair is one link "Ifiok, back to top". Centre (≥768): `nav aria-label="Page sections"` Learn · Exam prep · Earn · Pricing, 15 px `--ink-2`, 44 px tall pill hover in `--paper`. Right: "Sign in" (600, every width), "Start free" outline pill 44 px, 1.5 px ink border (≥1024 only). Never camwood in the header.

### 1. Hero `#top`
- **Phone:** H1 (4 lines at 32 px), lead, primary "Start learning free" (52 px tall, full pill, 28 px side padding), under it two lines: "Free. For university students 18 and over." / "Already have an account? **Sign in**". Then the demo: "Try it: drag the point" (15 px 600), the stage, caption, footnote. At 390 × 844 the button and the top half of the plot with Dot are on the first screen.
- **Desktop:** 5 : 7 columns, vertically centred; the stage is ~920 × 750.
- **Stage:** `--stage-learn` field, radius 24/32, padding 12/20. Plot 600 × 400 viewBox: grid `#B9C7E6`, axes ink 55%, curve `--ill-learn` 5 px, tangent `--ill-dot` 4.5 px, dashed drop line, "y = x²" label, Dot. Readout under the plot, inline text: "At x = **1.00**, the slope is **2.00**." (numbers 24 px Bricolage 600 tabular, quantity number blue, slope number `--readout-rate`), `aria-live="polite"`. Native range slider (−2.5 to 2.5, step 0.05, 44 px tall, `accent-color: --ill-dot`, `aria-label="Point x"`). Caption and footnote below the stage, outside it.
- Keep `components/marketing/TangentHero.tsx`'s maths and pointer code; replace its handle with Dot and its card chrome with the stage. Its "Check yourself" form isn't in 04: see §11 Q1.
- Flag: lead swaps to the `upload` "Open" variant (04 §5.1).

### 2. Journey `#journey`
- `--paper` band. H2 + lead, then five rows on one Ink Line (vertical brush path, 3 px ink, `vector-effect: non-scaling-stroke`) through 48 px nodes. Each node is a circle in the path colour with a 2.5 px ink ring and a white glyph (curve, two papers, note, speech bubble, bowl).
- **Phone row:** `48px node | content`: "Step n" (15 px `--ink-2`), title (Bricolage 800 26 px), "For: …" (15 px), line (17 px ink), badges, link "See how … →" (44 px tall text link).
- **Desktop row:** `64px node | 15rem title block | 1fr line | 17rem status + link`, 28 px padding, hairlines between rows.
- Dot perches on the active node and hops (§3.3). Below: "**Open now:** find or create your course…".
- Badges per flag exactly as 04 §5.2; dates never shown.

### 3. Learn `#learn`
- `--surface`. Rail starts here (its top aligns with the node). Stage: Page scene + segmented buttons + live note. Items: 2 open (no badge), 4 with "Building now" (04 §5.3 Not-open text). When `path` opens, Learn adds the real Path screenshot as a second stage under Page (caption per 04 §5.3), never replacing the hero.

### 4. Prepare `#prepare`
- `--paper`. Section badge under H2 (Building now). Stage: Papers + the Example row. Items: four H3s, no per-item badges (04 §5.4 note). When `examPrep` opens, swap the lead and drop the section badge; nothing else moves.

### 5. Contribute `#contribute`
- `--surface`. Section badge. Stage: Note and the gate with the live check list. Items: four H3s; the last links to `#earn`; under them "Read what you can and can't share" → `/terms`.

### 6. Teach `#teach`
- `--paper`. Stage: Bubble on the ladder with the level buttons. Items: Explainers (badge), Tutoring (status line as a 3 px `--line-strong` left rule, then the "Example price:" line, 15 px), Curating (After launch badge).

### 7. Earn `#earn`
- `--surface`. The rail ends at this node. Head: label, H2, "Launch rates, may change." (15 px 600 ink, plain text, not a badge), lead. Stage (desktop right column, sticky): Calabash scene + calculator. **Below, full width (aligned to the text column):** the earn table; cap note; "How your share of the pool is worked out" as a numbered list (32 px ink-ringed numerals, Bricolage 600) not cards; the worked example in a `--paper` box with a 4 px camwood left rule and the word "Example" first; "When money starts to move"; "Read our terms (contributor rules are added before any money moves)".
- **Earn table:** desktop real `<table>` (Way to earn as row headers, 15 px cells, hairlines); phone (<768) each row becomes a block: row header 17 px 600, then label/value pairs ("What you get", "Paid from", "Status") with 13 px 600 labels from `data-label`.
- Flags: status cells and the money lines per 04 §5.7; sandbox line appears only with `sandboxPayments`.

### 8. Trust `#trust`
- **Bench band** (`--bench`, same in both themes; §10 D5). Desktop 1 : 1: left H2, lead, five rows (H3 + body `#B9C3CF`, hairlines `--bench-line`), "Read how Ifiok uses AI" → `/ai`; right the engine stage (sticky), `--bench-2` with 1 px `--bench-line`, radius 8. Phone: text then the engine. The GitHub row appears only when the repo is public (OWN-H7).

### 9. Pricing `#pricing`
- `--surface`. H2 is the price statement. Desktop: a comparison table, column heads in Bricolage 800 22 px with the price under each in 15 px; **the Plus column sits on `--change-soft` with a 12 px radius** (the only tinted column; colour is not the only signal, the header names it). "No" in `--ink-2` text. Phone: each row is a full-width row header and three columns (Free · Plus · Units) with 13 px labels; the Plus cell keeps its tint. A "Price" row exists in the body for phone only (hidden ≥768 where the thead carries prices). Top-up line in ink, footnotes in `--ink-2`.

### 10. FAQ `#faq`
- `--paper`. Desktop 4 : 7, the H2 sticky on the left. Native `<details>`, rows ≥ 60 px, 17 px 600 summary, a 12 px ink chevron that rotates 180 ms; answers ≤ 64ch `--ink-2`. "For judges and developers" is a 15 px `--ink-2` line, not a heading, then its own list. Flag-gated answers per 04 §5.10.

### 11. Final CTA `#start`
- `--surface`. Desktop 1 : 1: H2 "Start with one topic tonight", lead, primary "Start learning free", the two-line under-button text; right the wordmark scene with Dot. Phone: text first, scene below at full width (max 520).

### Footer
- `--surface` with top hairline, 48 px padding (+76 px bottom on phones so the sticky bar never covers the last links). Left: wordmark 36 px, "Ifiok is Ibibio for wisdom and knowledge." (ink), "See it. Try it. Master it." (Bricolage 600 17 px), the AI disclaimer (15 px `--ink-2`). Right: 2-column link list, each link 44 px tall: Create account · Sign in · Terms of use · Privacy notice · How Ifiok uses AI · Privacy questions (mailto from `NEXT_PUBLIC_PRIVACY_EMAIL`; the mockup uses `privacy@example.invalid`) · Code on GitHub (when public). Bottom row "© 2026 Ifiok".

### Sticky mobile bar
- <768 only. Fixed bottom, `--surface`, top hairline, padding 10 px + safe-area. Left "Sign in" (underlined text link, 44 px); right primary "Start learning free" (48 px, flex 1, max 260 px). `role="region" aria-label="Start or sign in"`.
- Shows when the hero button has scrolled above the viewport and `#start` is less than 15% visible (two IntersectionObservers). Enters with `translateY(110%) → 0` over 220 ms `cubic-bezier(.2,.8,.2,1)`; hidden state is `visibility: hidden` and its button `tabindex=-1` so it's out of the tab order. Reduced motion: appears without the slide. No JS: never shows (the hero and final buttons are in the page). No layout shift: it overlays, and the footer's bottom padding reserves its height.

---

## 5. Badges and buttons

| Element | Spec |
|---|---|
| `Open now` | 28 px pill, 1 px `--line-strong`, 13 px 600 ink, leading 9 px **filled** `--built` dot |
| `Building now` | same pill, leading 9 px **ring** 2 px `--change` |
| `After launch` | same pill, text `--ink-2`, ring 2 px `--ink-3` |
| `Test run · PayPal sandbox` | same pill, text `--ink-2`, no dot, dashed 1 px `--ink-3` border (only while `sandboxPayments`) |
| Primary | `--change` fill, `--on-change` text 17 px 600, 52 px (48 in sticky bar), pill; hover `--change-hover`; press translateY(1 px); focus 2 px `--quantity` ring, 2 px offset. **One on screen at a time:** hero, then sticky bar (phone), then final |
| Outline | 44 px, 1.5 px ink border, ink text, hover `--paper` (header "Start free" only) |
| Text link | ink, 600, underline 1 px `--ink-3` offset 3 px; hover underline 2 px ink; arrow "→" is part of the text; 44 px tall where it stands alone |
| Stage pill buttons | 44 px, 1.5 px ink border, white; pressed = ink fill, white text, `aria-pressed` |
| Stepper | 44 × 44 − and + buttons with full labels ("Fewer students who used your uploads"), value in Bricolage 600 tabular |

---

## 6. Components for engineering

All server components unless marked **client**. Islands are lazy (`next/dynamic` with the resting SVG rendered on the server as the fallback, so there's no layout shift and no blank state).

| Component | Path (proposed) | Props | Kind |
|---|---|---|---|
| `LandingHeader` | `components/marketing/landing/Header.tsx` | — | server |
| `Wordmark` | existing `components/marketing/Brand.tsx` | `className` | server |
| `Hero` | `landing/sections/Hero.tsx` | `uploadOpen: boolean` | server |
| `TangentDot` | `components/marketing/demos/TangentDot.tsx` (evolve `TangentHero`) | `initialX = 1` | **client** (pointer, slider, readout) |
| `StatusBadge` | `landing/StatusBadge.tsx` | `status: "open" \| "building" \| "after" \| "sandbox"`, `label?: string` | server |
| `Journey` | `landing/sections/Journey.tsx` | `steps: JourneyStep[]` (from `lib/features.ts`) | server |
| `JourneyDot` | `illustrations/JourneyDot.tsx` | `count: 5` | **client** (hop on row hover/focus via event delegation on the list) |
| `InkLine` | `illustrations/InkLine.tsx` | `variant: "journey" \| "rail"`, `seed` (picks one of 4 brush paths) | server |
| `PathSection` | `landing/PathSection.tsx` | `id`, `step: 1–5`, `path: "learn" \| …`, `title`, `badge?`, `lead`, `stage: ReactNode`, `children` (items) | server |
| `PathItem` | `landing/PathItem.tsx` | `title`, `badge?`, `children` | server |
| `Stage` | `illustrations/Stage.tsx` | `path`, `hint?: string`, `children` | server |
| `PageScene` | `illustrations/PageScene.tsx` | — | **client** |
| `PapersScene` | `illustrations/PapersScene.tsx` | `example: string` | **client** |
| `NoteScene` | `illustrations/NoteScene.tsx` | `checks: string[]` | **client** |
| `LadderScene` | `illustrations/LadderScene.tsx` | `initial: 0–3 = 3` | **client** |
| `PoolScene` + `PointsCalculator` | `illustrations/PoolScene.tsx`, `demos/PointsCalculator.tsx` | `defaults: { uploads: 30, explainers: 12, all: 1400 }`, `cap: 0.2` | **client** (one island) |
| `EngineScene` | `illustrations/EngineScene.tsx` | `a = 2, b = 1.5, draft = 3.5` (draft is a fixed illustration of a wrong step; the checked value is computed) | **client** |
| `EarnTable`, `PriceTable` | `landing/sections/…` | rows from the shared constants that also feed JSON-LD | server |
| `Faq` | `landing/sections/Faq.tsx` | `groups` (flag-resolved answers) | server |
| `FinalCta` + `DotHome` | `landing/sections/FinalCta.tsx`, `illustrations/DotHome.tsx` | — | server + **client** (tiny) |
| `StickyCta` | `landing/StickyCta.tsx` | `heroId`, `endId` | **client** |
| `usePointerEyes` | `illustrations/usePointerEyes.ts` | one shared window listener for all eyes on the page | client hook, loaded with the first island |

Eyes need a shared module so the page installs **one** `pointermove` listener. Each island registers its `.eye` elements.

---

## 7. Interaction specs (summary)

| Moment | Trigger | Frames | Duration / easing | Reduced motion |
|---|---|---|---|---|
| Dot on the tangent | drag, slider, arrow keys | point, tangent, drop line, Dot transform, readout update every input | direct (no tween) | same |
| Dot hop (Journey) | pointerenter / focusin on a row | translateY to node | 380 ms `cubic-bezier(.34,1.45,.55,1)` | instant |
| Perk | hover / focus-visible on a scene | scale (1.03, 1.05) from feet | 180 ms `cubic-bezier(.2,.8,.2,1)` | none |
| Eyes | pointer move / tap | pupil offset ≤ 2.4 units | rAF, no easing | off |
| Page turn | tap / segment | content fade + scaleX 1 → .86 → 1 | 200 ms fade, 260 ms squash | instant swap |
| Papers deal | tap | 4 transforms, 50 ms stagger; ticks fade at 300 ms | 420 ms hop easing | instant |
| Note checks | tap | walk, 4 lamps + 5 rows at 260 ms steps, snippets | 380 ms then 4 × 260 ms | all at once |
| Bubble climb | level button | translate to step; banner fade | 420 ms hop / 200 ms | instant |
| Pool | stepper / input | You bowl fill height, outputs | instant | same |
| Engine check | button | readout, strike, note | instant | same |
| Dot home | tap | translate onto the ı | 420 ms hop | instant |
| Sticky bar | scroll observers | slide up | 220 ms | no slide |
| FAQ chevron | toggle | rotate 180° | 180 ms | instant |

Nothing animates on scroll and nothing loops. Every tween uses `transform`/`opacity` only.

---

## 8. Accessibility
- One H1; H2 per section; H3 per item (Journey step names are H3s). FAQ questions are `<summary>`.
- Every scene: either `aria-hidden` art inside a labelled `<button>` (the button says what happens) or `role="img"` with a full text alternative (hero plot: `<title>` + `<desc>` = 04's text summary; pool: 04 §5.14 alt). State changes are announced through a nearby `aria-live="polite"` note (Learn, Teach, Contribute checks, Trust, readout, calculator).
- All controls ≥ 44 px (badges are not controls). Visible focus: 2 px `--quantity`, 2 px offset; inside stages the outline is inset 4 px so it doesn't clip.
- Colour is never alone: badges add filled dot / ring / text; path colours always come with "Step n · Name"; ticks are shapes plus text rows; the Plus column is named in its header.
- Skip link "Skip to content" appears on focus (fixed, ink on surface, top-left).
- 200% zoom and 320 px: every layout is single-column below 1024; tables reflow to rows below 768; no horizontal scroll (mockup verified at 390, 768, 1280, 1440).
- Content visible without JS: every section and every resting frame is server HTML. Without JS the sticky bar never appears and the demos show their resting frame.
- Forced colours: outlines use `currentColor`-safe strokes; add `@media (forced-colors: active)` rules for stage fills → `Canvas`, strokes → `CanvasText` (not in the mockup).

## 9. Performance
- `/` stays static. Illustrations are inline SVG in server HTML (28 KB raw, 4.9 KB gz in the mockup). Client JS for all islands ≤ 10 KB gz (01 §3.8): the mockup's whole script is 10.8 KB raw, 3.7 KB gz. No animation library; CSS transitions plus one `animate()` call.
- Hero island hydrates first (it is the LCP neighbour, not the LCP: the H1 text is). Other islands load on idle or when within 400 px of the viewport. Pause the eye listener's work for off-screen eyes (done).
- Fonts: unchanged from `app/layout.tsx`; preload Bricolage 800 and Atkinson 400 only. JetBrains Mono is needed only in Trust: load it with `display: optional` or subset to digits and "–".
- No images, so no image bytes. Keep KaTeX CSS out of the root layout for `/` (01 §3.8).
- CLS: stages reserve their aspect ratio via the SVG viewBox; the sticky bar overlays.

---

## 10. Deviations from 07 (need a review-log entry)

| # | 07 says | This spec | Why |
|---|---|---|---|
| D1 | Page ground is `--paper` (cool grey) | Landing ground is `--surface` (near-white) with `--paper` as the alternating band | Every reference uses a white ground with tinted bands; it makes the coloured stages read cleanly. App screens keep `--paper` |
| D2 | Three role colours (quantity, change, built) | Two new identity hues on the landing page: palm yellow `--prep` and zobo `--teach`, plus `--path-*` aliases. **Earn = camwood**, although in-app "earned" is green | The owner asked for one colour per path. Path colours are identity, not role meaning; they always come with the step name. In the app, earnings amounts stay `--built` |
| D3 | Illustration: "subject diagrams, plots and lab scenes"; 04 lists mascots as something to avoid; 07 §2 avoids "pastel cartoon style" and "mascot guilt-trips" | A small cartoon cast ("the Marks") with faces, built only from learning objects, in flat saturated colours (not pastel), never used to guilt or nag | Owner decision. Keeping every character a subject object (the plot point, a page, papers) keeps 07's intent: the pictures still teach |
| D4 | Radius family 6 / 8 / 12 / 999 | Adds `--radius-stage` 24 / 32 for illustration stages | Industry-standard big rounded fields (uLesson, Quizlet, Khan). Nothing inside a stage uses it, so there are no cards-in-cards |
| D5 | Bench is for doing (labs, mocks) | The Trust band sits on the Bench, with JetBrains Mono for the engine readout | It *is* an instrument moment (the engine checking a step), and the page needs one dark rhythm break; the mono stays limited to the readout |
| D6 | Type scale tops out at 44 (mobile) | Desktop H1 56 px (`--text-5xl`) | Desktop display needs ≥ 3× body for hierarchy; phone stays at 32 |
| D7 | "Ink Line advance" is the single orchestrated motion | Plus small answer-motions in each scene (hop, deal, climb, page turn), all triggered by the visitor | Owner asked for illustrations that react. Nothing moves on its own or on scroll, so the rule's spirit (motion answers an action) holds |
| D8 | Illustrations use theme tokens | Illustration colours are fixed in both themes; stages switch to mid tints in dark mode | One drawing that never loses its outline in dark mode; ink on dark stages 8.7–10.9:1 |

Still banned and not used: gradients, glass, glows, sparkle icons, emoji, all-caps tracked labels, fade-up-on-scroll, drop shadows, stats strips, logos, testimonials, counts.

## 11. Questions (for `12` §4)
1. The current `TangentHero` has a "Check yourself: what is the slope at x = 1.5?" form after the first drag; 04 §5.1 doesn't list it. Keep it (it's real lesson behaviour) or drop it? Safer option in the mockup: dropped, so the hero stays short on phones.
2. Sign off the illustration microcopy in §3.4 (it isn't in 04).
3. "Points and Units: Building now" on Journey step 5 and in the Earn table, instead of a bare "Building now" (04 §5.2). Safer: name it, as in the mockup.
4. Teach's colour "zobo" `#A3366B`: confirm the hue, and that two new hues (D2) are acceptable outside the landing page later (Teach and Earn screens in Me).
5. Dot as a brand character: confirm with the designer commissioned for the logo (07 §3.2), since Dot is literally the tittle; the final logo must keep a round tittle for this to work.

## 12. Mockup and screenshots
- Page: `specifications/landing/mockups/index.html` (fonts in `mockups/fonts/`; Bricolage and JetBrains Mono load from Google Fonts).
- Phone first screen: `mockups/shots/r3/390.png`; desktop first screen: `mockups/shots/r3/1440.png`; full pages: `mockups/shots/r3/390-full.png`, `mockups/shots/r3/1440-full.png` (sliced as `-full-NN.png`); contact sheet `mockups/shots/r3/sheet.png`; dark: `mockups/shots/r3-dark/`.
- Interaction end states: `mockups/shots/states/` (hero steep and flat, learn screen 2, papers dealt, note checked, teach at Familiar, pool capped, engine checked, Dot home, journey hop).
- Scan (web-designer `shoot.mjs`, 390/768/1280/1440, light and dark): **0 FAIL**. One warning, kept on purpose: it reads the five Journey rows as an "icon + heading + paragraph card grid"; they are full-width rows on one line with status and a link each, which is what 04 §5.2 specifies.
