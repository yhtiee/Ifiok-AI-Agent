import "server-only";
import { z } from "zod";
import { mergeChunks } from "@ifiok/core/jobs/exam-extract";
import { BUCKET as EXPLAINER_BUCKET } from "@ifiok/core/jobs/explainer";
import { RouteError } from "@/lib/api/route";
import { isReviewAdmin } from "@/lib/auth/guards";
import type { Viewer } from "@/lib/auth/viewer";
import type { MasteryLevel } from "@/lib/courses/path-rules";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { LIBRARY_BUCKET } from "./library-upload";

// The Library (12 §4 Q58, Q59): one grid of everything in the contribution pool, newest first:
// explainers (video, voice, written) and documents (notes, lab manuals, worked solutions, past
// questions). Every item stands alone: an explainer plays on its watch page, a document opens in
// Ifiok's viewer. Only live explainers and approved documents appear.

export const LIBRARY_TYPES = [
  "all",
  "video",
  "voice",
  "text",
  "notes",
  "lab_manual",
  "solution",
  "past_paper",
] as const;
export type LibraryType = (typeof LIBRARY_TYPES)[number];
const DOC_KINDS = ["notes", "lab_manual", "solution", "past_paper"] as const;
type DocKind = (typeof DOC_KINDS)[number];

export type LibraryItem =
  | {
      type: "explainer";
      id: string;
      title: string;
      format: "video" | "voice" | "text";
      durationS: number | null;
      image: string | null;
      author: string;
      mastery: MasteryLevel | null;
      concept: { id: string; title: string } | null;
      at: string;
    }
  | {
      type: "doc";
      id: string;
      title: string;
      kind: DocKind;
      pages: number;
      image: string | null;
      author: string;
      mastery: null;
      concept: { id: string; title: string } | null;
      at: string;
    };

const clean = (q: string) => q.replace(/[%_,()]/g, "").trim();

export async function libraryItems(
  viewer: Viewer,
  filter: { q: string | null; conceptId: string | null; type: LibraryType },
): Promise<{ items: LibraryItem[]; topics: { id: string; title: string }[] }> {
  const supabase = await createClient();
  const admin = createAdminClient();
  const wantExplainers = ["all", "video", "voice", "text"].includes(filter.type);
  const wantDocs = filter.type === "all" || (DOC_KINDS as readonly string[]).includes(filter.type);

  let ex = supabase
    .from("explainers")
    .select("id, title, kind, duration_s, author_id, concept_id, media_path, approved_at")
    .eq("status", "approved")
    .order("approved_at", { ascending: false })
    .limit(60);
  if (filter.type !== "all" && wantExplainers) ex = ex.eq("kind", filter.type === "text" ? "text" : filter.type);
  if (filter.conceptId) ex = ex.eq("concept_id", filter.conceptId);
  if (filter.q) ex = ex.ilike("title", `%${clean(filter.q)}%`);

  let docs = admin
    .from("sources")
    .select("id, title, kind, owner_id, concept_id, shared_concepts, shared_at, page_count, thumb_path")
    .eq("visibility", "bank")
    .eq("review", "approved")
    .in("kind", filter.type === "all" ? [...DOC_KINDS] : [filter.type as DocKind])
    .order("shared_at", { ascending: false })
    .limit(60);
  if (filter.conceptId) docs = docs.contains("shared_concepts", [filter.conceptId]);
  if (filter.q) docs = docs.ilike("title", `%${clean(filter.q)}%`);

  const [{ data: exRows }, { data: docRows }] = await Promise.all([
    wantExplainers ? ex : Promise.resolve({ data: [] as never[] }),
    wantDocs ? docs : Promise.resolve({ data: [] as never[] }),
  ]);
  const explainers = (exRows ?? []) as {
    id: string;
    title: string;
    kind: string;
    duration_s: number | null;
    author_id: string;
    concept_id: string;
    media_path: string | null;
    approved_at: string | null;
  }[];
  const documents = (docRows ?? []) as {
    id: string;
    title: string;
    kind: DocKind;
    owner_id: string;
    concept_id: string | null;
    shared_concepts: string[] | null;
    shared_at: string | null;
    page_count: number | null;
    thumb_path: string | null;
  }[];

  const docConcept = (d: (typeof documents)[number]) => d.concept_id ?? d.shared_concepts?.[0] ?? null;
  const conceptIds = [
    ...new Set([
      ...explainers.map((e) => e.concept_id),
      ...documents.flatMap((d) => (docConcept(d) ? [docConcept(d)!] : [])),
    ]),
  ];
  const people = [...new Set([...explainers.map((e) => e.author_id), ...documents.map((d) => d.owner_id)])];
  const posters = explainers.flatMap((e) =>
    e.kind === "video" && e.media_path ? [`${e.author_id}/${e.id}/frame-1.jpg`] : [],
  );
  const thumbs = documents.flatMap((d) => (d.thumb_path ? [d.thumb_path] : []));
  const [{ data: concepts }, { data: names }, { data: mastery }, posterUrls, thumbUrls] = await Promise.all([
    conceptIds.length
      ? admin.from("concepts").select("id, title").in("id", conceptIds)
      : Promise.resolve({ data: [] as { id: string; title: string }[] }),
    people.length
      ? admin.from("profiles").select("id, display_name").in("id", people)
      : Promise.resolve({ data: [] as { id: string; display_name: string | null }[] }),
    explainers.length
      ? admin
          .from("mastery")
          .select("user_id, concept_id, level")
          .in(
            "user_id",
            explainers.map((e) => e.author_id),
          )
      : Promise.resolve({ data: [] as { user_id: string; concept_id: string; level: string }[] }),
    posters.length
      ? admin.storage.from(EXPLAINER_BUCKET).createSignedUrls(posters, 3600)
      : Promise.resolve({ data: [] }),
    thumbs.length ? admin.storage.from(LIBRARY_BUCKET).createSignedUrls(thumbs, 3600) : Promise.resolve({ data: [] }),
  ]);
  const title = new Map((concepts ?? []).map((c) => [c.id, c.title]));
  const name = new Map((names ?? []).map((p) => [p.id, p.display_name ?? "A student"]));
  const signed = new Map(
    [...(posterUrls.data ?? []), ...(thumbUrls.data ?? [])].flatMap((s) =>
      s.path && s.signedUrl ? [[s.path, s.signedUrl]] : [],
    ),
  );
  const topic = (id: string | null) => (id ? { id, title: title.get(id) ?? "Topic" } : null);

  const items: LibraryItem[] = [
    ...explainers.map((e): LibraryItem => {
      const level = mastery?.find((m) => m.user_id === e.author_id && m.concept_id === e.concept_id)?.level;
      return {
        type: "explainer",
        id: e.id,
        title: e.title,
        format: e.kind as "video" | "voice" | "text",
        durationS: e.duration_s === null ? null : Number(e.duration_s),
        image: signed.get(`${e.author_id}/${e.id}/frame-1.jpg`) ?? null,
        author: name.get(e.author_id) ?? "A student",
        mastery: level && level !== "not_started" ? (level as MasteryLevel) : null,
        concept: topic(e.concept_id),
        at: e.approved_at ?? "",
      };
    }),
    ...documents.map((d): LibraryItem => ({
      type: "doc",
      id: d.id,
      title: d.title,
      kind: d.kind,
      pages: d.page_count ?? 1,
      image: d.thumb_path ? (signed.get(d.thumb_path) ?? null) : null,
      author: name.get(d.owner_id) ?? "A student",
      mastery: null,
      concept: topic(docConcept(d)),
      at: d.shared_at ?? "",
    })),
  ].sort((a, b) => b.at.localeCompare(a.at));

  return {
    items,
    topics: [...title].map(([id, t]) => ({ id, title: t })).sort((a, b) => a.title.localeCompare(b.title)),
  };
}

