# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm dev          # Start Next.js dev server (web)
pnpm build        # Build web + mcp packages
pnpm format       # Run Prettier across all files

# Database
pnpm db:generate  # drizzle-kit generate migrations
pnpm db:migrate   # drizzle-kit apply migrations
pnpm db:seed      # populate local.db with dev sample data (clears existing data)
```

```bash
pnpm e2e        # Run Playwright E2E tests (headless, reuses running dev server)
pnpm e2e:ui     # Open Playwright UI for interactive test runs
```

Tests live in `packages/web/e2e/`. The dev server must be running (or `pnpm e2e` will start it automatically).

## Architecture

This is a **pnpm monorepo** for a personal task manager (Things 3-inspired).

### Package layout

| Package | Purpose |
|---|---|
| `packages/shared` | Shared TypeScript types + Zod schemas (imported by web and mcp) |
| `packages/db` | Drizzle ORM schema + libsql client; migrations via drizzle-kit |
| `packages/web` | Next.js App Router — frontend UI + REST API routes |
| `packages/mcp` | Standalone MCP server via stdio transport |

### Key architectural decisions

**Single driver, two targets.** `packages/db` always uses `@libsql/client` — locally with `file:local.db` (no native build needed), in production with a Turso URL. Same Drizzle schema, same driver, zero native compilation.

**Next.js as full-stack.** All REST API routes live under `packages/web/src/app/api/`. These serve both the web frontend (via TanStack Query hooks) and the future iOS Swift app. Auth is a single Bearer token (`NEXT_PUBLIC_AUTH_TOKEN` env var) enforced in `packages/web/src/app/proxy.ts` (the middleware file for this Next.js version) — no auth library, no login page.

**MCP server connects to DB directly.** `packages/mcp` imports `@todo/db` and writes to Turso/SQLite without an HTTP hop. This means MCP tools work even when the web app is not running.

**Task routing logic** (determines which view a task appears in):
- **Inbox:** `when_date IS NULL AND project_id IS NULL AND area_id IS NULL AND parent_task_id IS NULL AND is_completed = 0`
- **Today:** `when_date = today AND parent_task_id IS NULL AND is_completed = 0`
- **Upcoming:** `when_date > today AND parent_task_id IS NULL AND is_completed = 0`
- **Logbook:** `is_completed = 1 AND parent_task_id IS NULL ORDER BY completed_at DESC`

**Fractional indexing for position.** The `position` column is a `real` (float) on all three tables, enabling O(1) drag-reorder without renumbering rows.

**Recurrence.** Completing a recurring task creates the next instance. Two modes (stored as `recurrence_mode`): `on_schedule` — next `when_date` advances from the original `when_date` (strict calendar); `after_completion` — next `when_date` = completion date + interval (Things 3 style). Parent completion is always manual.

### Database schema summary

Core task tables: `areas` → `projects` (area_id FK) → `tasks` (project_id / area_id / parent_task_id FKs). Key task fields: `when_date` (YYYY-MM-DD, routes to Today/Upcoming), `time_of_day` (null/morning/day/night, groups within Today), `deadline` (separate from when_date; drives warning badges), `recurrence_type`, `recurrence_mode` (on_schedule | after_completion), `recurrence_interval`, `recurrence_ends_at`.

Companion tables (added in migrations 0008–0010):
- **`logs`** — named logs with a unique `slug` (e.g. "gas", "mowing", "health")
- **`log_entries`** — timestamped JSONB entries belonging to a log; `data` stores type-specific fields
- **`occasions`** — recurring personal events (birthdays, anniversaries); fields: `occasion_type`, `person_name`, `start_year`, `month`, `day`
- **`subscriptions`** — tracked recurring expenses; fields: `name`, `amount`, `billing_cycle`, `next_billing_date`, `is_active`, `is_split`

Shared utility in `packages/web/src/lib/routine-links.ts`: `LINKED_LOG_SOURCES` and `LINKED_ROUTINE_TITLES` map routine task titles to their log slugs/type filters for completion tracking.

### Environment variables

| Variable | Used by | Purpose |
|---|---|---|
| `TURSO_URL` | db, mcp | Turso database URL |
| `TURSO_AUTH_TOKEN` | db, mcp | Turso auth token |
| `NEXT_PUBLIC_AUTH_TOKEN` | web (proxy + browser client) | Bearer token for REST API |
| `ANTHROPIC_API_KEY` | mcp | Required for `plan_project` / `apply_project_plan` architect tools |
| `ARCHITECT_MODEL` | mcp | Override Claude model for architect tools (default: `claude-sonnet-4-6`) |

Local dev uses a SQLite file (`better-sqlite3`) when `TURSO_URL` is absent.

### Deployment

- **Production URL:** https://todo.erikrole.com
- **Vercel project:** `erikroles-projects/todo`
- **Deploy:** `vercel --prod` from repo root
- **Env vars:** `vercel env ls production` / `vercel env pull`
- **DB:** Turso `todo-prod` (libsql://todo-prod-erikrole.aws-us-east-1.turso.io)

### Code style

Prettier config: double quotes, semicolons, trailing commas, 100-char print width. Run `pnpm format` before committing.

TypeScript strict mode is enabled. All packages extend `tsconfig.base.json`.

### API routes

| Route | Methods | Description |
|---|---|---|
| `/api/areas` | GET, POST | List / create areas |
| `/api/areas/[id]` | GET, PATCH, DELETE | Get / update / delete area |
| `/api/projects` | GET, POST | List / create projects |
| `/api/projects/[id]` | GET, PATCH, DELETE | Get / update / delete project |
| `/api/projects/[id]/complete` | POST | Complete a project |
| `/api/sections` | GET, POST | List / create sections (scoped to project via `?projectId=`) |
| `/api/sections/[id]` | PATCH, DELETE | Update / delete section |
| `/api/tasks` | GET, POST | List / create tasks (filter via `?filter=inbox\|today\|today_all\|upcoming\|someday\|logbook\|trash\|all`, `?projectId=`, `?areaId=`) |
| `/api/tasks/counts` | GET | `{ inbox, today, overdue }` counts for sidebar badges |
| `/api/tasks/[id]` | GET, PATCH, DELETE | Get / update / delete task (`?permanent=true` for hard delete) |
| `/api/tasks/[id]/complete` | POST | Complete task (creates next recurrence if applicable) |
| `/api/tasks/[id]/uncomplete` | POST | Revert completion |
| `/api/tasks/[id]/duplicate` | POST | Clone task (inserted after original via fractional indexing) |
| `/api/tasks/[id]/restore` | POST | Restore soft-deleted task |
| `/api/logs` | GET, POST | List logs with entry counts; create new log |
| `/api/logs/[id]` | GET, PATCH, DELETE | Retrieve, update, or delete a log |
| `/api/logs/[id]/entries` | GET, POST | List log entries; create entry for a log |
| `/api/logs/[id]/entries/batch` | POST | Batch import log entries with deduplication |
| `/api/log-entries/[id]` | PATCH, DELETE | Update or delete a log entry |
| `/api/occasions` | GET, POST | List occasions sorted by date; create occasion |
| `/api/occasions/[id]` | GET, PATCH, DELETE | Retrieve, update, or delete an occasion |
| `/api/subscriptions` | GET, POST | List subscriptions (`?active=true` for active only); create subscription |
| `/api/subscriptions/[id]` | GET, PATCH, DELETE | Retrieve, update, or delete a subscription |
| `/api/routines` | GET | List active recurring tasks with last-completion from log entries or task_completions |
| `/api/routines/[id]` | PATCH, DELETE | Update routine metadata; delete routine |
| `/api/routines/sync-dates` | POST | Recalculate and set next recurrence dates |
| `/api/insights` | GET | Computed insights: overdue/approaching routines, oil change mileage |
| `/api/intelligence/vehicle` | GET | Vehicle mileage and oil change status |
| `/api/intelligence/appointment` | GET | AI-suggested next appointment date |
| `/api/import/routines` | POST | Bulk import routine completions; optionally create missing routines |
| `/api/brief` | POST | AI-generated one-sentence daily briefing (uses `ANTHROPIC_API_KEY`) |

All routes require `Authorization: Bearer $NEXT_PUBLIC_AUTH_TOKEN`.

### UI conventions

- Use shadcn/ui components exclusively — avoid hand-rolling UI primitives
- Natural language dates (via `chrono-node`) set `when_date`, never `deadline`
- Deadline is only set from the task detail panel or the expanded task panel's flag picker
- Context-aware quick-add: infer `when_date`, `project_id`, `area_id`, `time_of_day` from the current view when creating tasks
- Expanded task panel: inline date picker (Popover + Calendar), time-of-day segmented control (Morning/Day/Evening), deadline picker, recurrence picker, subtasks, notes
- Command palette (`Cmd+K`): navigate to views/projects/areas or create a task with NLP parsing
- Sidebar: area CRUD and project CRUD via right-click context menus; inline inline-input creation; collapsible with `localStorage`-persisted state
- Double-submit guard: use a `submittedRef = useRef(false)` pattern on all async form submissions to prevent duplicate mutations on blur+Enter race
