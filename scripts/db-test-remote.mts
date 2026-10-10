// Runs supabase/tests/*.test.sql against the linked hosted project without Docker.
// Each file runs in its own transaction that is always rolled back: the last statement raises
// an exception carrying pgTAP's counters (planned / run / failed), which aborts the transaction.
// pgTAP keeps no per-test text here, so run `pnpm test:db:local` to see which assertion failed.
// Usage: pnpm test:db:remote   (needs `supabase login` and `supabase link`)
import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dir = "supabase/tests";
const files = readdirSync(dir)
  .filter((f) => f.endsWith(".test.sql"))
  .sort();
const tmp = mkdtempSync(join(tmpdir(), "ifiok-tap-"));
const report = `
do $$ begin
  raise exception 'TAPRESULT%TAPEND', (select json_object_agg(label, value) from __tcache__
    where label in ('plan', 'curr_test', 'failed'))::text;
end $$;`;

let failures = 0;
try {
  for (const file of files) {
    const body = readFileSync(join(dir, file), "utf8")
      .replace(/^select \* from finish\(\);\s*$/m, "")
      .replace(/^rollback;\s*$/m, "");
    const sqlPath = join(tmp, file);
    writeFileSync(sqlPath, body + report);

    let output = "";
    try {
      output = execFileSync("pnpm", ["exec", "supabase", "db", "query", "--linked", "-f", sqlPath], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
        shell: process.platform === "win32",
      });
    } catch (err) {
      const e = err as { stdout?: string; stderr?: string };
      output = `${e.stdout ?? ""}${e.stderr ?? ""}`;
    }

    // The counters arrive JSON-escaped inside a JSON error, possibly several levels deep.
    const match = output.replace(/\\+"/g, '"').match(/TAPRESULT(\{.*?\})TAPEND/);
    if (!match) {
      failures++;
      console.log(`✗ ${file}: did not finish\n    ${output.trim().split("\n").slice(-3).join("\n    ")}`);
      continue;
    }
    const counts = JSON.parse(match[1]!) as { plan?: number; curr_test?: number; failed?: number };
    const planned = counts.plan ?? 0;
    const ran = counts.curr_test ?? 0;
    const failed = counts.failed ?? 0;
    const ok = failed === 0 && ran === planned;
    if (!ok) failures++;
    console.log(`${ok ? "✓" : "✗"} ${file}: ${ran - failed}/${planned} passed${failed ? `, ${failed} failed` : ""}`);
  }
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
process.exit(failures === 0 ? 0 : 1);
