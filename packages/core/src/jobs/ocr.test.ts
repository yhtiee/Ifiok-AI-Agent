import { describe, expect, it, vi } from "vitest";
import { GatewayError } from "../ai/gateway";
import { createOcrHandler, type OcrRepo } from "./ocr";
import { JobFailure, type ClaimedJob } from "./types";

const USER = "00000000-0000-4000-8000-000000000001";
const SRC = "00000000-0000-4000-8000-0000000000aa";
const PAGE = (n: number) => ({ path: `${USER}/${SRC}/ocr-${n}.jpg`, page: n });

function repo(over: Partial<OcrRepo> = {}) {
  const log: string[] = [];
  const r: OcrRepo = {
    source: async () => ({ ownerId: USER, courseId: "c", conceptId: null, kind: "past_paper", shared: false }),
    donePages: async () => new Set(),
    image: async () => ({ data: new Uint8Array([0xff, 0xd8]), mime: "image/jpeg" }),
    saveChunks: async (_s, chunks) => void log.push(`chunks:${chunks.length}`),
    queueEmbed: async () => void log.push("embed"),
    followUp: async (s) => void log.push(`follow:${s.kind}`),
    ...over,
  };
  return { r, log };
}
const job = (pages: { path: string; page: number }[], ownerId = USER): ClaimedJob => ({
  queue: "ocr",
  msgId: 1,
  jobId: "j",
  attempts: 1,
  ownerId,
  payload: { source_id: SRC, user_id: USER, pages },
});
const reads = (text: string) => ({ run: vi.fn(async () => ({ output: { text } }) as never) });

describe("ocr job (12 §4 Q60)", () => {
  it("reads each page, saves the text, indexes it, and starts a scanned past paper's extraction", async () => {
    const { r, log } = repo();
    const g = reads("Question 1. Evaluate the limit of (x^2 - 4)/(x - 2) as x tends to 2. [5 marks]");
    await createOcrHandler({ repo: r, gateway: g }).run(job([PAGE(1), PAGE(2)]));
    expect(g.run).toHaveBeenCalledTimes(2);
    expect(log).toEqual(["chunks:1", "embed", "follow:past_paper"]);
  });

  it("waits for tomorrow when the day's page allowance is used up, keeping what it read", async () => {
    const { r, log } = repo();
    let n = 0;
    const g = {
      run: vi.fn(async () => {
        if (++n > 1) throw new GatewayError("quota_exhausted", "used up");
        return { output: { text: "Kirchhoff's current law: currents into a node sum to zero." } } as never;
      }),
    };
    const out = await createOcrHandler({ repo: r, gateway: g }).run(job([PAGE(1), PAGE(2)]));
    expect(out.kind).toBe("defer");
    expect(log[0]).toBe("chunks:1");
  });

  it("refuses another student's material or images outside their folder (guardrail 7)", async () => {
    const g = reads("x");
    await expect(
      createOcrHandler({ repo: repo().r, gateway: g }).run(job([PAGE(1)], "someone-else")),
    ).rejects.toBeInstanceOf(JobFailure);
    await expect(
      createOcrHandler({ repo: repo().r, gateway: g }).run(job([{ path: "other/folder/x.jpg", page: 1 }])),
    ).rejects.toBeInstanceOf(JobFailure);
  });
});
