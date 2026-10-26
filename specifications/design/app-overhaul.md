# App overhaul · minimalist student app (Stage 1 · MVP)

Owner brief (24 Oct 2026): "Students would be confused on what to do and how to do it." This spec redesigns the signed-in student app (`app/(app)/**`) so it shows **only what works today**, gives every screen one job and makes the next action obvious. Build it with shadcn/ui on the existing tokens. It changes **no** product rule, guardrail, API or data. The landing page (`app/(marketing)`, `components/marketing/**`) is out of scope: do not touch it.

Binding sources: `CLAUDE.md` (Product shape, Hard guardrails, UI rules), `07-brand-ui-ux.md` §3.3–§3.4, §5–§7. Where this spec departs from `07` §4/§5 (nav without Practice, no Path sheet, course tabs) or from `12` §4 Q49 (practice count on the Path), add one review-log entry (Q50, "App overhaul") before merging, citing this file.

**Live today** (`lib/features.ts` `open: true`): course, topic, outline, sharedLessons, upload, path, privateLessons; plus sign-in, onboarding and Me. Everything else is hidden in the app: no "Opens soon", no "Soon", no greyed rows, no teaser copy.

---

## 1. Diagnosis

| # | Problem | Where |
|---|---|---|
| D1 | Today offers six ways to start, two of them dead ("Learn from your textbook", "Set a goal" render "Opens soon"). Five of the six lead to the same `/courses` search. A new student can't tell which to pick. | `app/(app)/today/page.tsx` `START_OPTIONS`, `OpensSoon` |
| D2 | The setup checklist includes "Set a goal" (not live), so it can never reach "5 of 5". Two of its steps are always done (account, profile) and add nothing. | `lib/learning/setup.ts`, Today "Get set up" |
| D3 | "Your progress" shows study streak and topics mastered, but nothing writes `daily_activity` or `mastery` until `/api/sync` (MVP-03), so they always read 0. "Daily goal: 30 min" drives nothing yet. | Today "Your progress" |
| D4 | A Practice tab sits in the bottom nav and sidebar and opens two empty panels. That's a dead end on a quarter of the nav. | `components/app/AppNav.tsx` `NAV_ITEMS`, `app/(app)/practice/page.tsx` |
| D5 | The desktop sidebar lists four "Learning tools", all marked "Soon" (Ask Ifiok, Labs, Snap and mark, Library). | `AppShell.tsx` `TOOLS`, `SidebarTools` |
| D6 | The course page lists the same topics twice (Path, then the Outline panel), followed by Materials and History. On a 360 px phone that's four stacked panels and about six screens of scrolling. Both lists link to the same lessons. | `app/(app)/courses/[id]/page.tsx`, `CoursePath`, `OutlineWorkspace`, `CourseWorkspace` |
| D7 | Outlines can be added in two places: the Outline panel (photo/PDF/type/draft) and Materials → "Course outline". The second one quietly scrolls the student back to the first. | `MaterialsPanel` kind `outline`, `CourseWorkspace.onExtracted` |
| D8 | Adding materials can start from Today (`/materials/add`), from the course's Materials panel, or from the bottom of a topic's lesson page. Each looks different, and the topic version sits under the lesson, where nobody scrolls. | `AddMaterialsFlow`, `MaterialsPanel`, `app/(app)/learn/[id]/page.tsx` |
| D9 | Path rows say "9 practice questions ready", but no screen exists to answer them (MVP-03). That's a promise with no way to act on it. | `CoursePath.PathNode` |
| D10 | Before the student has started, the lesson player shows "Key takeaways" (the answers) next to the screen. It has two navigations (dot pager plus a "Screens" list) and a "Checkpoint" chip. Buttons carry text glyphs ("Next screen →", "Finish lesson ✓"). The action bar scrolls away instead of staying in the thumb zone. | `components/lesson/Player.tsx` |
| D11 | The header repeats the Me avatar and a greeting on every page, while the bottom nav already has Me and the desktop sidebar footer already has the profile. That's three routes to Me on one screen. | `AppPage.tsx`, `AppShell.tsx` |
| D12 | Loading uses spinners ("Searching courses…", "Reading your outline…") instead of skeletons, and several states show the same generic Panel title ("Your lesson"). | `LearnSearch`, `OutlineWorkspace.SetupChoice`, `GenerationWaiting` |

## 2. Principles

