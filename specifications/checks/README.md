# Spec checks

Evidence that the SQL and the example lesson in this spec actually work. Run them again after you edit `03` or `05`.

## SQL (real Postgres 16 + pgvector + pgTAP, no Supabase needed)
1. Extract every ```sql block from `03-data-model.md` into `schema.sql`, replacing the `create extension` lines for `pg_cron`, `pg_net` and `pgmq` with comments (they need Supabase).
2. `psql -d ifiok -v ON_ERROR_STOP=1 -f prelude.sql -f schema.sql` (prelude stubs Supabase's `auth` schema, roles and default grants).
3. On a **freshly loaded** database (the fixtures insert rows): `psql -d ifiok -f tests.sql` then `psql -d ifiok -f tests2.sql`.

Result on 6 Oct 2026 (v1.3, student-led model, after its review): schema loads (56 tables, RLS enabled on all 56); 47/47 tests pass. They cover: shared lessons are reusable by students at other universities; shared lessons draw only on approved crowd chunks (never private, course-only or past-paper chunks); clients can't read or list other people's sources or chunks; concept merges keep each student's best mastery; clients cannot create courses, outline topics or concepts directly; curators are scoped to their subject; a private textbook can't be shared; lecturers can't see or edit private lessons or chunks; clients can't self-approve sources, update lessons, write attempts or review cards, or call `match_chunks`, `consume_quota`, `enqueue_job` or `post_txn`; no self-promotion through `profiles`; `is_admin()` needs MFA (`aal2`); `match_chunks` hides other users' private chunks and matches natural-language questions; quotas stop at the limit; job enqueue dedupes; 3 flags hide a block; rejected bank text is hidden; students can't create handout sources; a zero quota allows nothing; the ledger rejects unbalanced and overdrawn transactions, and replays are no-ops.

In the real repo these become pgTAP files under `supabase/tests/` run by `supabase test db`.

## Lesson maths
`npm i mathjs && node lesson-check.mjs ../05-lesson-and-lab-engine.md` → the example lesson's stepper, plot and checkpoint all pass the `05` §6 rules, and a wrong step (`2x + h` → `2x + 2h`) is caught.
