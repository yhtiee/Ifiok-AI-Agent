import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Viewer } from "@/lib/auth/viewer";

// MVP-01 POST /api/materials rules with a fake database: redaction before anything is saved,
// private text-only sources, the embed job owned by the session user, quota refunds on failure.

type Op = { method: string; args: unknown[] };
type Call = { table: string; ops: Op[] };
type Result = { data: unknown; error: unknown };

const state = vi.hoisted(() => ({
  calls: [] as { table: string; ops: { method: string; args: unknown[] }[] }[],
  rpcs: [] as { fn: string; args: Record<string, unknown> }[],
  respond: (() => ({ data: null, error: null })) as (call: {
    table: string;
    ops: { method: string; args: unknown[] }[];
  }) => { data: unknown; error: unknown },
  rpc: (() => ({ data: null, error: null })) as (
    fn: string,
    args: Record<string, unknown>,
  ) => {
    data: unknown;
    error: unknown;
  },
}));

function fakeClient() {
  return {
    from(table: string) {
      const call: Call = { table, ops: [] };
      state.calls.push(call);
      const builder: Record<string, unknown> = {};
      for (const m of ["select", "eq", "is", "in", "limit", "order", "insert", "delete", "update"]) {
        builder[m] = (...args: unknown[]) => {
          call.ops.push({ method: m, args });
          return builder;
        };
      }
      const settle = () => Promise.resolve(state.respond(call));
      builder.maybeSingle = settle;
      builder.single = settle;
      builder.then = (ok: (r: Result) => unknown, bad: (e: unknown) => unknown) => settle().then(ok, bad);
      return builder;
    },
    rpc(fn: string, args: Record<string, unknown>) {
      state.rpcs.push({ fn, args });
      return Promise.resolve(state.rpc(fn, args));
    },
  };
}

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => fakeClient() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => fakeClient() }));
vi.mock("@/lib/config", () => ({ getConfig: async () => ({}) }));
vi.mock("@/lib/ai/retrieve", () => ({ retrieveChunks: async () => [] }));

const { createMaterial, createMaterialBody, deleteMaterial } = await import("./service");

const USER = "00000000-0000-4000-8000-0000000000a1";
const COURSE = "21000000-0000-4000-8000-000000000001";
const SOURCE = "51000000-0000-4000-8000-000000000001";
const viewer = { userId: USER } as Viewer;

const page = (n: number, text = `Projectile motion notes for page ${n}. `.repeat(10)) => ({ page: n, text });

type World = { member?: boolean; quota?: boolean; duplicate?: boolean; chunkError?: boolean };

function world(w: World = {}) {
  const { member = true, quota = true, duplicate = false, chunkError = false } = w;
  state.respond = (call) => {
    const op = (m: string) => call.ops.find((o) => o.method === m);
    if (call.table === "courses") return { data: { id: COURSE, status: "active" }, error: null };
    if (call.table === "enrollments") return { data: member ? { user_id: USER } : null, error: null };
    if (call.table === "sources" && op("insert")) return { data: { id: SOURCE }, error: null };
    if (call.table === "sources" && op("select")) return { data: duplicate ? { id: "dup" } : null, error: null };
    if (call.table === "chunks" && op("insert")) return { data: null, error: chunkError ? { message: "x" } : null };
    return { data: null, error: null };
  };
  state.rpc = (fn) => {
    if (fn === "consume_quota") return { data: quota, error: null };
    if (fn === "enqueue_job_once") return { data: [{ job_id: "job-1", created: true }], error: null };
    return { data: null, error: null };
  };
}

const inserted = (table: string) =>
  state.calls
    .filter((c) => c.table === table)
    .flatMap((c) => c.ops.filter((o) => o.method === "insert").flatMap((o) => o.args[0] as unknown[]));

beforeEach(() => {
  state.calls = [];
  state.rpcs = [];
  world();
});

describe("createMaterialBody", () => {
  const base = { courseId: COURSE, kind: "notes", title: "Week 3", pages: [page(1)] };

  it("needs exactly one of a course or a topic", () => {
    expect(createMaterialBody.safeParse(base).success).toBe(true);
    expect(createMaterialBody.safeParse({ ...base, courseId: null }).success).toBe(false);
    expect(createMaterialBody.safeParse({ ...base, conceptId: COURSE }).success).toBe(false);
  });

  it("caps pages at 80 and refuses outlines (they go to scheme_extract)", () => {
    const pages = Array.from({ length: 81 }, (_, i) => page(i + 1));
    expect(createMaterialBody.safeParse({ ...base, pages }).success).toBe(false);
    expect(createMaterialBody.safeParse({ ...base, kind: "outline" }).success).toBe(false);
  });

  it("caps text per PDF page", () => {
    expect(createMaterialBody.safeParse({ ...base, pages: [page(1, "x".repeat(12_001))] }).success).toBe(false);
    expect(createMaterialBody.safeParse({ ...base, pages: [{ page: null, text: "x".repeat(50_000) }] }).success).toBe(
      true,
    );
  });
});

