# Roadmap Design

**Date:** 2026-04-10
**Starting point:** v0.9 (core app built — Inbox, Today, Upcoming, Logbook, Someday, subtasks, drag-and-drop, context menus, PWA, auth)
**Strategy:** Tight milestone releases — small, focused, shippable fast

---

## 1.0 — Daily Driver

**Goal:** Everything needed to ditch Things 3.

| Feature | What it means | Implementation notes |
|---|---|---|
| Cancel tasks | New `is_cancelled` status — task stays visible with strikethrough, not deleted | Add `is_cancelled` column to tasks; new visual state distinct from completed |
| Trash | Soft-delete: tasks go to Trash, auto-purge after 30 days. Trash view in sidebar | Add `deleted_at` column to tasks; replaces hard DELETE |
| Today keeps completed | Completing a task in Today keeps it in view (struck through) until midnight, while also appearing in Logbook | Query change + midnight reset; dual visibility |
| Progress bar | `completed / total` bar at the top of Today view | Pure UI; uses existing data |
| Completed times in Logbook | Show "Completed at 2:34 PM" on each task | `completed_at` already exists in schema — display change only |

---

## 1.1 — Scheduling

**Goal:** Time-aware tasks.

| Feature | What it means | Implementation notes |
|---|---|---|
| Time on tasks | Add a specific time to any task ("do this at 10:30am") | Add `scheduled_time` column to tasks; natural language input via chrono-node |
| Time badges in Today | Tasks with a scheduled time show a clock badge; Today view sorts by time within each section | Subtle badge treatment; not a full calendar widget |
| Time in quick-add | "Write report at 2pm" parses both `when_date = today` and `scheduled_time = 14:00` | Extends existing chrono-node parsing |

---

## 1.2 — Structure

**Goal:** Deeper organization for complex projects.

| Feature | What it means | Implementation notes |
|---|---|---|
| Sub-projects | Projects can have a `parent_project_id` — one level of nesting only | Schema migration adds FK; sidebar shows indented tree |
| Sections within projects | Named groups inside a project (like Things 3 headings) | New `sections` table; tasks get optional `section_id` FK |
| Section reordering | Drag sections within a project, drag tasks between sections | Extends existing dnd-kit setup |

**Depth constraint:** Sub-projects are one level deep only (no recursive nesting). Keeps the sidebar readable and the data model simple.

---

## 2.0 — Smart

**Goal:** The app works with you, not just for you.

| Feature | What it means | Implementation notes |
|---|---|---|
| Obsidian sync (read) | Scheduled Claude job scans vault for tasks/action items and creates them in the app | Extends existing MCP server with Obsidian vault file access; uses `/schedule` for daily job |
| Obsidian sync (write) | Completing a task can log an entry back to the relevant vault file | e.g., "Furnace filter replaced 2026-04-10" appended to `Home Maintenance.md` |
| AI task polish | Claude suggests a cleaner title, infers a project, or suggests a `when_date` based on context | On-demand only — "polish" button or command palette action, not automatic |
| Smart scheduling | Claude reviews Today list and suggests times based on patterns | Delivered via daily scheduled MCP job |
| Calendar integration | Read-only view of calendar events alongside Today tasks | View only — no write-back to calendar in 2.0 (OAuth complexity deferred) |

**Sync mechanism:** Obsidian integration runs through the existing MCP server extended with vault file access, driven by a scheduled Claude Code job. No separate service required.

---

## Decisions Log

- **Time on tasks deferred to 1.1** — schema migration, not blocking daily driver use
- **Sub-project depth capped at one level** — mirrors Things 3, keeps sidebar and data model clean
- **Calendar is read-only in 2.0** — write-back requires Google/Apple OAuth, deferred to 2.x
- **Obsidian sync is Claude-mediated** — MCP server + scheduled job, not a custom Obsidian plugin