1. **Show only what works.** If a feature's flag is closed, nothing about it appears in the app. A ticket that ships a feature adds its UI then.
2. **One job per screen, one camwood button per view.** Secondary actions are outline buttons or text links. Rare actions go in an overflow menu.
3. **The next action is always obvious.** Today and the course page both lead with a single "Next" block that has its button in the thumb zone.
4. **Say each thing once.** A list of topics appears once per screen. Every action has one home, and other screens link to that home.
5. **Lists, not cards.** Use full-width rows separated by 1 px `--line`. Don't nest bordered boxes and don't build grids of tiles.
6. **States are part of the design.** Every async view gets a skeleton (matching the final layout, static), an empty state (one sentence, one action), a building state (step list) and an error that says what happened and how to fix it.
7. **Few components, used the same way everywhere.** Build from the shadcn set in §5.0 and nothing else.

## 3. Information architecture

### 3.1 Navigation
- **Phone bottom bar (below `lg`), 3 items:** Today (`SunHorizonIcon`) · Courses (`BooksIcon`) · Me (`UserCircleIcon`). It uses `grid-cols-3` with labels always visible, `min-h-16`, the active item in `--quantity` with a `fill` icon plus `aria-current="page"` (colour plus weight, never colour alone), and `pb-[env(safe-area-inset-bottom)]`.
- **Desktop sidebar (`lg+`, 15rem):** wordmark → Today, Courses → spacer → footer row (avatar initial + name, links to `/me`) → "Sign out". The "Learning tools" section is deleted, along with `SidebarTools` and `TOOLS`.
- **Page header (`AppPage`):** phone shows the back button and the current title only, desktop shows breadcrumbs. Remove the avatar link and the greeting from the header everywhere. The greeting moves into Today's title area.
- **No Ask Ifiok button, no FAB, no command menu.** None of those are live.

### 3.2 Routes

| Route | Fate |
|---|---|
| `/today` | Stays. Rebuilt (§5.1). |
| `/courses` | Stays: search plus your courses and topics (§5.2). |
| `/courses/new` | Stays (§5.3). |
| `/courses/[id]` | Stays, rebuilt with tabs **Path · Materials** (§5.4). |
| `/courses/[id]/outline` | **New**: the outline editor and history move here out of the course page (§5.5). Same components (`OutlineWorkspace` edit modes, `OutlineEditor`, `OutlineHistory`), same APIs. |
| `/learn/[id]` | Stays: lesson, building and waiting states (§5.6). The materials panel under the lesson is removed. |
| `/materials/add` | Stays as the **only** add-materials flow (§5.7). Every "Add materials" button links here with `?course=` or `?topic=`. |
| `/me` | Stays (§5.8). |
| `/practice` | **Removed from the UI.** Replace the page with `redirect("/today")` so old links and bookmarks still work. MVP-03 rebuilds it. |

Keep `lib/features.ts` as the source of truth. In app code, render a feature's entry point only when `FEATURES[key].open` is true. With today's flags that means none of the closed ones. Delete every `Opens soon`/`Soon` branch from `app/(app)` and `components/app`.

## 4. Core flows

### (a) First run after onboarding → first course with an outline
1. **Onboarding "Minutes" → `/today`** (existing redirect). Today has no courses or topics, so it shows the **Start** state: heading "What are you studying?", one line, camwood **Find your course**. A text link below reads "Or learn a single topic". Both go to `/courses?focus=1`; the link adds `&mode=topic`, which changes only the placeholder.
2. **`/courses`**: the search field is focused on open. The student types "MTH 101". Results load as a skeleton (2 rows), then appear in groups: *Courses at {university}*, then the row "Add MTH 101 at {university}". Tapping a course opens it. Tapping **Join** on a course row joins it and opens it. **One tap.**
3. **No match → "Add MTH 101" → `/courses/new`** with the code prefilled. The camwood button is **Add course**. If the course already exists or looks similar, a Dialog-free inline step offers **Join this course** (camwood) or "None of these: add MTH 101" (outline button). Then go to `/courses/[id]`.
4. **Course page with no outline:** the Path tab shows the **Set up** block: "Add your course outline". Camwood **Snap or upload outline**, then two outline rows: "Type the topics" and "Draft one for me". Busy states replace the row text with "Reading your outline…" or "Drafting an outline…" plus "This can take up to 30 seconds." Use no spinner icon (`aria-busy`) and disable the other choices. A PDF opens the page picker (§5.7 step 3, in "outline" mode, confirm "Read topics").
5. **Check and save** in the outline editor (full screen at `/courses/[id]/outline?start=upload|typed|draft`). Camwood **Save outline**. On success the student lands back on `/courses/[id]` with a Sonner toast: "Outline saved." (or "Saved. It goes live once another member confirms it." when pending). The Path now lists the topics, and Next up is topic 1.
- *Errors:* "Couldn't find topics there. Retake the photo in good light with the whole outline in the frame, pick the pages that list the topics, or type them." This is the existing copy, shown inline with `role="alert"` above the choices.

