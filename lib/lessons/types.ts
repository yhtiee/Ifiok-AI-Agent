import type { LessonSpec } from "@ifiok/core";

export type LessonStatus = "draft" | "review" | "published" | "superseded" | "hidden";
export type LessonTrust = "new" | "trusted";

export type LessonRow = {
  id: string;
  concept_id: string;
  course_id: string | null;
  owner_id: string | null;
  requested_by: string | null;
  kind: string;
  version: number;
  status: LessonStatus;
  dsl_version: number;
  spec: LessonSpec;
  source_refs: number[];
  hidden_blocks: string[];
  trust: LessonTrust;
  completions: number;
  sources_used: number;
  model: string | null;
  published_at: string | null;
  created_at: string;
};

export type ConceptRow = {
  id: string;
  slug: string;
  title: string;
  subject: string;
  level_band: string | null;
  description: string | null;
  micro_skills: string[] | null;
  current_lesson_id: string | null;
};

type ConceptSummary = Pick<ConceptRow, "id" | "title" | "subject">;

/**
 * Where a concept's shared lesson stands (F2-FR4/FR5/FR8). Every state except `published` shows
 * the quick explanation so the student can start learning straight away.
 */
export type GetLessonResult =
  | { status: "published"; lesson: LessonRow }
  /** No lesson and no job yet: the client asks to start one (POST). */
  | { status: "none"; concept: ConceptSummary; quickExplainer: string }
  | { status: "generating"; jobId: string; concept: ConceptSummary; quickExplainer: string }
  /** The library budget is used up: the job waits for tomorrow's budget. */
  | { status: "waiting"; jobId: string; concept: ConceptSummary; quickExplainer: string; message: string }
  /** Sensitive subject: waiting for a curator. */
  | { status: "review"; concept: ConceptSummary; quickExplainer: string; message: string }
  | { status: "failed"; concept: ConceptSummary; quickExplainer: string; message: string; canRetry: boolean };

export type LessonFlagReason = "wrong" | "unclear" | "offensive" | "other";

export type LessonFlagInput = {
  blockId: string;
  reason: LessonFlagReason;
  note?: string;
};
