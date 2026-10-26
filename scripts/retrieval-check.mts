// MVP-01 retrieval check (OWN-H2): for each owner-written question in evals/retrieval/cases.jsonl,
// is the answering page in the top 6 of match_chunks? Read only. Pass: 8 of 10.
// Usage: node scripts/retrieval-check.mts <account email> <course id>
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

for (const file of [".env.local", ".env"]) {
  try {
    process.loadEnvFile(file);
  } catch {
    // not present
  }
}

const [email, courseId] = process.argv.slice(2);
if (!email || !courseId) {
  console.error("Usage: node scripts/retrieval-check.mts <account email> <course id>");
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const db = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

let cases: { question: string; page: number }[];
try {
  cases = readFileSync("evals/retrieval/cases.jsonl", "utf8")
    .split("\n")
    .filter((l) => l.trim())
    .map((l) => JSON.parse(l) as { question: string; page: number });
} catch {
  console.error(
    "evals/retrieval/cases.jsonl is missing: it holds the owner's questions (OWN-H2). See evals/retrieval/README.md.",
  );
  process.exit(1);
}

const { data: users, error: listError } = await db.auth.admin.listUsers({ perPage: 1000 });
const user = users?.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
if (listError || !user) {
  console.error(`No account with the email ${email}.`);
  process.exit(1);
}

async function embed(text: string): Promise<string> {
  const res = await fetch(`${url}/functions/v1/embed`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-ifiok-secret": process.env.INTERNAL_FUNCTION_SECRET! },
    body: JSON.stringify({ texts: [text] }),
  });
  const json = (await res.json()) as { embeddings?: number[][] };
  if (!res.ok || !json.embeddings?.[0]) throw new Error(`embed failed (${res.status})`);
  return `[${json.embeddings[0].join(",")}]`;
}

let hits = 0;
for (const c of cases) {
  const { data, error } = await db.rpc("match_chunks", {
    p_user: user.id,
    p_course: courseId,
    p_concept: null,
    p_query: c.question,
    p_embedding: await embed(c.question),
    p_limit: 6,
  });
  if (error) throw new Error(error.message);
  const pages = (data as { page: number | null }[]).map((r) => r.page);
  const ok = pages.includes(c.page);
  if (ok) hits++;
  console.log(`${ok ? "✓" : "✗"} p. ${c.page} · top 6: ${pages.map((p) => p ?? "-").join(", ")} · ${c.question}`);
}
const needed = Math.ceil(cases.length * 0.8);
console.log(`\n${hits} of ${cases.length} found in the top 6 (pass: ${needed}).`);
process.exit(hits >= needed ? 0 : 1);
