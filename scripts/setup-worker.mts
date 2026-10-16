// One-time (re-runnable) setup for the job worker on the linked Supabase project (P0-11):
//  1. function secrets the worker reads: GEMINI_API_KEY, GROQ_API_KEY, INTERNAL_FUNCTION_SECRET
//  2. Vault secrets the enqueue trigger and the pg_cron sweeper use to call it:
//     worker_url = <project>/functions/v1/worker, internal_function_secret
// Values come from .env (or .env.local) and travel only in temp files that are deleted at once;
// nothing is printed. Usage: node scripts/setup-worker.mts   (then `pnpm deploy:worker`)
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

function readEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const file of [".env", ".env.local"]) {
    if (!existsSync(file)) continue;
    for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m) env[m[1]!] = m[2]!.replace(/^"(.*)"$/, "$1");
    }
  }
  return env;
}

const env = readEnv();
const need = ["NEXT_PUBLIC_SUPABASE_URL", "INTERNAL_FUNCTION_SECRET", "GEMINI_API_KEY", "GROQ_API_KEY"];
const missing = need.filter((k) => !env[k]);
if (missing.length) {
  console.error(`✗ Missing in .env: ${missing.join(", ")}`);
  process.exit(1);
}

const supabase = (args: string[]) =>
  execFileSync("pnpm", ["exec", "supabase", ...args], {
    stdio: ["ignore", "pipe", "pipe"],
    encoding: "utf8",
    shell: process.platform === "win32",
  });

const tmp = mkdtempSync(join(tmpdir(), "ifiok-worker-"));
try {
  // 1. Function secrets
  const secretsFile = join(tmp, "worker.env");
  writeFileSync(
    secretsFile,
    ["INTERNAL_FUNCTION_SECRET", "GEMINI_API_KEY", "GROQ_API_KEY"].map((k) => `${k}=${env[k]}`).join("\n") + "\n",
  );
  supabase(["secrets", "set", "--env-file", secretsFile]);
  console.log("✓ function secrets set: INTERNAL_FUNCTION_SECRET, GEMINI_API_KEY, GROQ_API_KEY");

  // 2. Vault secrets for pg_net / pg_cron
  const lit = (s: string) => `'${s.replace(/'/g, "''")}'`;
  const url = `${env.NEXT_PUBLIC_SUPABASE_URL!.replace(/\/$/, "")}/functions/v1/worker`;
  const upsert = (name: string, value: string) => `
    if exists (select 1 from vault.secrets where name = ${lit(name)}) then
      perform vault.update_secret((select id from vault.secrets where name = ${lit(name)}), ${lit(value)});
    else
      perform vault.create_secret(${lit(value)}, ${lit(name)});
    end if;`;
  const sqlFile = join(tmp, "vault.sql");
  writeFileSync(
    sqlFile,
    `do $$ begin ${upsert("worker_url", url)} ${upsert("internal_function_secret", env.INTERNAL_FUNCTION_SECRET!)} end $$;`,
  );
  supabase(["db", "query", "--linked", "-f", sqlFile]);
  console.log("✓ Vault secrets set: worker_url, internal_function_secret");
} catch (err) {
  const e = err as { stderr?: string };
  console.error("✗ setup failed:", (e.stderr ?? String(err)).split("\n").slice(-3).join(" "));
  process.exitCode = 1;
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
