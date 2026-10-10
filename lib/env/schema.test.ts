import { describe, expect, it } from "vitest";
import { parseEnv, publicEnvSchema, serverEnvSchema } from "./schema";

const valid = {
  NEXT_PUBLIC_SUPABASE_URL: "https://abc.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
};

describe("parseEnv", () => {
  it("accepts the required variables and leaves later-ticket ones optional", () => {
    const env = parseEnv(serverEnvSchema, valid);
    expect(env.NEXT_PUBLIC_SUPABASE_URL).toBe(valid.NEXT_PUBLIC_SUPABASE_URL);
    expect(env.GEMINI_API_KEY).toBeUndefined();
  });

  it("fails with one clear message naming every missing variable", () => {
    expect(() => parseEnv(publicEnvSchema, {})).toThrowError(
      /can't start[\s\S]*NEXT_PUBLIC_SUPABASE_URL: missing[\s\S]*NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: missing[\s\S]*\.env\.example/,
    );
  });

  it("treats an empty value as missing", () => {
    expect(() => parseEnv(publicEnvSchema, { ...valid, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "  " })).toThrowError(
      /NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: missing/,
    );
  });

  it("rejects a malformed URL without leaking other values", () => {
    let message = "";
    try {
      parseEnv(serverEnvSchema, { ...valid, NEXT_PUBLIC_SUPABASE_URL: "not a url", GEMINI_API_KEY: "secret-123" });
    } catch (e) {
      message = (e as Error).message;
    }
    expect(message).toMatch(/NEXT_PUBLIC_SUPABASE_URL: (?!missing)/);
    expect(message).not.toContain("secret-123");
  });
});