describe("createMaterial", () => {
  const body = (pages = [page(1), page(2)]) =>
    createMaterialBody.parse({ courseId: COURSE, kind: "textbook", title: "Ch. 4", pages });

  it("strips personal details before anything is saved, and stores a private text-only source", async () => {
    const result = await createMaterial(
      viewer,
      body([page(1, `${"Range R = u^2 sin 2θ / g. ".repeat(5)} Call me on 08031234567 or ada@uni.edu.ng`)]),
    );
    expect(result.redacted).toBe(2);
    const [source] = inserted("sources") as Record<string, unknown>[];
    expect(source).toMatchObject({
      owner_id: USER,
      course_id: COURSE,
      kind: "textbook_private",
      visibility: "private",
      storage_path: null,
      page_count: 1,
    });
    const chunks = inserted("chunks") as { content: string; owner_id: string; visibility: string; page: number }[];
    expect(chunks.length).toBeGreaterThan(0);
    for (const c of chunks) {
      expect(c.content).not.toContain("08031234567");
      expect(c.content).not.toContain("ada@uni.edu.ng");
      expect(c).toMatchObject({ owner_id: USER, visibility: "private", page: 1 });
    }
  });

  it("queues one embed job owned by the session user", async () => {
    const result = await createMaterial(viewer, body());
    const enqueue = state.rpcs.find((r) => r.fn === "enqueue_job_once")!;
    expect(enqueue.args).toEqual({
      p_queue: "embed",
      p_payload: { source_id: SOURCE },
      p_dedupe: `embed:${SOURCE}`,
      p_owner: USER,
    });
    expect(result.jobId).toBe("job-1");
  });

  it("skips pages without text and refuses when none has any", async () => {
    const result = await createMaterial(viewer, body([page(1), page(2, "  ")]));
    expect(result.skippedPages).toBe(1);
    await expect(createMaterial(viewer, body([page(1, " "), page(2, "x")]))).rejects.toMatchObject({
      status: 422,
      code: "no_text",
    });
  });

  it("only lets course members add materials", async () => {
    world({ member: false });
    await expect(createMaterial(viewer, body())).rejects.toMatchObject({ status: 403 });
    expect(inserted("sources")).toHaveLength(0);
  });

  it("refuses a repeat upload of the same pages", async () => {
    world({ duplicate: true });
    await expect(createMaterial(viewer, body())).rejects.toMatchObject({ status: 409, code: "duplicate" });
  });

  it("stops at the daily upload limit", async () => {
    world({ quota: false });
    await expect(createMaterial(viewer, body())).rejects.toMatchObject({ status: 429 });
    expect(inserted("sources")).toHaveLength(0);
  });

  it("removes the source and refunds the upload when saving fails", async () => {
    world({ chunkError: true });
    await expect(createMaterial(viewer, body())).rejects.toMatchObject({ status: 503 });
    const deleted = state.calls.find((c) => c.table === "sources" && c.ops.some((o) => o.method === "delete"));
    expect(deleted?.ops).toContainEqual({ method: "eq", args: ["id", SOURCE] });
    expect(state.rpcs.some((r) => r.fn === "refund_quota" && r.args.p_feature === "materials_upload")).toBe(true);
  });
});

describe("deleteMaterial", () => {
  it("answers someone else's source like a missing one", async () => {
    state.respond = () => ({ data: { id: SOURCE, owner_id: "someone-else", visibility: "private" }, error: null });
    await expect(deleteMaterial(viewer, SOURCE)).rejects.toMatchObject({ status: 404 });
  });

  it("deletes the viewer's own private source", async () => {
    state.respond = (call) =>
      call.ops.some((o) => o.method === "delete")
        ? { data: null, error: null }
        : { data: { id: SOURCE, owner_id: USER, visibility: "private" }, error: null };
    await deleteMaterial(viewer, SOURCE);
    const del = state.calls.find((c) => c.ops.some((o) => o.method === "delete"))!;
    expect(del.ops).toContainEqual({ method: "eq", args: ["owner_id", USER] });
  });
});
