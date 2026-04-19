<!-- Generated: 2026-04-18 | Files scanned: ~50 | Token estimate: ~900 -->

# Backend

All routes: `packages/web/src/app/api/`. All require `Authorization: Bearer $NEXT_PUBLIC_AUTH_TOKEN`.
Response envelope: `{ data: T }` via `ok()` / `{ error }` via `err()` — except `/api/brief` → `{ brief }`.

## Route Map

### Tasks
```
GET    /api/tasks                         filter=inbox|today|today_all|upcoming|someday|logbook|trash|all; projectId, areaId
POST   /api/tasks                         create
GET    /api/tasks/counts                  → { inbox, today, overdue }
POST   /api/tasks/batch                   bulk complete/uncomplete/delete/restore/update
POST   /api/tasks/purge                   hard-delete all trashed tasks
GET    /api/tasks/[id]
PATCH  /api/tasks/[id]
DELETE /api/tasks/[id]                    soft delete; ?permanent=true for hard
POST   /api/tasks/[id]/complete           spawns next recurrence if recurring
POST   /api/tasks/[id]/uncomplete
POST   /api/tasks/[id]/duplicate          fractional position after original
POST   /api/tasks/[id]/restore
GET    /api/tasks/[id]/completions
POST   /api/tasks/[id]/completions
PATCH  /api/tasks/[id]/completions/[cid]
DELETE /api/tasks/[id]/completions/[cid]
POST   /api/tasks/[id]/completions/import bulk import
```

### Areas / Projects / Sections
```
GET|POST       /api/areas
GET|PATCH|DEL  /api/areas/[id]
GET|POST       /api/projects
GET|PATCH|DEL  /api/projects/[id]
POST           /api/projects/[id]/complete
GET|POST       /api/sections              ?projectId=
PATCH|DEL      /api/sections/[id]
```

### Logs & Entries
```
GET|POST       /api/logs                  list with entryCount; create
GET|PATCH|DEL  /api/logs/[id]
GET|POST       /api/logs/[id]/entries
POST           /api/logs/[id]/entries/batch  deduplication import
PATCH|DEL      /api/log-entries/[id]
```

### Life Tracking
```
GET|POST       /api/occasions             sorted by date
GET|PATCH|DEL  /api/occasions/[id]
GET|POST       /api/subscriptions         ?active=true
GET|PATCH|DEL  /api/subscriptions/[id]
```

### Routines
```
GET            /api/routines              active recurring tasks + lastCompletedAt (log or task_completions)
PATCH|DEL      /api/routines/[id]
POST           /api/routines/sync-dates   recalculate next recurrence dates
```

### Intelligence / Derived
```
GET  /api/insights                  overdue/approaching routines + oil change mileage alert
GET  /api/intelligence/vehicle      current odometer + last oil change
GET  /api/intelligence/appointment  AI-suggested next appointment date
GET  /api/calendar/events
GET  /api/weather
POST /api/brief                     AI briefing (claude-haiku-4.5, 80 tokens) → { brief }
POST /api/import/routines           bulk import routine completions
```

## Shared Utilities
`lib/api.ts` — `ok(data)`, `err(msg)`, `nowIso()`, `todayStr()`, `nextRecurrenceDate(from, type, interval)`
`lib/routine-links.ts` — `LINKED_LOG_SOURCES`, `LINKED_ROUTINE_TITLES`, `GAS_LOG_SLUG`, `OIL_CHANGE_INTERVAL_MILES`
`lib/fetch.ts` — typed fetch wrapper with Bearer token injection
`lib/dates.ts` — `parseNaturalDate`, `toLocalDateStr`, `fmtTime`, `formatWhenDate`

## MCP Tools (`packages/mcp/src/`)
Direct DB (no HTTP). Tools: `list_tasks`, `create_task`, `complete_task`, `update_task`, `list_projects`, `create_project`, `complete_project`, `list_areas`, `list_sections`, `create_section`, `update_section`, `delete_section`, `plan_project` (AI dry-run), `apply_project_plan` (atomic create).