### (b) Learn a single topic without a course
1. Today → **Find your course** (or the "Or learn a single topic" link) → `/courses`. Type "Fourier series".
2. The last result row is **Learn "Fourier series" as a topic**. Tap it, and while it resolves the row reads "Finding the topic…" (`aria-busy`). If the topic is too broad, chips with narrower topics appear under the field: "'Physics' covers a lot. Pick a narrower topic to start with:".
3. **`/learn/[conceptId]`**: if a shared lesson exists the player opens at screen 1. If not, the **Building** state shows: title "Building your lesson", the 4-step list and "{n}s · usually under 2 minutes". The quick explanation sits above the steps on the phone, labelled "Quick explanation while you wait". When the job settles the lesson replaces the state in place, with no reload.
4. *Waiting / review / failed:* one EmptyState with the server's message. When `canRetry` is set, it adds camwood **Try again**.
5. The topic now appears under "Topics you follow" on Courses and in Today's list.

### (c) Add notes to a course → lessons from my notes appear on the Path
1. Today → course row (or Courses → course) → **Materials** tab → camwood **Add materials** → `/materials/add?course={id}`. That's two taps from Today to the add flow.
2. **What is it?** A RadioGroup with Lecture notes · Textbook pages · Past questions · Lab manual. "Course outline" is removed here because outlines live only on the outline page. A one-line privacy note follows (existing copy per kind).
3. **Add how?** Camwood **Choose a PDF** and an outline button **Paste text**.
4. **Pick pages** (PagePicker: thumbnails, range, "No text found" pages disabled) plus a **Name** input. Camwood **Add {n} pages**. While it works, the button reads "Adding…" with `aria-busy`.
5. **Success** → `router.push("/courses/{id}?tab=materials")` and a toast with the existing notice text: "Added 'X': 12 pages. It's searchable now and ready for lessons in a minute or two." The skipped and redacted counts are appended when they're non-zero.
6. **Materials tab:** the row shows "Processing" (hourglass icon plus text), which changes to "Ready" (check icon, `--built`). The **Path** tab polls while anything is processing (existing `CoursePath` logic, unchanged). Covered topics show "Building from your notes", then "Lesson from your notes" in `--quantity` with a `NotebookIcon`. The Path header reads "{n} from your notes".
7. Opening such a topic plays the private lesson with "From your notes, p. N" citations.
- *Empty:* with no courses or topics, `/materials/add` shows "First, add a course or a topic" and camwood **Find your course**.
- *Error:* inline `role="alert"` under the step's controls, using the existing `ApiError` messages. A material whose processing failed shows the row status "Couldn't finish: delete and add again" (warning icon plus `--bad` text).

### (d) Daily return → continue where I left off
1. Open the app → `/today` (the root redirect for signed-in users is unchanged). Today shows the **Next** block (§5.1) for the student's most recent course.
2. "Most recent" means the course whose topic the student opened last on this device. Store `{ kind, courseId?, conceptId, title, at }` in `localStorage` key `ifiok.lastOpened` when `/learn/[id]` mounts, wrap every read and write in try/catch, and drop it if that course or topic is no longer in the student's list. Without a stored value, fall back to the newest `enrollments.created_at`, then the newest `concept_follows`. This is a per-device convenience only: never use it for rewards, streaks or progress (guardrail 6). It's replaced by server `screen_events` when MVP-03 lands.
3. If the last opened topic still exists, the block reads "Continue" and shows the topic title, with camwood **Continue {topic}**. Otherwise it reads "Next up" and shows the Path's `nextUp`, with camwood **Start {topic}** (or **Start lesson** if the title is longer than 28 characters, as now). One tap opens the lesson.
4. The rest of Today is a short list of the other courses and topics, each with its Next up topic, one tap each.
- *Loading:* Today is server-rendered, so there's no skeleton on first paint. The Next block's lesson-state line may refresh client-side.
- *Building:* if the Next topic's lesson is building, the line says "Lesson building" and the button still opens the lesson, where the building state shows.

## 5. Screen specs

