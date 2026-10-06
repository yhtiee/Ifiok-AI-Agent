# 05 · Lesson DSL, verification and lab engine

## 1. Why a DSL
AI outputs **data**, never code. A small, closed set of block types is rendered by our own React components. This gives us:
- **Safety:** no generated script runs on a student's phone.
- **Correctness:** every maths block is checkable before publishing.
- **Cost and speed:** a lesson is ~10–40 KB of JSON, cacheable offline, and renders fast on weak phones.
- **Consistency:** every lesson looks and feels like Ifiok, not like a different website each time.

The trade-off is expressiveness: some topics would benefit from a bespoke animation the DSL can't express. We solve that by adding block types and hand-built labs over time, not by letting the model write code.

## 2. Lesson structure

```ts
// packages/core/dsl/schema.ts (zod mirrors these types)
export const DSL_VERSION = 1;

type LessonSpec = {
  dsl_version: 1;
  title: string;                       // ≤ 70 chars
  objective: string;                   // one sentence, "You'll be able to…"
  subject_profile: 'stem' | 'social' | 'humanities';
  est_minutes: number;                 // 5–20
  screens: Screen[];                   // 6–12 screens (micro-lessons and previews: 3–6)
  summary: string[];                   // 2–4 bullets shown at the end
};

type Screen = {
  id: string;                          // "s1", "s2", … stable
  blocks: Block[];                     // 1–3 blocks: one idea per screen
};

type BlockBase = {
  id: string;                          // "s3b2", stable within a lesson
  source_refs?: number[];              // chunk ids backing this block
};
```

## 3. Block types (v1)

| Type | Fields | Rules |
|---|---|---|
| `prose` | `md` | Markdown subset: bold, italic, lists, inline maths `$…$`. ≤ 90 words. |
| `math` | `latex`, `display`; server adds `html` | KaTeX-renderable. At save time the server renders KaTeX (`trust: false`, `output: 'htmlAndMathml'`) into `html`, so the client ships only KaTeX CSS and fonts. This is our own renderer's output from validated LaTeX, so it is not "AI-generated HTML". |
| `callout` | `variant: tip \| mistake \| exam \| realworld`, `md` | ≤ 50 words. `exam` callouts never predict questions. |
| `plot` | `x: [min,max]`, `y?: [min,max]`, `functions: [{expr, role: quantity\|rate\|area\|neutral, label}]`, `params: [{name, min, max, step, value, label, unit?}]`, `annotations: Annotation[]`, `caption`; server adds `compiled` | `expr` in mathjs syntax using x and params only; ≤ 3 functions; ≤ 3 params. At save time the server parses every expression (and derivatives needed for `tangent`/`area` annotations) into a vetted **AST JSON** (`compiled`), which the client evaluates with a ~3 KB interpreter (`packages/core/expr-eval`). No mathjs on the lesson route. |
| `stepper` | `steps: [{latex, mathjs?, why}]`, `check: equivalence \| equation \| none` | 2–8 steps; `why` ≤ 25 words; checked per §6. |
| `diagram` | `nodes: [{id, label, x, y, shape: box\|circle\|pill}]`, `edges: [{from, to, label?, style: solid\|dashed\|arrow}]`, `caption` | Coordinates on a 0–100 grid; ≤ 12 nodes; we render the SVG. |
| `table` | `columns: string[]`, `rows: string[][]` | ≤ 6 columns × 8 rows. |
| `timeline` | `events: [{when, label, detail?}]` | ≤ 10 events. |
| `compare` | `left: {title, points[]}`, `right: {title, points[]}` | ≤ 5 points each. |
| `reveal` | `prompt`, `md` | Tap to reveal; for "predict, then see". |
| `flashcards` | `cards: [{front, back}]` | ≤ 8 cards. |
| `source_quote` | `chunk_id`, `quote`, `page` | Quote ≤ 40 words, must appear in the chunk text. |
| `sim` | `lab` (registry slug), `params`, `caption` | `params` validated by the lab's own schema. |
| `checkpoint` | `item: InlineItem`; server adds `item_id` | See §4. At least 2 per lesson. On publish, each checkpoint is materialised as an `items` row (`origin = 'checkpoint'`, unique on `lesson_id, block_id`) and its id written back, so attempts, mastery and reviews work the same as for practice items. |

