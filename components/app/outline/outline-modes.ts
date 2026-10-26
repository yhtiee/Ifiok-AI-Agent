import type { OutlineExtract } from "@/lib/queries/materials";
import type { EditorRow } from "./OutlineEditor";

// Rows for the outline editor, and the hand-off from the course page's Set up block to the outline
// page (app-overhaul §4a): the photo, PDF or draft is read where the student tapped, then checked
// on /courses/[id]/outline. The hand-off lives in memory for this tab only; a reload of the outline
// page just shows the set-up choices again (no AI call happens on page load).

export type EditSource = "upload" | "typed" | "ai_draft" | "edit";
export type EditMode = { kind: "edit"; source: EditSource; rows: EditorRow[]; note?: string };

let rowSeq = 0;
export const newRow = (t: Partial<EditorRow> = {}): EditorRow => ({
  key: `r${++rowSeq}`,
  topicId: t.topicId ?? null,
  title: t.title ?? "",
  week: t.week ?? null,
  description: t.description ?? null,
  lowConfidence: t.lowConfidence ?? false,
});

export const typedMode = (): EditMode => ({
  kind: "edit",
  source: "typed",
  rows: [newRow({ week: 1 }), newRow({ week: 2 }), newRow({ week: 3 })],
});

export const extractedMode = (result: OutlineExtract): EditMode => ({
  kind: "edit",
  source: "upload",
  rows: result.topics.map((t) =>
    newRow({ title: t.title, week: t.week, description: t.description, lowConfidence: t.confidence < 0.6 }),
  ),
  note: "Here's what Ifiok read. Check each topic, especially the ones marked, then save.",
});

export const draftedMode = (topics: { week: number; title: string; description: string }[]): EditMode => ({
  kind: "edit",
  source: "ai_draft",
  rows: topics.map((t) => newRow({ title: t.title, week: t.week, description: t.description })),
  note: "Draft outline. Check it against your course, fix anything that's off, then save.",
});

export const NO_TOPICS_FOUND =
  "Couldn't find topics there. Retake the photo in good light with the whole outline in the frame, pick the pages that list the topics, or type them.";

const handOff = new Map<string, EditMode>();

export function handOffEdit(courseId: string, mode: EditMode) {
  handOff.set(courseId, mode);
}

export function pendingEdit(courseId: string) {
  return handOff.get(courseId) ?? null;
}

export function clearEdit(courseId: string) {
  handOff.delete(courseId);
}

export const startParam = (source: EditSource) =>
  source === "typed" ? "typed" : source === "ai_draft" ? "draft" : "upload";