### 5.0 Component set (shadcn/ui, `components/ui/*`)
Install with the shadcn CLI into `components/ui` (lower-case files; keep `button-styles.ts` as the server-safe class source, regenerated from the shadcn Button's `cva`). Use **only**: `Button`, `Input`, `Textarea`, `Label`, `RadioGroup`, `Select`, `Form` (react-hook-form + zod resolver; the schemas reuse the existing zod limits such as `MATERIAL_LIMITS` and `NAME_MAX`), `Tabs`, `Command` (inline, `shouldFilter={false}`, results from the server), `Sheet` (side="bottom" on phone, used only for the outline History on phone), `AlertDialog` (delete material, discard outline edits), `DropdownMenu` (the course overflow), `Skeleton`, `Badge` (only for "Draft"), `Progress` (lesson progress), `Separator`, `Sonner` (one `<Toaster>` in `app/(app)/layout.tsx`, bottom-centre above the nav, `offset` 88 px on phone), `Breadcrumb` (desktop header). Do not add Card: a bordered section is the existing `Panel`, restyled with tokens (border, `--radius-card`, no shadow). Do not use Accordion, Carousel, Avatar images, HoverCard, Tooltip (taps don't hover), or Toggle groups.

**Lists:** a single `RowList` (new, in `components/app/Page.tsx`) renders `<ul>` with `divide-y divide-line`. Each row is a `Link` or `button` with `min-h-14`, a leading 40 px icon disc (`--quantity-soft`/`--quantity` for courses, `--built-soft`/`--built` for topics), a title line, a `text-sm text-ink-2` meta line and a trailing `CaretRightIcon`. Every list in this spec uses it.

**Primary placement:** on phones the view's camwood button sits in a sticky bottom bar (`sticky bottom-[calc(4rem+env(safe-area-inset-bottom))]`, `bg-paper/surface` with a top `--line`, full-width button, 16 px gutters). In the lesson player the bar is `bottom-0` because the bottom nav is hidden there (see 5.6). On desktop the button sits inline at the end of its block.

### 5.1 Today (`/today`)
**Phone (360):**
1. Title area, which is not a Panel: date (`text-sm text-ink-2`, "Friday 24 October"), then H1 in Bricolage 28 px: "Good morning, Ada" (existing `greeting()`).
2. **Next block** (one Panel, no title bar): label "Continue" or "Next up" (`text-sm text-ink-2`), the topic title (`text-lg font-semibold`), and the meta line "{course code} · {lessonStateText} · {mastery label}" (e.g. "MTH 101 · Lesson from your notes · Not started"). The camwood button goes in the sticky bottom bar: **Continue {topic}** / **Start {topic}**.
   - Course has no outline → label "Set up", title "Add the {code} outline", meta "Topics become your Path", camwood **Add outline** → `/courses/{id}`.
3. **Your learning** (H2 `text-base font-semibold`, no panel border, `RowList`): up to 5 rows, courses first, then topics, excluding the one in the Next block. A course row shows "{code} · {title}" with the meta line "Next: {topic}" or "No outline yet". A topic row shows the title with meta "Topic". Under the list sits the quiet link "All courses" → `/courses`.
4. Nothing else: no setup checklist, no stats, no "other ways to start".

**Start state** (no courses, no topics): title area, then EmptyState (Ink Line stroke) "What are you studying?" / "Find your course at {university} and Ifiok turns its outline into a path of lessons." Camwood **Find your course** (sticky bar), and the text link "Or learn a single topic". Without a university, the copy reads "Type any topic and Ifiok builds a lesson you can move." with camwood **Learn a topic** → `/courses?focus=1&mode=topic`.

**Desktop:** one column, `max-w-[90rem]`. The Next block and the list stay full-width rows, not a two-column grid of panels. The button sits inline on the right of the Next block.

**Data:** `getMyCourses`, `getFollowedTopics`, `getCoursePath` for the Next course only (one call). Delete `getSetupSteps` and the Today use of `getLearningSummary` (the files can stay for MVP-03).

### 5.2 Courses (`/courses`)
**Phone:**
1. H1 "Courses". No description.
2. **Search** with shadcn `Command` rendered inline (not in a dialog). It has a `CommandInput` labelled "What do you want to learn?" (the visible label is `text-lg font-semibold`), placeholder "A course code like MTH 101, or any topic" (or "Any topic, like Fourier series" without a university / with `mode=topic`), `autoFocus` when `?focus=1`, and a 250 ms debounce (as now). The list appears once 2 or more characters are typed:
   - `CommandGroup` "Courses at {university}": rows with code · title and "{n} classmates". The trailing control is an outline **Join** button (or "Open" for courses the student is in). While loading, show 2 `Skeleton` rows (h-14) instead of "Searching…".
   - `CommandItem` "Add {CODE} at {university}" (PlusIcon, `--change-soft` disc) → `/courses/new?code=`.
   - `CommandItem` "Learn '{term}' as a topic" (TargetIcon, `--built-soft` disc), with meta "No course needed".
   - The too-broad notice and chips go under the input, as now (chips are outline buttons with `rounded-full`, `min-h-11`).
   - Hint when empty: "Search your course at {university}, or type any topic, like 'Fourier series'."
