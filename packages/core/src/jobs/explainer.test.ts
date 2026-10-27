import { describe, expect, it, vi } from "vitest";
import type { ExplainerReviewOutput } from "../ai/skills/contribute";
import { checkNumbers, createExplainerHandler, mediaType, type ExplainerRepo } from "./explainer";
import { JobFailure, type ClaimedJob } from "./types";

const USER = "00000000-0000-4000-8000-000000000001";
const EX = "00000000-0000-4000-8000-0000000000e1";
const WEBM = new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 0, 0, 0, 0]);
const MP4 = new Uint8Array([0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70]);

const passing: ExplainerReviewOutput = {
  on_topic: true,
  accurate: true,
  safe: true,
  contact_or_personal: false,
  copied: false,
  numbers: [],
  issues: [],
};

function repo(kind: "text" | "voice" | "video", over: Partial<ExplainerRepo> = {}) {
  const saves: Record<string, unknown>[] = [];
  const r: ExplainerRepo = {
    explainer: async () => ({
      id: EX,
      authorId: USER,
      conceptId: "c",
      kind,
      body: kind === "text" ? "Walk round the loop and add the voltages." : null,
      mediaPath: kind === "video" ? "u/e/video.webm" : null,
      audioPath: kind === "text" ? null : "u/e/audio.webm",
      status: "processing",
    }),
    concept: async () => ({ title: "Kirchhoff's laws", subject: "physics" }),
    head: async (path) => ({ size: path.includes("video") ? 9_000_000 : 400_000, head: WEBM }),
    download: async () => new Uint8Array([1]),
    frames: async () => [new Uint8Array([0xff, 0xd8])],
    save: async (_id, patch) => void saves.push(patch as Record<string, unknown>),
    approvedByPerson: async () => 0,
    ...over,
  };
  return { r, saves };
}

const gateway = (review: ExplainerReviewOutput = passing, transcript = "Walk round the loop.", durationS = 60) => ({
  run: vi.fn(async (skill: string) =>
    skill === "explainer_frames"
      ? ({
          output: { safe: true, other_people: false, personal_data: false, copied_slides: false, issues: [] },
        } as never)
      : ({ output: review } as never),
  ),
  transcribe: vi.fn(async () => ({
    text: transcript,
    durationS,
    segments: [{ start: 0, end: 2, text: transcript }],
    provider: "groq" as const,
    model: "whisper",
  })),
});

const moderation = async () => ({ trusted_after_approved: 3, hide_after_reports: 3, spot_checks: 5 });

const job = (ownerId = USER): ClaimedJob => ({
  queue: "explainer",
  msgId: 1,
  jobId: "j",
  attempts: 1,
  ownerId,
  payload: { explainer_id: EX, user_id: USER },
});

describe("explainer checks", () => {
  it("recognises containers by their bytes", () => {
    expect(mediaType(WEBM)).toBe("webm");
    expect(mediaType(MP4)).toBe("mp4");
    expect(mediaType(new Uint8Array([0x3c, 0x68, 0x74, 0x6d, 0x6c, 0, 0, 0]))).toBeNull(); // "<html"
  });

  it("checks numbers with the engine: confirmed, uncheckable or wrong", () => {
    expect(checkNumbers([])).toEqual({ checked: null, wrong: [] });
    expect(checkNumbers([{ claim: "2 + 3 is 5", value: 5, expr: "2 + 3" }])).toEqual({ checked: true, wrong: [] });
    expect(checkNumbers([{ claim: "about 5", value: 5, expr: null }]).checked).toBe(false);
    const w = checkNumbers([{ claim: "2 × 3 is 7", value: 7, expr: "2 * 3" }]);
    expect(w.checked).toBe(false);
    expect(w.wrong[0]).toMatch(/engine gets 6/);
  });
});

describe("explainer job", () => {
  it("a captioned video passes the AI checks and waits for an admin", async () => {
    const { r, saves } = repo("video");
    const g = gateway();
    await createExplainerHandler({ repo: r, gateway: g, moderation }).run(job());
    expect(saves[0]).toMatchObject({ transcript: "Walk round the loop.", duration_s: 60, media_bytes: 9_000_000 });
    expect(saves[1]).toMatchObject({ status: "pending_admin" });
    expect(g.run).toHaveBeenCalledWith("explainer_frames", expect.objectContaining({ images: expect.any(Array) }));
  });

  it("holds media that isn't a real recording, is too long, or has no speech", async () => {
    for (const [r, g] of [
      [repo("voice", { head: async () => ({ size: 100, head: new Uint8Array(8) }) }).r, gateway()],
      [repo("video").r, gateway(passing, "Hi", 400)],
      [repo("voice").r, gateway(passing, "  ")],
    ] as const) {
      const saves: unknown[] = [];
      const out = await createExplainerHandler({
        repo: { ...r, save: async (_id, p) => void saves.push(p) },
        gateway: g,
        moderation,
      }).run(job());
      expect(out).toMatchObject({ result: { status: "held" } });
    }
  });

  it("unsafe content or contact details are held for a person, with the issues listed", async () => {
    const { r, saves } = repo("text");
    await createExplainerHandler({
      repo: r,
      moderation,
      gateway: gateway({ ...passing, contact_or_personal: true }),
    }).run(job());
    expect(saves.at(-1)).toMatchObject({ status: "held" });
    expect(JSON.stringify(saves.at(-1))).toMatch(/contact details/);
  });

  it("publishes at once for an author with 3 explainers a person approved, only when the checks are clean", async () => {
    const trusted = repo("text", { approvedByPerson: async () => 3 });
    await createExplainerHandler({ repo: trusted.r, gateway: gateway(), moderation }).run(job());
    expect(trusted.saves.at(-1)).toMatchObject({ status: "approved", auto_published: true });
    const flagged = repo("text", { approvedByPerson: async () => 3 });
    await createExplainerHandler({
      repo: flagged.r,
      gateway: gateway({ ...passing, accurate: false }),
      moderation,
    }).run(job());
    expect(flagged.saves.at(-1)).toMatchObject({ status: "pending_admin" });
  });

  it("a failed frame check doesn't sink the explainer: it goes to a person, noted", async () => {
    const { r, saves } = repo("video");
    const g = gateway();
    g.run.mockImplementation(async (skill: string) => {
      if (skill === "explainer_frames") throw new Error("rate limited");
      return { output: passing } as never;
    });
    await createExplainerHandler({ repo: r, gateway: g, moderation }).run(job());
    expect(saves.at(-1)).toMatchObject({ status: "pending_admin" });
    expect(JSON.stringify(saves.at(-1))).toMatch(/frames weren't checked/);
  });

  it("refuses another student's explainer (guardrail 7)", async () => {
    const { r } = repo("text");
    await expect(
      createExplainerHandler({ repo: r, moderation, gateway: gateway() }).run(job("someone-else")),
    ).rejects.toBeInstanceOf(JobFailure);
  });
});
