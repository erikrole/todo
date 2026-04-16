# Plan: Routines View + Sometime CSV Import

**Date:** 2026-04-16
**Goal:** Replace the Sometime iOS app with a first-class Routines section. Add completion history tracking and CSV import from Sometime's export.

## Phases

- [ ] Phase 1 — Schema: `task_completions` table
- [ ] Phase 2 — Update complete route to write completion records
- [ ] Phase 3 — API routes (routines filter + completions endpoints)
- [ ] Phase 4 — Routines view page
- [ ] Phase 5 — Completion history drawer
- [ ] Phase 6 — CSV import UI

## CSV Format (confirmed from completions.csv)
```
task,category,date,date_iso8601,notes,creator,modifier,modifiedDate
🛏 Sheets,,2026-03-08 14:00:00,20260308T200000.000Z,,,,
```
- 16 unique tasks, 2166 total completions (2021–2026)
- Use `date` column (local time), `task` (with emoji), `notes`