3. **Your courses** (H2 + `RowList`), meta "{n} topics" or "No outline yet". Empty: hide the section (the search above is the action).
4. **Topics you follow** (H2 + `RowList`). Empty: hide the section.
- No camwood button on this screen: the search field is the action. The "Add …" row uses a `--change-soft` icon disc only.

**Desktop:** search full-width, then the two lists side by side (`lg:grid-cols-2`), each a plain list with its heading. No panels around them.

### 5.3 New course (`/courses/new`)
A single `Form` (react-hook-form + zod: code 2–12, title 2–120, subject required, level optional), `max-w-2xl`, left-aligned.
- H1 "Add a course". Description: "At {university}. Classmates who search for it will join you."
- Fields: **Course code** (`Input`, `autoCapitalize="characters"`, hint "As on your timetable"), **Course title** (`Input`), **Subject** (`Select`, placeholder "Choose a subject"), **Level** (`Select`, default from the profile, first option "Not sure").
- Camwood **Add course** (pending: "Checking…").
- Exists / similar step: replaces the form in place with H2 "{CODE} is already on Ifiok" or "Is it one of these?" and a `RowList` where each row's trailing control is **Join this course**. In the "similar" case the camwood button is **None of these: add {CODE}** and each Join is an outline button. In the "exists" case the single row's Join is camwood. Add the quiet link "Change the details".
- Errors: field messages under each field (`FormMessage`, `aria-live`), and server errors as one `role="alert"` line above the button.

### 5.4 Course page (`/courses/[id]`)
**Header block:** H1 "{CODE} · {title}". Meta line "{university} · {n} classmates · {level}". On the right, a `DropdownMenu` trigger (`DotsThreeIcon`, 44 px, `aria-label="Course options"`) with: **Edit outline** → `/courses/{id}/outline`, **Outline history** → `/courses/{id}/outline#history`. Show the menu only to members, and when the course is locked show only "Outline history".

**Not a member:** below the header there are no tabs. Show the topic list (read-only `RowList`, rows link to lessons so anyone can learn) and an intro line: "Join to add materials and help keep the outline right." Camwood **Join course** goes in the sticky bar.

**Member, no outline:** no tabs. Show the Set up block from flow (a) step 4 only.

**Member with an outline:** `Tabs` with **Path** (default) · **Materials ({n})**. The selected tab is kept in `?tab=` so the toast redirect from §5.7 lands on Materials.
- **Path tab:**
  1. Draft banner (only when `isDraft`): a dashed `--change` border row, `Badge` "Draft", text "Check it against your course.", with an outline button **Check outline** → `/courses/{id}/outline`. The current inline "It matches my course" confirm moves to the outline page.
  2. Locked note (only when locked): `LockSimpleIcon` "Outline locked by your lecturer."
  3. **Next up** row (no inner box: a top-level row with a 3 px `--change` left edge), "Next up" plus title plus "{lessonStateText} · {mastery}". The camwood button **Start {topic}** goes in the sticky bar.
  4. The **Path** list (`CoursePath`, kept): the Ink Line nodes with the meta line "{Week n | Topic n} · {lesson state} · {mastery}". **Remove the practice count.** Rows link straight to the lesson; there's no sheet, because a sheet's other actions (practice, offline) aren't live.
  5. Footer link (quiet): "Topics wrong or missing? Edit the outline" → `/courses/{id}/outline`.
  6. All topics Proficient: replace Next up with the line "Every topic is Proficient or better." and drop the sticky camwood bar.
- **Materials tab:**
  1. Camwood **Add materials** → `/materials/add?course={id}`.
  2. `RowList` of materials, meta "{kind} · {n} pages · {status}" with a status icon plus text. The trailing control is a trash icon button (`aria-label="Delete {title}"`) that opens an `AlertDialog`: "Delete '{title}'?" / "Lessons already built from it stay. It won't be used again." with **Delete** (`--bad` outline, not camwood) and **Keep**.
  3. **Find in your materials** (`Input` type search plus results list "Title, p. N" with snippet). Show it only when there are materials.
  4. Empty: EmptyState "No materials yet" / "Add lecture notes, textbook pages, past questions or a lab manual. Lessons for the topics they cover are built from them." The camwood button stays in the bar.
  5. Loading: 2 `Skeleton` rows (h-14).
- Remove from this page: the Outline panel, the History panel, "Join to take part" panel, `CourseWorkspace`.

