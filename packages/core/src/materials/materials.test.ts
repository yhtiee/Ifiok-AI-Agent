import { describe, expect, it } from "vitest";
import { createEmbedHandler } from "../jobs/embed";
import { JobFailure, type ClaimedJob } from "../jobs/types";
import { CHUNK_MAX_CHARS, CHUNK_MAX_WORDS, CHUNK_MIN_WORDS, CHUNK_OVERLAP_WORDS, chunkPages, cleanText } from "./chunk";
import { createEmbedder, EmbeddingError } from "./embed-client";
import type { MaterialsRepo, PendingChunk } from "./repo";

// MVP-01: the page-aware chunker and the embed job with fake I/O.

const words = (n: number, prefix = "w") => Array.from({ length: n }, (_, i) => `${prefix}${i}`).join(" ");

describe("chunkPages", () => {
  it("keeps a normal page as one chunk with its page number", () => {
    const out = chunkPages([{ page: 3, text: words(100) }]);
    expect(out).toEqual([{ page: 3, content: words(100) }]);
  });

  it("does not span pages when each page can stand alone", () => {
    const out = chunkPages([
      { page: 1, text: words(60, "a") },
      { page: 2, text: words(60, "b") },
    ]);
    expect(out.map((c) => c.page)).toEqual([1, 2]);
    expect(out[1]!.content.startsWith("b0")).toBe(true);
  });

  it("joins a page too short to stand alone to the next one, keeping the first page number", () => {
    const out = chunkPages([
      { page: 1, text: "Chapter 4 Projectiles" },
      { page: 2, text: words(100) },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0]!.page).toBe(1);
    expect(out[0]!.content.startsWith("Chapter 4 Projectiles w0")).toBe(true);
  });

  it("splits a long page into chunks within the word cap, with overlap", () => {
    const out = chunkPages([{ page: 5, text: words(600) }]);
    expect(out.length).toBeGreaterThan(2);
    for (const c of out) {
      expect(c.page).toBe(5);
      expect(c.content.split(" ").length).toBeLessThanOrEqual(CHUNK_MAX_WORDS);
    }
    const first = out[0]!.content.split(" ");
    const second = out[1]!.content.split(" ");
    expect(second.slice(0, CHUNK_OVERLAP_WORDS)).toEqual(first.slice(-CHUNK_OVERLAP_WORDS));
    // Every word appears somewhere.
    const all = new Set(out.flatMap((c) => c.content.split(" ")));
    expect(all.size).toBe(600);
  });

  it("keeps symbol-heavy text under the character cap", () => {
    const formula = Array.from({ length: 400 }, () => "v_x=u\\cos\\theta,v_y=u\\sin\\theta-gt").join(" ");
    const out = chunkPages([{ page: 1, text: formula }]);
    for (const c of out) expect(c.content.length).toBeLessThanOrEqual(CHUNK_MAX_CHARS);
  });

  it("cuts a single overlong token", () => {
    const out = chunkPages([{ page: 1, text: "x".repeat(CHUNK_MAX_CHARS * 2) }]);
    expect(out).toHaveLength(1);
    expect(out[0]!.content.length).toBe(CHUNK_MAX_CHARS);
  });

  it("skips empty pages and supports pasted text without a page", () => {
    expect(chunkPages([{ page: 1, text: "   \n\t " }])).toEqual([]);
    expect(chunkPages([{ page: null, text: words(CHUNK_MIN_WORDS) }])[0]!.page).toBeNull();
  });

  it("removes control characters and collapses whitespace", () => {
    expect(cleanText("a\u0000b\n\n  c\u0007")).toBe("a b c");
  });
});

describe("createEmbedder", () => {
  it("sends batches of 16 with the shared secret", async () => {
    const calls: string[][] = [];
    const embed = createEmbedder({
      supabaseUrl: "https://x.supabase.co",
      secret: "s",
      fetch: async (_url, init) => {
        expect((init?.headers as Record<string, string>)["x-ifiok-secret"]).toBe("s");
        const { texts } = JSON.parse(String(init?.body)) as { texts: string[] };
        calls.push(texts);
        return new Response(JSON.stringify({ embeddings: texts.map(() => [0.1, 0.2]) }));
      },
    });
    const out = await embed(Array.from({ length: 20 }, (_, i) => `t${i}`));
    expect(calls.map((c) => c.length)).toEqual([16, 4]);
    expect(out).toHaveLength(20);
  });

  it("retries a call the embed function refused (CPU limit) and honours a smaller batch", async () => {
    let calls = 0;
    const sizes: number[] = [];
    const embed = createEmbedder({
      supabaseUrl: "https://x.supabase.co",
      secret: "s",
      batch: 8,
      retryDelayMs: 0,
      fetch: async (_url, init) => {
        const { texts } = JSON.parse(String(init?.body)) as { texts: string[] };
        sizes.push(texts.length);
        if (++calls === 1) return new Response(JSON.stringify({ code: "WORKER_RESOURCE_LIMIT" }), { status: 546 });
        return new Response(JSON.stringify({ embeddings: texts.map(() => [0.1]) }));
      },
    });
    expect(await embed(Array.from({ length: 10 }, (_, i) => `t${i}`))).toHaveLength(10);
    expect(sizes).toEqual([8, 8, 2]);
  });

  it("gives up after its retries with the function's status", async () => {
    const embed = createEmbedder({
      supabaseUrl: "https://x.supabase.co",
      secret: "s",
      retries: 1,
      retryDelayMs: 0,
      fetch: async () => new Response("{}", { status: 546 }),
    });
    await expect(embed(["a"])).rejects.toMatchObject({ name: "EmbeddingError", status: 546 });
  });

  it("throws EmbeddingError on a bad response", async () => {
    const embed = createEmbedder({
      supabaseUrl: "https://x.supabase.co",
      secret: "s",
      fetch: async () => new Response("{}", { status: 500 }),
    });
    await expect(embed(["a"])).rejects.toBeInstanceOf(EmbeddingError);
  });
});