`Annotation`: `{kind: 'point', x_expr}` · `{kind: 'tangent', at_expr, of}` · `{kind: 'secant', from_expr, to_expr, of}` · `{kind: 'area', of, from_expr, to_expr}` · `{kind: 'vline'|'hline', value_expr}`. All `*_expr` are mathjs expressions in the params.

Roles map to the colour system (`07`): `quantity` = blue, `rate` = camwood orange, `area` = green.

## 4. Items (practice questions)

```ts
type InlineItem =
  | { type: 'mcq'; stem_md: string; options: {id: string; md: string; why: string}[]; correct: string }
  | { type: 'numeric'; stem_md: string; answer_expr: string; stated: number; unit?: string; tolerance?: {rel?: number; abs?: number}; why: string }
  | { type: 'expression'; stem_md: string; answer_expr: string; vars: string[]; domain?: Record<string, [number, number]>; why: string }
  | { type: 'short_text'; stem_md: string; key_ideas: string[]; why: string }      // AI-checked, labelled estimate
  | { type: 'order'; stem_md: string; steps: string[]; why: string }               // correct order = given order; shuffled at render
  | { type: 'match'; stem_md: string; pairs: [string, string][]; why: string };
```

Stored items (`items` table) use the same shapes in `stem`/`answer`/`verification`. `micro_skills` tag every item (controlled vocabulary).

**Two independent checks before an AI item is published** (`items.status` starts as `review`):
1. **Self-consistency:** `evaluate(answer_expr)` must equal `stated` (within tolerance).
2. **Independent solve:** a second, separate `item_solve` call (`04` §4.3; different prompt, no access to the first answer) solves the item; for numeric/expression items its answer must match by the equivalence rules in §6; for `mcq` it must pick the same option. `order`, `match` and `short_text` items always go to human review in P1.
Items that pass both are auto-published; the rest go to the review queue or are dropped. In the curator review UI, numbers that appear in `prose`, `table`, `callout` and `flashcards` blocks are highlighted for the human reviewer, because the engine can't check them.

**Tutor blocks:** the tutor may emit only `math`, `stepper`, `plot` and `checkpoint` (flat schema, `04` §4.1). Lessons use the full set.

## 5. Rendering rules
- **Load per block type:** the lesson shell loads only the renderers the current lesson uses, through `next/dynamic` (Mafs for `plot`, MathLive only when an `expression` item appears, labs only for `sim`). KaTeX CSS is the only maths asset on every lesson.
- The client uses `zod/mini` for validation; full `zod` stays on the server.
- One screen at a time with a fixed bottom bar: **Check** / **Continue** (Brilliant pattern, see `07`).
- Interactive blocks must be touched before Continue unlocks on that screen ("Drag the slider to see what happens").
- Checkpoint feedback appears in a bottom sheet: verdict, the `why`, and "Explain differently" (calls the tutor with this block as context).
- Every block has a "⋯" menu: Flag (F2-FR5), Copy, "Ask about this".
- Renderer is resilient: an unknown block type renders a neutral "This part needs an app update" card and logs to Sentry; it never crashes the lesson.

## 6. Verification (`packages/core/verify`)

All checks use **mathjs** with a restricted parser:
- Allowed: numbers, variables `[a-zA-Z]` and `[a-zA-Z]_[0-9a-z]+`, operators `+ - * / ^`, parentheses, functions `sin cos tan asin acos atan sinh cosh tanh exp log sqrt abs floor ceil min max` (`ln` is accepted and rewritten to `log`, which is natural log in mathjs), constants `pi e`. Unit names (e.g. `ohm`, `mA`) are allowed symbols only when the item sets `unit`.
- Forbidden: assignment, function definition, `import`, `evaluate`, `parse`, `createUnit`, matrices, objects, ranges and any function not listed above (v1).
- **How:** every expression from AI or a student is parsed with `math.parse`, then the AST is walked and rejected unless every node is a `ConstantNode`, `ParenthesisNode`, `OperatorNode` (`+ - * / ^`, unary minus), a `SymbolNode` in the allowed variables/constants, or a `FunctionNode` whose name is in the allow-list. Only then is it compiled. Verifier code itself may call `derivative` and `simplify` on vetted ASTs; untrusted text never reaches those calls without the walk. Also apply mathjs's documented hardening (override `import`, `createUnit`, `evaluate`, `parse` in the instance used by the tutor's `math_evaluate` tool).
- Inputs are capped at 500 characters and AST depth 40 to stop pathological expressions.

