# Retrieval check (MVP-01, OWN-H2)

MVP-01 is done when the right chunk is in the top 6 for 8 of 10 questions about real notes. The
questions and their answering pages are owner work (OWN-H2); this folder holds only the runner.

1. Upload the demo notes (OWN-H1) in the app as the demo account, on the demo course.
2. Copy `cases.example.jsonl` to `cases.jsonl` and write one line per question:
   `{"question": "...", "page": 12}` (the page of the PDF that answers it).
3. Run `node scripts/retrieval-check.mts <account email> <course id>`.

The runner calls `match_chunks` with that account's own id (service role, read only) and reports,
per question, the pages that ranked in the top 6. Pass: 8 of 10.
