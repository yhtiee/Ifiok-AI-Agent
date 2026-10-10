// Loads every migration and seed into PGlite (Postgres in WebAssembly) and runs the pgTAP files
// in supabase/tests. Runs anywhere, no Docker. CI also runs the same tests on a real Supabase
// stack (`supabase test db`). Usage: pnpm test:db:local
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { vector } from "@electric-sql/pglite-pgvector";
import { pgtap } from "@electric-sql/pglite-pgtap";

const root = process.cwd();
const sqlFiles = (dir: string, suffix = ".sql") =>
  readdirSync(join(root, dir))
    .filter((f) => f.endsWith(suffix))
    .sort()
    .map((f) => join(dir, f));

const db = new PGlite({ extensions: { vector, pgtap, pg_trgm, pgcrypto } });
await db.exec("set search_path = public, extensions;");

async function load(file: string) {
  try {
    await db.exec(readFileSync(join(root, file), "utf8"));
  } catch (err) {
    console.error(`\n✗ ${file} failed to load:\n  ${(err as Error).message}`);
    process.exit(1);
  }
}

await load("scripts/db/prelude.sql");
for (const file of sqlFiles("supabase/migrations")) await load(file);
console.log(`✓ ${sqlFiles("supabase/migrations").length} migrations applied`);
for (const file of sqlFiles("supabase/seed")) await load(file);
console.log(`✓ ${sqlFiles("supabase/seed").length} seed files applied`);

let failedFiles = 0;
for (const file of sqlFiles("supabase/tests", ".test.sql")) {
  let lines: string[] = [];
  try {
    const results = await db.exec(readFileSync(join(root, file), "utf8"));
    lines = results.flatMap((r) => r.rows.map((row) => String(Object.values(row)[0] ?? "")));
  } catch (err) {
    console.error(`✗ ${file}: ${(err as Error).message}`);
    await db.exec("rollback;").catch(() => {});
    failedFiles++;
    continue;
  }
  const tap = lines.flatMap((l) => l.split("\n")).filter((l) => /^(ok|not ok|1\.\.|#)/.test(l));
  const planned = Number(tap.find((l) => l.startsWith("1.."))?.slice(3) ?? NaN);
  const passed = tap.filter((l) => l.startsWith("ok")).length;
  const failed = tap.filter((l) => l.startsWith("not ok"));
  const ok = failed.length === 0 && passed === planned;
  if (!ok) failedFiles++;
  console.log(`${ok ? "✓" : "✗"} ${file}: ${passed}/${planned} passed`);
  for (const line of tap.filter((l) => l.startsWith("not ok") || l.startsWith("#"))) console.log(`    ${line}`);
}

await db.close();
process.exit(failedFiles === 0 ? 0 : 1);
