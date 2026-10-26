import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { chunkPages } from "@ifiok/core/materials/chunk";
import { createEmbedder, toVector } from "@ifiok/core/materials/embed-client";
import { engineValue } from "@ifiok/core/items/check";
import { numericMatches } from "@ifiok/core/dsl/numeric";
import type { Database } from "@/lib/supabase/types";

// MVP-02 "Done when" on the hosted project with real AI (pnpm test:integration): notes uploaded to
// a course give every topic they cover a private lesson citing them, and the topic they don't cover
// gets none; practice items are saved only when their numbers check out. Synthetic notes only.

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const db = createClient<Database>(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const embed = createEmbedder({ supabaseUrl: url, secret: process.env.INTERNAL_FUNCTION_SECRET! });

const NOTES = [
  "Projectile motion. A projectile moves under gravity alone after it is thrown. Resolve the initial velocity u at angle θ into a horizontal component u cos θ and a vertical component u sin θ. The horizontal component stays constant because no horizontal force acts; the vertical component falls by g = 9.8 m/s² every second on the way up. The time of flight is T = 2u sin θ / g, the greatest height is H = u² sin² θ / 2g and the horizontal range is R = u² sin 2θ / g, largest at 45 degrees.",
  "Projectile motion, worked example. A ball is kicked at 20 m/s at 30 degrees above the ground. Horizontal velocity 17.3 m/s, vertical 10 m/s. Time of flight 2 × 10 / 9.8 = 2.04 s. Range 17.3 × 2.04 = 35.3 m. Common mistake: using the full speed 20 m/s for the horizontal distance instead of its horizontal component, or forgetting that the vertical velocity is zero at the top of the path.",
  "Projectile motion, horizontal launch. A stone is thrown horizontally at 15 m/s from a cliff 45 m high. Vertically it starts from rest, so 45 = ½ × 9.8 × t² gives t = 3.03 s. Horizontally it moves at a steady 15 m/s and lands 45.5 m from the foot of the cliff. Treat the two directions separately; time links them.",
  "Friction. Friction opposes the relative motion of surfaces in contact. Static friction can rise up to μs R before sliding starts, where R is the normal reaction; kinetic friction is μk R once the body slides. Friction depends on the nature of the surfaces, not on the area of contact.",
  "Friction, worked example. A 10 kg box rests on a floor with μk = 0.3. The normal reaction is 10 × 9.8 = 98 N, so kinetic friction is 0.3 × 98 = 29.4 N; a push of 29.4 N keeps it moving at constant speed. On a slope at angle θ, the normal reaction becomes mg cos θ.",
  "Friction on a slope. A block stays at rest on an incline while mg sin θ is less than μs mg cos θ, that is while tan θ < μs. The angle at which it just starts to slide is the angle of friction, tan θ = μs. Lubricants and wheels reduce friction; rough tyres and sand increase grip on a wet road.",
];

const users: string[] = [];
const concepts: string[] = [];
let courseId = "";

beforeAll(async () => {
  const { data, error } = await db.auth.admin.createUser({
    email: `e2e-path-${randomUUID()}@example.com`,
    email_confirm: true,
  });
  if (error || !data.user) throw error;
  users.push(data.user.id);
  await db.from("profiles").update({ is_adult: true, birth_year: 1999, birth_month: 4 }).eq("id", data.user.id);
  // The gateway serves only adults who agreed to the terms (guardrail 8).
  const { CONSENT_VERSION, REQUIRED_CONSENTS } = await import("@ifiok/core/consent");
  const { error: consentError } = await db
    .from("consents")
    .insert(REQUIRED_CONSENTS.map((kind) => ({ user_id: data.user.id, kind, version: CONSENT_VERSION })));
  if (consentError) throw consentError;

  const { data: uni } = await db.from("universities").select("id").limit(1).single();
  const { data: course, error: ce } = await db
    .from("courses")
    .insert({
      university_id: uni!.id,
      code: `ZTP ${100 + Math.floor(Math.random() * 800)}`,
      title: "Integration mechanics",
      created_by: data.user.id,
      subject: "physics",
    })
    .select("id")
    .single();
  if (ce) throw ce;
  courseId = course.id;
  await db.from("enrollments").insert({ user_id: data.user.id, course_id: courseId });

  const titles = ["Projectile motion", "Friction", "Elasticity of demand"];
  const vectors = await embed(titles);
  for (const [i, title] of titles.entries()) {
    const { data: c, error: e } = await db
      .from("concepts")
      .insert({
        slug: `ztest.${randomUUID()}`,
        title,
        subject: i === 2 ? "economics" : "physics",
        level_band: "introductory",
        embedding: toVector(vectors[i]!),
        status: "active",
      })
      .select("id")
      .single();
    if (e) throw e;
    concepts.push(c.id);
    await db.from("topics").insert({ course_id: courseId, concept_id: c.id, position: i + 1, title });
  }
}, 120_000);

afterAll(async () => {
  if (concepts.length) {
    await db.from("items").delete().in("concept_id", concepts);
    await db.from("lessons").delete().in("concept_id", concepts);
  }
  if (courseId) await db.from("courses").delete().eq("id", courseId);
  if (concepts.length) await db.from("concepts").delete().in("id", concepts);
  for (const id of users) await db.auth.admin.deleteUser(id);
});

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe("learning path from your materials (hosted, real AI)", () => {
  it("builds a private lesson citing the notes for each covered topic, none for the uncovered one", async () => {
    const [userId] = users as [string];
    const [projectile, friction, demand] = concepts as [string, string, string];

    const { data: source, error } = await db
      .from("sources")
      .insert({
        owner_id: userId,
        course_id: courseId,
        kind: "notes",
        title: "Mechanics notes",
        page_count: NOTES.length,
      })
      .select("id")
      .single();
    if (error) throw error;
    const chunks = chunkPages(NOTES.map((text, i) => ({ page: i + 1, text })));
    const { data: inserted } = await db
      .from("chunks")
      .insert(
        chunks.map((c) => ({
          source_id: source.id,
          owner_id: userId,
          course_id: courseId,
          visibility: "private" as const,
          page: c.page,
          content: c.content,
        })),
      )
      .select("id");
    const ownChunkIds = new Set((inserted ?? []).map((c) => Number(c.id)));
    await db.rpc("enqueue_job_once", {
      p_queue: "embed",
      p_payload: { source_id: source.id },
      p_dedupe: `embed:${source.id}`,
      p_owner: userId,
    });

    // Embedding → onReady queues the lessons → lesson_gen publishes → items_gen adds practice.
    const started = Date.now();
    let lessons: { concept_id: string; status: string; source_refs: number[] }[] = [];
    while (Date.now() - started < 330_000) {
      await sleep(10_000);
      const { data } = await db
        .from("lessons")
        .select("concept_id, status, source_refs")
        .eq("owner_id", userId)
        .eq("course_id", courseId);
      lessons = (data ?? []) as typeof lessons;
      if (lessons.filter((l) => l.concept_id !== demand).length >= 2) break;
    }
    const { data: jobs } = await db
      .from("jobs")
      .select("queue, status, result, dedupe_key")
      .eq("owner_id", userId)
      .order("created_at");
    console.log("[path] jobs", JSON.stringify(jobs?.map((j) => [j.queue, j.status, j.result])));
    console.log(`[path] lessons after ${Math.round((Date.now() - started) / 1000)} s`, JSON.stringify(lessons));

    const byConcept = new Map(lessons.map((l) => [l.concept_id, l]));
    for (const c of [projectile, friction]) {
      const lesson = byConcept.get(c);
      expect(lesson, `private lesson for ${c}`).toBeDefined();
      expect(lesson!.status).toBe("published");
      expect(lesson!.source_refs.length).toBeGreaterThan(0);
      for (const ref of lesson!.source_refs) expect(ownChunkIds.has(Number(ref))).toBe(true);
    }
    expect(byConcept.has(demand)).toBe(false);

    // Practice items follow the lessons; every saved numeric item checks out against the engine.
    let items: { type: string; status: string; verification: unknown; owner_id: string | null }[] = [];
    while (Date.now() - started < 420_000) {
      const { data } = await db
        .from("items")
        .select("type, status, verification, owner_id")
        .in("concept_id", [projectile, friction])
        .eq("origin", "generated");
      items = (data ?? []) as typeof items;
      if (items.length >= 10) break;
      await sleep(10_000);
    }
    console.log(`[path] ${items.length} practice items saved`);
    expect(items.length).toBeGreaterThan(0);
    for (const item of items) {
      expect(item.owner_id).toBe(userId);
      expect(item.status).toBe("published");
      if (item.type === "numeric") {
        const v = item.verification as { answer_expr: string; stated: number };
        expect(numericMatches(engineValue(v.answer_expr) ?? NaN, v.stated)).toBe(true);
      }
    }
  }, 480_000);
});