function fakeRepo(owner: string | null, count: number) {
  const chunks = new Map<number, { content: string; embedded: boolean }>();
  for (let i = 1; i <= count; i++) chunks.set(i, { content: `c${i}`, embedded: false });
  const repo: MaterialsRepo = {
    async sourceInfo() {
      return owner ? { ownerId: owner, courseId: "c1", conceptId: null } : null;
    },
    async pendingChunks(_s, limit) {
      const out: PendingChunk[] = [];
      for (const [id, c] of chunks) if (!c.embedded && out.length < limit) out.push({ id, content: c.content });
      return out;
    },
    async setEmbeddings(_s, ids) {
      for (const id of ids) chunks.get(id)!.embedded = true;
      return ids.length;
    },
  };
  return { repo, chunks };
}

const SOURCE = "51000000-0000-4000-8000-000000000001";
const job = (ownerId: string | null, payload: unknown = { source_id: SOURCE }): ClaimedJob => ({
  queue: "embed",
  msgId: 1,
  jobId: "j1",
  attempts: 1,
  ownerId,
  payload,
});
const fakeEmbed = async (texts: string[]) => texts.map(() => [0.5]);

describe("embed handler", () => {
  it("embeds every pending chunk in batches of 4 (the embed function's CPU limit)", async () => {
    const { repo, chunks } = fakeRepo("u1", 40);
    const batches: number[] = [];
    const handler = createEmbedHandler({
      repo,
      embed: async (t) => {
        batches.push(t.length);
        return fakeEmbed(t);
      },
    });
    const outcome = await handler.run(job("u1"));
    expect(outcome).toEqual({ kind: "done", result: { embedded: 40 } });
    expect(batches).toEqual(Array(10).fill(4));
    expect([...chunks.values()].every((c) => c.embedded)).toBe(true);
  });

  it("defers when its time budget runs out, keeping the batches it saved", async () => {
    const { repo, chunks } = fakeRepo("u1", 40);
    let t = 0;
    const handler = createEmbedHandler({
      repo,
      embed: async (texts) => {
        t += 10_000;
        return fakeEmbed(texts);
      },
      now: () => t,
      budgetMs: 15_000,
    });
    const outcome = await handler.run(job("u1"));
    expect(outcome.kind).toBe("defer");
    // One round of 3 parallel calls × 4 chunks landed before the budget ran out.
    expect([...chunks.values()].filter((c) => c.embedded)).toHaveLength(12);
  });

  it("retries a failed call once before giving up on the round", async () => {
    const { repo, chunks } = fakeRepo("u1", 4);
    let calls = 0;
    const outcome = await createEmbedHandler({
      repo,
      embed: async (texts) => {
        if (++calls === 1) throw new EmbeddingError("WORKER_RESOURCE_LIMIT");
        return fakeEmbed(texts);
      },
    }).run(job("u1"));
    expect(outcome.kind).toBe("done");
    expect(calls).toBe(2);
    expect([...chunks.values()].every((c) => c.embedded)).toBe(true);
  });

  it("finishes quietly when the source was deleted", async () => {
    const { repo } = fakeRepo(null, 0);
    const outcome = await createEmbedHandler({ repo, embed: fakeEmbed }).run(job("u1"));
    expect(outcome).toEqual({ kind: "done", result: { embedded: 0, skipped: "source_deleted" } });
  });

  it("refuses a source that belongs to someone else (guardrail 7)", async () => {
    const { repo } = fakeRepo("someone-else", 3);
    await expect(createEmbedHandler({ repo, embed: fakeEmbed }).run(job("u1"))).rejects.toMatchObject({
      retryable: false,
    });
  });

  it("rejects a bad payload without retrying", async () => {
    const { repo } = fakeRepo("u1", 3);
    const err = await createEmbedHandler({ repo, embed: fakeEmbed })
      .run(job("u1", { source_id: "nope" }))
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(JobFailure);
    expect((err as JobFailure).retryable).toBe(false);
  });

  it("retries when the embedding service fails", async () => {
    const { repo } = fakeRepo("u1", 3);
    const err = await createEmbedHandler({
      repo,
      embed: async () => {
        throw new EmbeddingError("down");
      },
    })
      .run(job("u1"))
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(JobFailure);
    expect((err as JobFailure).retryable).toBe(true);
  });

  it("stops instead of looping when nothing gets saved", async () => {
    const { repo } = fakeRepo("u1", 3);
    repo.setEmbeddings = async () => 0;
    await expect(createEmbedHandler({ repo, embed: fakeEmbed }).run(job("u1"))).rejects.toBeInstanceOf(JobFailure);
  });
});