**Equivalence** `equivalent(a, b, vars, domain?)`:
1. Draw seeded random points from `[-5, 5]` per variable (or the declared `domain`) until **8 valid points** are found, trying at most 64. A point is valid when both sides are finite and real.
2. If fewer than 8 valid points were found in `[-5, 5]`, retry once on `(0, 5]` (covers `sqrt`, `log`).
3. Pass if `|a−b| ≤ 1e-9 + 1e-6·max(|a|,|b|)` at every valid point.
4. Fewer than 5 valid points in the end → `unknown` (never `true`).

**Step checking** (steppers and snap-and-mark) returns one of three outcomes per step, never just pass/fail:
- `ok`: the step is equivalent to the previous one (expression rule above), or for equations `L_k = R_k`, `D_k = L_k − R_k` and `D_{k+1}` are proportional by a non-zero constant across samples, **or** their real roots in `[-10, 10]` match.
- `ok` (implication): every root of line k is still a root of line k+1 (e.g. squaring both sides: `x = 2 → x² = 4`), or the step substitutes a value or definition stated earlier. Extra roots are allowed; **lost roots are not**.
- `wrong`, for equations: some real root of line k in `[-10, 10]` is missing from line k+1 (unless a declared domain excludes it), e.g. `x² = 4 → x = 2` loses −2. `±` answers are transcribed as `x = 2 or x = -2` (or as two lines), and `x² = 4 → x = 2 or x = −2` is `ok`.
- `wrong`, for expressions (no `=`): not equivalent at ≥ 5 valid points.
- `unchecked`: anything else (text lines with `mathjs: null`, definitions like `let u = x²`, too few valid samples). Shown as "Couldn't check this line", never deducted.
- A line that starts with `=` continues the previous line: it is read as `previous right-hand side = this expression`.
Marks are awarded up to the first `wrong` step only. The "zero correct solutions marked wrong" gate (`11`) applies to `wrong` outcomes.

**Derivatives:** `mathjs.derivative(f, x)` vs claimed `f'` via equivalence.
**Antiderivatives:** `derivative(F, x)` vs `f` via equivalence.
**Definite integrals:** composite Simpson's rule (n = 2,000) vs claimed value, tolerance 1e-4 relative.
**Numeric answers:** expected value = `evaluate(answer_expr)`; it must match `stated`, and the independent solve (§4). Disagreement → item dropped or sent to review.
**Plots:** each `expr` evaluates to a finite real at ≥ 50% of 200 samples across `x` for the default params; the renderer breaks the line at non-finite points (so `1/x` and `log(x)` draw correctly).
**Source quotes:** `quote` must be a substring of the chunk text (whitespace-normalised).

Publishing gate: a lesson can move to `review` only when every check returns `true` (or `unknown` on a block explicitly marked `check: 'none'` with a reason).

## 7. Example (v1 lesson, abridged to 3 screens)

Abridged for reading: a real lesson has 6–12 screens, so the schema rejects this exact JSON. P0-07 turns it into a full 6-screen fixture (`content/fixtures/slope-of-a-curve.json`). Server-added fields (`html`, `compiled`, `item_id`) are omitted.