export type LibraryDoc = {
  id: string;
  title: string;
  kind: DocKind;
  author: string;
  isYou: boolean;
  concept: { id: string; title: string } | null;
  sharedAt: string | null;
  pdfUrl: string | null;
  /** Text pages, when there's no PDF (pasted text, or material shared as text). */
  pages: { page: number | null; text: string }[];
};

/**
 * One document for the viewer: approved Library documents for everyone, and the uploader's own or
 * an admin's view of a held one. Owner decision Q59: approved documents are readable in full.
 */
export async function libraryDoc(viewer: Viewer, id: string): Promise<LibraryDoc | null> {
  const admin = createAdminClient();
  const { data: s } = await admin
    .from("sources")
    .select("id, title, kind, owner_id, concept_id, shared_concepts, shared_at, visibility, review, storage_path")
    .eq("id", id)
    .maybeSingle();
  if (!s || !(DOC_KINDS as readonly string[]).includes(s.kind) || !s.shared_at) return null;
  const live = s.visibility === "bank" && s.review === "approved";
  if (!live && s.owner_id !== viewer.userId && !(await isReviewAdmin())) return null;

  const conceptId = s.concept_id ?? s.shared_concepts?.[0] ?? null;
  const [{ data: owner }, { data: concept }, pdf] = await Promise.all([
    admin.from("profiles").select("display_name").eq("id", s.owner_id).maybeSingle(),
    conceptId
      ? admin.from("concepts").select("id, title").eq("id", conceptId).maybeSingle()
      : Promise.resolve({ data: null }),
    s.storage_path ? admin.storage.from(LIBRARY_BUCKET).createSignedUrl(s.storage_path, 600) : Promise.resolve(null),
  ]);
  let pages: LibraryDoc["pages"] = [];
  if (!pdf?.data?.signedUrl) {
    const { data: chunks } = await admin.from("chunks").select("page, content").eq("source_id", id).order("id");
    const byPage = new Map<number | null, { page: number | null; content: string }[]>();
    for (const c of chunks ?? []) byPage.set(c.page, [...(byPage.get(c.page) ?? []), c]);
    pages = [...byPage].map(([page, list]) => ({ page, text: mergeChunks(list) }));
  }
  return {
    id: s.id,
    title: s.title,
    kind: s.kind as DocKind,
    author: owner?.display_name ?? "A student",
    isYou: s.owner_id === viewer.userId,
    concept: concept ? { id: concept.id, title: concept.title } : null,
    sharedAt: s.shared_at,
    pdfUrl: pdf?.data?.signedUrl ?? null,
    pages,
  };
}

export const reportDocBody = z.object({
  reason: z.string().trim().min(3, "Say what's wrong in a few words.").max(300),
});

/** A student reports a document; 3 reports from different students send it back to an admin. */
export async function reportDocument(viewer: Viewer, id: string, reason: string) {
  const { data, error } = await createAdminClient().rpc("report_source", {
    p_source: id,
    p_reporter: viewer.userId,
    p_reason: reason,
  });
  if (error) throw new RouteError(503, "Ifiok couldn't send the report. Try again.", "report_failed");
  return { reported: Number(data) > 0 };
}