**Desktop:** header, then the tabs at full width. The Path list sits in the main column. The right rail (`lg:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]`) shows only the Next up block with its inline camwood button, so it stays visible while the list scrolls. Materials tab: the list on the left, search on the right.

### 5.5 Outline (`/courses/[id]/outline`) · new
One job: get the outline right. Members only; non-members are redirected to `/courses/{id}`.
1. H1 "{CODE} outline". Meta "Shared by everyone in the course. Edits are saved as versions."
2. Draft banner as on the Path, with camwood **It matches my course** (the existing `confirmDraft`). When there's no draft, the camwood button is **Edit outline**, which opens the existing `OutlineEditor` in place; in edit mode the editor's **Save outline** is the camwood button.
3. When there's no outline (or with `?start=`): the three setup choices from flow (a).
4. **Upload a new version** (outline button, `CameraIcon`): the same photo/PDF flow, which opens in the editor for checking.
5. **History** (`id="history"`): the existing `OutlineHistory` rows (who, what, when) with Confirm / Reject / Restore as outline buttons. Restore asks first through an `AlertDialog`: "Restore this version?" / "Everyone in the course will see it." On desktop History sits in the right rail; on the phone it's a section below.
6. Leaving the editor with unsaved changes → `AlertDialog` "Discard your changes?" with **Discard** and **Keep editing**.
7. Footer note (`text-xs text-ink-2`, existing): the Gemini processing and "keep names and matric numbers out of the photo" line, shown next to the upload actions only.

