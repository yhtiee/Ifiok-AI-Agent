// Embeddings with gte-small (384-d) inside the Supabase Edge Runtime: no per-call API cost
// (specifications/02-architecture.md §1). Server-to-server only: callers must send the shared
// INTERNAL_FUNCTION_SECRET; students never call this directly.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const model = new Supabase.ai.Session("gte-small");
const MAX_TEXTS = 16; // ≤ 16 per invocation keeps us inside the 2 s CPU budget (02 §1)
const MAX_CHARS = 2000; // gte-small truncates at 512 tokens anyway

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  const secret = Deno.env.get("INTERNAL_FUNCTION_SECRET");
  if (!secret || req.headers.get("x-ifiok-secret") !== secret) return json({ error: "unauthorized" }, 401);

  let texts: unknown;
  try {
    ({ texts } = await req.json());
  } catch {
    return json({ error: "body must be JSON: { texts: string[] }" }, 400);
  }
  if (
    !Array.isArray(texts) ||
    texts.length === 0 ||
    texts.length > MAX_TEXTS ||
    !texts.every((t) => typeof t === "string")
  ) {
    return json({ error: `texts must be 1–${MAX_TEXTS} strings` }, 400);
  }

  const embeddings: number[][] = [];
  for (const text of texts as string[]) {
    const output = await model.run(text.slice(0, MAX_CHARS), { mean_pool: true, normalize: true });
    embeddings.push(Array.from(output as ArrayLike<number>));
  }
  return json({ model: "gte-small", dimensions: 384, embeddings });
});
