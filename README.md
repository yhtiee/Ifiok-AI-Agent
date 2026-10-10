# Ifiok

**Ifiok, the AI learning agent.** *See it. Try it. Master it.*

Lessons you can move, labs you can run and practice that adapts, for Nigerian university students (18+).

- **Spec (source of truth):** [`specifications/`](specifications/README.md): product, features, architecture, data model, AI, lesson engine, economy, brand, security, cost, build plan, testing, review log.
- **Rules for Claude Code and contributors:** [`CLAUDE.md`](CLAUDE.md).
- **Build order:** [`specifications/10-build-plan.md`](specifications/10-build-plan.md). Start each session with:
  > Read CLAUDE.md and specifications/10-build-plan.md. We are on ticket <ID>. Read the spec sections that ticket lists, then implement it, with tests.

## Run locally

Needs Node 22+ and pnpm 11 (`corepack enable`).

```bash
pnpm install
cp .env.example .env.local   # fill in the Supabase URL and publishable key
pnpm dev                     # http://localhost:3000
pnpm check                   # typecheck + lint + unit tests + format check
pnpm test:e2e                # Playwright (PW_CHANNEL=chrome to use installed Chrome)
```
