<!-- Generated: 2026-04-17 | Files scanned: 110+ | Token estimate: ~600 -->
# Data

## Schema (`packages/db/src/schema.ts`)

```
areas
  id (PK), name, notes, color
  is_archived, position (real)
  created_at, updated_at

projects
  id (PK), name, notes, color
  area_id → areas.id (SET NULL)
  parent_project_id → projects.id (CASCADE)  ← 1 level max enforced in API
  is_completed, completed_at, position (real)
  created_at, updated_at
  IDX: area_id, is_completed, parent_project_id

sections
  id (PK), project_id → projects.id (CASCADE)
  title, position (real), is_collapsed
  created_at, updated_at
  IDX: project_id

tasks
  id (PK), title, notes
  when_date (YYYY-MM-DD)     ← routes to Today/Upcoming
  time_of_day (morning|day|night|null)
  scheduled_time (HH:MM)
  deadline (YYYY-MM-DD)
  project_id → projects.id (SET NULL)
  area_id → areas.id (SET NULL)
  section_id → sections.id (SET NULL)
  parent_task_id             ← subtask (no FK, manual cascade)
  spawned_from_task_id       ← recurrence chain canonical ID
  is_someday, is_completed, completed_at
  is_cancelled, deleted_at   ← soft delete
  recurrence_type (daily|weekly|monthly|yearly|custom)
  recurrence_mode (on_schedule|after_completion)
  recurrence_interval (int), recurrence_ends_at
  position (real)
  created_at, updated_at
  IDX: project_id, area_id, when_date, is_completed, deleted_at, parent_task_id

task_completions            ← routine/recurring task history log
  id (PK), task_id → tasks.id (CASCADE)
  completed_at (ISO string)
  interval_actual (real)    ← days since prior completion, recomputed on each change
  notes
  created_at
  IDX: task_id, completed_at
```

## Relationships

```
areas 1──* projects 1──* sections
areas 1──* tasks
projects 1──* tasks
sections 1──* tasks
tasks 1──* tasks (subtasks via parent_task_id)
tasks 1──* tasks (recurrence chain via spawned_from_task_id)
projects 1──* projects (sub-projects via parent_project_id, 1 level)
tasks 1──* task_completions (routine completion history)
```

## Position / Ordering

All tables use a `position real` column with fractional indexing (O(1) insert between two items by averaging neighbors). No renumbering needed on reorder.

## Recurrence Logic

On `complete_task`:
- `on_schedule`: next `when_date` = original `when_date` + interval
- `after_completion`: next `when_date` = today + interval
- New task cloned from parent with incremented date; parent marked completed

## Driver Config

| Environment | Driver | Connection |
|-------------|--------|------------|
| Local dev | `@libsql/client` | `file:packages/db/local.db` |
| Production | `@libsql/client` | `TURSO_URL` + `TURSO_AUTH_TOKEN` |

Migrations: `drizzle-kit` via `pnpm db:generate` / `pnpm db:migrate`.
