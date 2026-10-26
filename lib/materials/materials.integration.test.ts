import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { chunkPages } from "@ifiok/core/materials/chunk";
import { createEmbedder, toVector } from "@ifiok/core/materials/embed-client";
import type { Database } from "@/lib/supabase/types";

// MVP-01 "Done when" on the hosted project (pnpm test:integration): 40 pages of notes are embedded
// by the worker's `embed` job within 2 minutes, and user B never retrieves user A's chunks.
// Needs the `materials` migration pushed and the worker deployed. Synthetic text only.

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const db = createClient<Database>(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const embed = createEmbedder({ supabaseUrl: url, secret: process.env.INTERNAL_FUNCTION_SECRET! });

const TOPICS = [
  "kinematics",
  "projectiles",
  "friction",
  "momentum",
  "energy",
  "circular motion",
  "gravitation",
  "oscillation",
];
/** About 330 words of synthetic notes per page, one distinct fact per page. */
const notesPage = (n: number) =>
  `Lecture ${n} on ${TOPICS[n % TOPICS.length]}. Key fact ${n}: the reference constant for page ${n} is ${n * 7} units. ` +
  `${"We define the quantities, state the assumptions, derive the result and work two examples with units checked. ".repeat(22)}`;

const users: string[] = [];
let courseId = "";

async function makeUser() {
  const { data, error } = await db.auth.admin.createUser({
    email: `e2e-mat-${randomUUID()}@example.com`,
    email_confirm: true,
  });
  if (error || !data.user) throw error;
  users.push(data.user.id);
  await db.from("profiles").update({ is_adult: true, birth_year: 1999, birth_month: 4 }).eq("id", data.user.id);
  return data.user.id;
}

beforeAll(async () => {
  const a = await makeUser();
  const { data: uni } = await db.from("universities").select("id").limit(1).single();
  const { data: course, error } = await db
    .from("courses")
    .insert({
      university_id: uni!.id,
      code: `ZTI ${100 + Math.floor(Math.random() * 800)}`,
      title: "Integration materials",
      created_by: a,
    })
    .select("id")
    .single();
  if (error) throw error;
  courseId = course.id;
});

afterAll(async () => {
  if (courseId) await db.from("courses").delete().eq("id", courseId);
  for (const id of users) await db.auth.admin.deleteUser(id);
});

describe("materials on the hosted project", () => {
  it("a 40-page upload is fully embedded within 2 minutes and the right page ranks in the top 6", async () => {
    const [a] = users as [string];
    const b = await makeUser();
    await db.from("enrollments").insert([
      { user_id: a, course_id: courseId },
      { user_id: b, course_id: courseId },
    ]);

    const { data: source, error } = await db
      .from("sources")
      .insert({ owner_id: a, course_id: courseId, kind: "notes", title: "40 pages", page_count: 40 })
      .select("id")
      .single();
    if (error) throw error;
    const chunks = chunkPages(Array.from({ length: 40 }, (_, i) => ({ page: i + 1, text: notesPage(i + 1) })));
    const { error: chunkError } = await db.from("chunks").insert(
      chunks.map((c) => ({
        source_id: source.id,
        owner_id: a,
        course_id: courseId,
        visibility: "private" as const,
        page: c.page,
        content: c.content,
      })),
    );
    if (chunkError) throw chunkError;

    const started = Date.now();
    const { error: jobError } = await db.rpc("enqueue_job_once", {
      p_queue: "embed",
      p_payload: { source_id: source.id },
      p_dedupe: `embed:${source.id}`,
      p_owner: a,
    });
    if (jobError) throw jobError;

    let pending = chunks.length;
    while (pending > 0 && Date.now() - started < 120_000) {
      await new Promise((r) => setTimeout(r, 3_000));
      const { count } = await db
        .from("chunks")
        .select("id", { count: "exact", head: true })
        .eq("source_id", source.id)
        .is("embedding", null);
      pending = count ?? pending;
    }
    console.log(`[materials] ${chunks.length} chunks embedded in ${Math.round((Date.now() - started) / 1000)} s`);
    expect(pending).toBe(0);

    const query = "What is the reference constant for page 23?";
    const [vector] = await embed([query]);
    const asA = await db.rpc("match_chunks", {
      p_user: a,
      p_course: courseId,
      p_concept: null as unknown as string,
      p_query: query,
      p_embedding: toVector(vector!),
      p_limit: 6,
    });
    expect(asA.error).toBeNull();
    expect(asA.data!.map((r) => r.page)).toContain(23);

    const asB = await db.rpc("match_chunks", {
      p_user: b,
      p_course: courseId,
      p_concept: null as unknown as string,
      p_query: query,
      p_embedding: toVector(vector!),
      p_limit: 6,
    });
    expect(asB.data ?? []).toHaveLength(0);
  }, 180_000);
});