```json
{
  "dsl_version": 1,
  "title": "The slope of a curve",
  "objective": "You'll be able to find the slope of y = x² at any point.",
  "subject_profile": "stem",
  "est_minutes": 8,
  "screens": [
    { "id": "s1", "blocks": [
      { "id": "s1b1", "type": "prose", "md": "A straight line has one slope everywhere. A curve's steepness keeps changing. Drag the point and watch the orange line." },
      { "id": "s1b2", "type": "plot", "x": [-3, 3], "y": [-1, 9],
        "functions": [ { "expr": "x^2", "role": "quantity", "label": "y = x²" } ],
        "params": [ { "name": "a", "min": -2.5, "max": 2.5, "step": 0.05, "value": 1, "label": "Point x" } ],
        "annotations": [ { "kind": "tangent", "at_expr": "a", "of": "x^2" } ],
        "caption": "The orange line touches the curve at one point: the tangent." }
    ]},
    { "id": "s2", "blocks": [
      { "id": "s2b1", "type": "stepper", "check": "equivalence", "steps": [
        { "latex": "\\frac{(x+h)^2 - x^2}{h}", "mathjs": "((x+h)^2 - x^2)/h", "why": "Slope between x and x + h." },
        { "latex": "\\frac{2xh + h^2}{h}", "mathjs": "(2*x*h + h^2)/h", "why": "Expand; the x² terms cancel." },
        { "latex": "2x + h", "mathjs": "2*x + h", "why": "Divide each term by h." }
      ]}
    ]},
    { "id": "s3", "blocks": [
      { "id": "s3b1", "type": "checkpoint", "item": {
        "type": "numeric", "stem_md": "What is the slope of $y = x^2$ at $x = 1.5$?",
        "answer_expr": "2*1.5", "stated": 3, "why": "The slope is 2x, and 2 × 1.5 = 3." } }
    ]}
  ],
  "summary": ["The slope of a curve at a point is the slope of its tangent.", "For y = x², the slope is 2x."]
}
```

## 8. Lab engine

```ts
// components/labs/registry.ts
export interface LabModule<P, R> {
  slug: string;                        // 'ohms-law', 'pc-build'
  title: string;
  subject: string;                     // 'physics', 'computer-hardware'
  engine: '2d' | '3d';
  paramsSchema: z.ZodType<P>;          // what lessons/AI may configure
  reportSchema: z.ZodType<R>;          // what a run produces
  stations: { id: string; title: string }[];
  load: () => Promise<{ default: React.ComponentType<LabProps<P, R>> }>; // dynamic import
  fallback2d?: () => Promise<{ default: React.ComponentType<LabProps<P, R>> }>;
}

interface LabProps<P, R> {
  params: P;
  seed: number;                        // reproducible hidden values (e.g. true resistance)
  mode: 'embed' | 'full';
  onEvent: (e: LabEvent) => void;      // analytics + plan completion
  onComplete: (report: R) => void;     // saved to lab_runs
}
```

**Rules**
- Physics and simulation logic lives in pure functions (`labs/<slug>/model.ts`) with unit tests; the UI only renders the state.
- Hidden values come from `seed` (seeded PRNG), so runs are reproducible for marking and support.
- Every lab has an accessible text mode (steps list plus readings table) and a 2D fallback if it is 3D.
- **P1a labs (2D):** `ohms-law` (port from the Ohm's law prototype) and `simple-pendulum` (PHY 107: measure period vs length, plot T² against L, find g; with reaction-time error and amplitude effects).
- **P1b lab (3D):** `pc-build` (port from the three.js prototype; 2D fallback = top-down board with tap-to-place), for computer-engineering and CSC courses.
- **P3 candidates:** `supply-demand` (economics), `trial-balance` (accounting), `titration`, `logic-gates`, `moot-court` (an AI role-play lab: the only lab using the LLM at runtime, with strict scripts).

**3D guidelines** (`pc-build` and later)
- @react-three/fiber with `frameloop="demand"` when idle (saves battery); DPR capped at 1.75; one shadow-casting light at 1,024 px shadow maps only when `deviceMemory ≥ 4`.
- Procedural geometry in P1 (no external models). Later models: glTF with Draco/Meshopt compression, ≤ 400 KB each, served from `public-assets`.
- Held part rendered in an overlay scene so it is never hidden (as in the prototype).
- Dispose geometries and materials on unmount; test for memory growth across 5 enter/exit cycles.
