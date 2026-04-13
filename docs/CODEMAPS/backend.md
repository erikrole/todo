<!-- Generated: 2026-04-12 | Updated: 2026-04-12 (counts + duplicate routes, today_all filter) | Files scanned: 98 -->
# Backend

## Auth

`packages/web/src/proxy.ts` — middleware enforcing `Authorization: Bearer $NEXT_PUBLIC_AUTH_TOKEN` on all `/api/*` routes.

## REST API Routes

```
GET    /api/areas            → list areas (with counts)
POST   /api/areas            → create area
GET    /api/areas/[id]       → get area
PATCH  /api/areas/[id]       → update area (name, notes, color, isArchived)
DELETE /api/areas/[id]       → delete area

GET    /api/projects         → list projects (?areaId= filter)
POST   /api/projects         → create project
GET    /api/projects/[id]    → get project + subtasks
PATCH  /api/projects/[id]    → update project (max 1 level nesting enforced)
DELETE /api/projects/[id]    → delete project
POST   /api/projects/[id]/complete → complete project + optional completeAllTasks

GET    /api/sections         → list sections (?projectId= required)
POST   /api/sections         → create section
PATCH  /api/sections/[id]    → update section (title, position, isCollapsed)
DELETE /api/sections/[id]    → delete section (unassigns tasks, doesn't delete)

GET    /api/tasks            → list tasks (?filter=inbox|today|today_all|upcoming|someday|logbook|completed|trash|all, ?projectId=, ?areaId=)
POST   /api/tasks            → create task
GET    /api/tasks/counts     → { inbox, today, overdue } counts for sidebar badges
GET    /api/tasks/[id]       → get task + subtasks
PATCH  /api/tasks/[id]       → update task
DELETE /api/tasks/[id]       → soft-delete (sets deleted_at); ?permanent=true for hard delete
POST   /api/tasks/[id]/complete   → complete; creates next recurrence if recurring
POST   /api/tasks/[id]/uncomplete → revert completion
POST   /api/tasks/[id]/duplicate  → clone task (fractional position between original and next sibling)
POST   /api/tasks/[id]/restore    → clear deleted_at
```

## Task View Routing Logic

```
Inbox:     when_date IS NULL AND project_id IS NULL AND area_id IS NULL
           AND parent_task_id IS NULL AND is_completed=0 AND deleted_at IS NULL
           AND is_cancelled=0 AND is_someday=0
Today:     when_date = today AND parent_task_id IS NULL AND is_completed=0
           AND is_cancelled=0 AND deleted_at IS NULL
today_all: when_date <= today AND parent_task_id IS NULL AND deleted_at IS NULL
           (active + completed today + overdue; used by Today view for unified list)
Upcoming:  when_date > today AND parent_task_id IS NULL AND is_completed=0
           AND is_cancelled=0 AND deleted_at IS NULL
Someday:   is_someday=1 AND is_completed=0 AND deleted_at IS NULL
Logbook:   is_completed=1 AND parent_task_id IS NULL ORDER BY completed_at DESC
Trash:     deleted_at IS NOT NULL
```

## MCP Server (`packages/mcp`)

Entry: `src/index.ts` — registers tools via stdio transport.

| Tool | File |
|------|------|
| `list_tasks`, `create_task`, `update_task`, `complete_task` | `tools/tasks.ts` |
| `list_projects`, `create_project`, `complete_project` | `tools/projects.ts` |
| `list_areas` | `tools/areas.ts` |
| `list_sections`, `create_section`, `update_section`, `delete_section` | `tools/sections.ts` |
| `plan_project`, `apply_project_plan` | `tools/architect.ts` |

Key files: `src/lib/anthropic.ts` (Claude client), `src/lib/prompts.ts` (architect system prompt), `src/lib/architect-schema.ts` (Zod plan schema).

## Shared Schemas (`packages/shared/src/schemas.ts`)

Zod schemas: `CreateAreaSchema`, `UpdateAreaSchema`, `CreateProjectSchema`, `UpdateProjectSchema`, `CreateSectionSchema`, `UpdateSectionSchema`, `CreateTaskSchema`, `UpdateTaskSchema`. All exported as TypeScript types via `z.infer<>`.