### 5.6 Lesson (`/learn/[id]`)
A focused screen in the spirit of `07` §5.3.
- **Header:** on the phone the back button goes to the course, or to Courses for a topic, and the title truncates. **Hide the bottom nav on `/learn/*`** (`AppShell` checks the pathname), so the action bar owns the thumb zone.
- **Top:** `Progress` (h-1, `--quantity` fill on `--line`, with `aria-label="Screen 3 of 8"` and visible text "3 of 8 · ~12 min" in `text-sm text-ink-2`). The trust label (`lessonLabel`, e.g. "From your notes") is plain `text-sm text-ink-2` text, not a chip. The "Checkpoint" chip is removed.
- **Body:** the screen's blocks, with prose capped at 66ch, left-aligned. Citations stay under blocks.
- **Bottom bar (sticky `bottom-0`):** a left outline icon button (`ArrowLeftIcon`, `aria-label="Previous screen"`, disabled on screen 1) and a right camwood **Continue** (last screen: **Finish**), full remaining width. When the screen holds a checkpoint and the block exposes its own Check, keep the block's behaviour; the bar's button stays Continue.
- **Finish screen:** H2 "{title}: done", the **Key takeaways** list (moved here from the side, so it's only shown after the lesson), then camwood **Next topic: {next topic in outline order}** when opened from a course and a next topic exists. Otherwise the camwood is **Back to {CODE}** or **Back to courses**. There's an outline button **Go through it again**. Copy never claims a mastery change (there's no `/api/sync` yet).
- **Flag:** keep the per-block flag control. The confirmation becomes a Sonner toast "Flag sent. A curator will check this block."
- **Building state** (`GenerationWaiting`): phone order is (1) quick explanation with the label "Quick explanation while you wait" (when present), (2) "Building your lesson" with the step list and "{n}s · usually under 2 minutes". `aria-live="polite"` on the list. No camwood button: the lesson swaps in by itself. Desktop: steps on the left, explanation on the right.
- **Waiting / review / failed:** the H2 is the state ("Ready by tomorrow morning", "Waiting for a curator", "This lesson isn't ready"), the body is the server message, and **Try again** (camwood) shows only when `canRetry`.
- **"Building from your notes" notice** (`notesBuilding`): kept as one quiet `--quantity-soft` row above the progress: "Ifiok is building this lesson from your notes. Start with this one; yours replaces it when it's ready."
- **Removed:** the "Screens" side panel and the dot pager (the progress bar replaces both; jumping between screens is not needed in MVP), the Key takeaways shown before finishing, and the materials panel under a free topic's lesson. A followed topic gets an "Add materials for this topic" item in a header `DropdownMenu` (`DotsThreeIcon`) → `/materials/add?topic={id}`.
- **Desktop:** content column `max-w-[46rem]`, left-aligned in the page area, with the bar sticky at the bottom of that column. No right rail.

### 5.7 Add materials (`/materials/add`)
A step flow with one step per view. `?course=` or `?topic=` preselects the destination and skips step 1.
1. **Where?** (only if there's no preset and more than one destination): `RadioGroup` rows of courses, then topics. Camwood **Next**.
2. **What is it?** `RadioGroup` (Lecture notes, Textbook pages, Past questions, Lab manual). Under it, one `text-sm text-ink-2` line per kind (existing copy: textbook pages stay private, up to {maxPages} pages, the PDF stays on your phone, scanned pages can't be read yet). Camwood **Choose a PDF**, outline button **Paste text**.
3. **Pick pages:** `Input` "Name" (prefilled from the file name), then PagePicker. Camwood **Add {n} pages** (disabled at 0).
   **Paste:** `Input` "Name", `Textarea` "Text" (10 rows, counter "{n} of {max} characters"). Camwood **Add text**, disabled below `minPageChars`.
4. **Done:** redirect with a toast (flow (c) step 5). A topic redirects to `/learn/{id}`.
- Top of every step: "Adding to **{destination}**" with the quiet link "Change" (when there's more than one destination). An outline **Cancel** sits next to the camwood button on desktop; on the phone it's a header back button.
- Errors: inline under the controls (existing copy, e.g. "That PDF is over 100 MB. Split it into smaller files and add the part you need."). Remove the "for photos of an outline, use the outline panel" wording; it becomes "Choose a PDF, or paste the text."

### 5.8 Me (`/me`)
Plain sections, no panel grid.
1. H1 "Me".
2. **Your name** `Form` (First name, Last name, `NAME_MAX`). Camwood **Save name**, enabled only when the values changed. Toast "Name saved."
3. **Study profile** `RowList` (University, Level), with the trailing quiet link "Change" → `/onboarding/university` (existing hand-off back to `/today`). Drop "Daily study time" from display: nothing uses it until the daily plan ships.
4. **Account**: Email row, then the links Terms · Privacy · How Ifiok uses AI.
5. Outline button **Sign out** (form POST to `/auth/sign-out`, as now).
- Desktop: the same sections in one column, `max-w-2xl`, left-aligned.

## 6. shadcn theming (`app/globals.css`)
Add the shadcn variables **as aliases of the existing tokens**, in `:root` only. They follow light/dark automatically because the tokens already switch under `prefers-color-scheme` and `[data-theme]`. Don't add a separate `.dark {}` block with raw colours.

```css
:root {
  --background: var(--paper);      --foreground: var(--ink);
  --card: var(--surface);          --card-foreground: var(--ink);
  --popover: var(--surface);       --popover-foreground: var(--ink);
  --primary: var(--change);        --primary-foreground: var(--on-change);
  --secondary: var(--surface);     --secondary-foreground: var(--ink);
  --muted: var(--paper);           --muted-foreground: var(--ink-2);
  --accent: var(--paper);          --accent-foreground: var(--ink);       /* hover/selected rows */
  --destructive: var(--bad);
  --border: var(--line);           --input: var(--line-strong);         /* inputs need ≥ 3:1 edge */
  --ring: var(--quantity);
  --radius: 12px;
}
@custom-variant dark (&:where([data-theme="dark"], [data-theme="dark"] *));
```
In `@theme inline`, map `--color-background`, `--color-foreground`, `--color-card`, `--color-popover`, `--color-primary`, `--color-primary-foreground`, `--color-secondary`, `--color-muted`, `--color-muted-foreground`, `--color-accent`, `--color-accent-foreground`, `--color-destructive`, `--color-border`, `--color-input`, `--color-ring` and their `-foreground` pairs. Set the radii explicitly instead of shadcn's `calc()` steps: `--radius-sm: 6px; --radius-md: 6px; --radius-lg: 12px; --radius-xl: 12px`. Shadcn's `dark:` utilities only cover the manual toggle; the media-query dark theme already works through the token aliases. Remove `dark:` classes from generated components where they hard-code colours.

**Overrides in the generated components** (edit the files after `shadcn add`):
- **Button:** all variants `rounded-full min-h-12 px-6 text-base font-semibold`, no `shadow-xs`. Variants: `default` = camwood (`bg-primary text-primary-foreground hover:bg-change-hover`), `outline` = `border border-ink/25 bg-surface hover:border-ink/50`, `ghost` = `text-ink-2 hover:text-ink hover:underline`, `destructive` = `border border-bad text-bad bg-transparent` (never filled red). Delete the `secondary` and `link` variants (no use for them). Size `icon` = `h-11 w-11`.
- **Focus everywhere:** replace `focus-visible:ring-[3px] focus-visible:ring-ring/50` and `focus-visible:border-ring` with `focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--quantity)]` (the global `:focus-visible` rule). No ring glow, no `aria-invalid:ring-*`; invalid fields get `border-bad` plus the message.
- **Input / Textarea / Select trigger:** `min-h-12 rounded-[6px] bg-surface text-base`, no `shadow-xs`, `placeholder:text-ink-3`.
- **Tabs:** underline style instead of the default pill. `TabsList` is `border-b border-line bg-transparent p-0 h-auto`. A `TabsTrigger` is `min-h-12 px-4 text-base text-ink-2 rounded-none border-b-2 border-transparent`; when `data-[state=active]` it becomes `text-ink font-semibold border-quantity`, with no background and no shadow.
- **DropdownMenu / Select content / Command:** `bg-popover border border-line rounded-[12px]` with **no shadow**, items `min-h-11`. Command's `CommandInput` wrapper loses its bottom border when inline; results use `RowList` styling.
- **Sheet:** the one elevated element allowed. Keep its shadow off and use a top `--line` border, the overlay `bg-ink/40` (no blur), and a drag handle bar. No slide animation under `prefers-reduced-motion`.
- **AlertDialog / Dialog:** `rounded-[12px] border border-line`, no shadow, overlay `bg-ink/40`, no zoom animation (fade only, 120 ms; the global reduced-motion rule kills it).
- **Badge:** only `outline` (`border-line text-ink-2 rounded-full`) and `draft` (`border-dashed border-change text-change`). Never use a badge for state that text can say.
- **Skeleton:** `bg-line/60 rounded-[6px]` with **no `animate-pulse`** (motion only answers an action).
- **Progress:** track `bg-line`, indicator `bg-quantity`, `h-1`, no transition beyond `transition-[width] 150ms`.
- **Sonner:** `<Toaster position="bottom-center" richColors={false} closeButton={false} toastOptions={{ classNames: { toast: "bg-surface text-ink border border-line rounded-[12px] shadow-none font-sans text-base" } }} />`. The toast copy reuses the verb ("Outline saved", "Name saved"). Never put prompt or tutor content in a toast.
- **Fonts:** components inherit `font-sans` (Atkinson). Only H1s use `font-display`.

## 7. Acceptance checklist
- [ ] `grep -rn "Opens soon\|Soon\b\|aria-disabled" app/\(app\) components/app` finds nothing tied to a closed feature; no closed `FeatureKey` is rendered anywhere under `app/(app)` or `components/app`.
- [ ] Bottom nav has exactly Today · Courses · Me; sidebar has Today · Courses plus the profile footer; `/practice` redirects to `/today`.
- [ ] Every view has **at most one** camwood (`bg-primary`/`bg-change`) control; on phones it sits in the sticky bottom bar. Add a Playwright check per screen: `locator('.bg-change, .bg-primary').filter({ visible: true })` count ≤ 1.
- [ ] No topic list appears twice on any screen; the course page has no Outline or History panel; materials are added only via `/materials/add`; "Course outline" is not a materials kind in that flow.
- [ ] No practice-question count, streak, mastered count or setup checklist is shown anywhere.
- [ ] Flows (a)–(d) pass as Playwright specs at 360 px (`--project=mobile`). Each is ≤ 2 taps from Today to its first working screen: course page, topic lesson, add-materials step 2, and the Continue/Next lesson.
- [ ] At 360 px and 412 px, and at 200 % text zoom, there's no horizontal scroll on any screen (`document.documentElement.scrollWidth <= innerWidth`).
- [ ] Every async region has a static skeleton that matches its layout; no spinner shows for more than 1 s; building states use the step list.
- [ ] Every error says what happened and how to fix it (existing `ApiError` messages); no "Something went wrong", no apologies.
- [ ] Touch targets are ≥ 44 px (buttons 48 px); icon-only buttons have `aria-label`; tabs have `role="tab"` (Radix); status always pairs an icon with text; `aria-current` sits on nav and the Next node; toasts are announced (Sonner `aria-live`).
- [ ] No shadows on cards, panels, menus, dialogs or toasts; no ring glow; no gradients; no `animate-pulse`; no emoji or text glyphs (→, ✓) in copy; sentence case; UK spelling.
- [ ] Light and dark themes (media query and `data-theme="dark"`) both render with token colours only (`pnpm check` UI rules pass); there are no hex values in `components/ui/*`.
- [ ] Budgets: Today ≤ 170 KB gz initial JS, lesson shell ≤ 200 KB gz (Command/cmdk loads only on `/courses`).
- [ ] The landing page is unchanged (`git diff --stat app/\(marketing\) components/marketing` is empty).
- [ ] Review-log entry Q50 added (nav without Practice, course tabs, no Path sheet, practice count hidden until MVP-03 overrides Q49's "shows the count on the Path"); `pnpm check` passes.
