# Ifiok

**Ifiok, the AI learning agent.** *See it. Try it. Master it.*

Lessons you can move, labs you can run and practice that adapts, for Nigerian university students (18+).

- **Spec (source of truth):** [`specifications/`](specifications/README.md): product, features, architecture, data model, AI, lesson engine, economy, brand, security, cost, build plan, testing, review log.
- **Rules for Claude Code and contributors:** [`CLAUDE.md`](CLAUDE.md).
- **Build order:** [`specifications/10-build-plan.md`](specifications/10-build-plan.md). Start each session with:
  > Read CLAUDE.md and specifications/10-build-plan.md. We are on ticket <ID>. Read the spec sections that ticket lists, then implement it, with tests.

## Run locally

```bash
npm install
npm run dev     # http://localhost:3000
npm run build && npm run start
npm run lint
```

P0-01 moves the repo to pnpm and adds `pnpm check`, Vitest, Playwright and Supabase (see `CLAUDE.md` → Repository status).
