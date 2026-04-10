# Personal Task Manager (Things 3-Inspired)

## Context

Build a personal task manager to replace Things 3. Standalone app with its own database, accessible from anywhere. Claude integrates via MCP for full CRUD. A nightly scheduled Claude job will audit local markdown files and sync via MCP. iOS app (Swift) comes later against the same REST API.

## All Decisions (Locked In)

### Stack
- **Next.js 15 + Turso** (hosted libSQL → Vercel deployment)
- Local SQLite file for dev (`better-sqlite3`), Turso for production — support both via env var
- MCP server connects to DB directly (not through API)

### Data / UX Decisions
- **Natural language dates in quick-add set `when_date`** (not deadline). Deadline is only set in the detail panel.
- **Sidebar**: tree layout — Areas as collapsible headers, Projects nested under their Area
- **Today view time sections**: Morning, Day, Night — tasks in Today are grouped into these three sections. Stored as `time_of_day` field on tasks (null/morning/day/night). Drag between sections to reassign.
- **Context-aware quick-add**: adding from Today auto-sets when_date=today, from a project auto-sets project_id, from an area auto-sets area_id. Adding from a time section (Morning/Day/Night) auto-sets that time_of_day.
- **Subtask parent completion**: manual (all subtasks done does NOT auto-complete parent)
- **Deadline warnings**: overdue = red badge, due within 3 days = amber badge, otherwise quiet date text
- **Upcoming view**: date-grouped vertical list (no calendar widget). Headers: "Tomorrow", "Friday", "April 14"...
- **Offline/PWA**: read-only offline (cache recent data). Writes require connectivity.
- **Visual style**: shadcn/ui with **Luma preset**. Things 3 / Notion / Linear mashup. Lean into shadcn components — avoid hand-rolling UI elements. Use shadcn's Checkbox, Card, Sheet, Command, Calendar, Select, Popover, Sidebar, Badge, Separator, Tooltip, DropdownMenu, etc.
- **Recurrence picker**: mode selector first ("after completion" | on a schedule), then preset (daily/weekly/monthly/yearly) + custom interval. Mirrors Things 3 UI. "After completion" = next when_date rolls from completion date; "on schedule" = next when_date rolls from original when_date.
- **Mobile sidebar**: hamburger menu overlay on narrow screens
- **Auth**: single shared Bearer token from `AUTH_TOKEN` env var. No login page.

## Tech Stack (Confirmed)

- **Next.js 15** (App Router) — frontend + API routes in one project
- **Turso** (hosted libSQL) for production — SQLite-compatible, free tier, works serverless
- **better-sqlite3** for local dev — zero config, fast, same schema via Drizzle
- **Drizzle ORM** — abstracts driver; `@libsql/client` for Turso, `better-sqlite3` for local
- **Deploy to Vercel** (user already uses)
- **MCP server** — separate package, runs locally, connects to DB directly (local SQLite or Turso)
- **TypeScript** (strict mode)
- **shadcn/ui** + **Tailwind CSS v4** — init with `npx shadcn@latest init` then apply preset `b2D0wqNxT`
- **TanStack Query v5** (React Query) — server state + optimistic updates
- **Framer Motion** — completion animations, layout transitions
- **@dnd-kit** — drag-to-reorder
- **chrono-node** — natural language date parsing ("tomorrow", "next monday")
- **cmdk** — Cmd+K command palette (shadcn has this built-in)
- **nanoid** — ID generation
- **@modelcontextprotocol/sdk** — MCP server (stdio transport)

## Project Structure

```
todo/
├── pnpm-workspace.yaml
├── package.json                  # root workspace
├── tsconfig.base.json
├── .gitignore
├── .prettierrc
├── packages/
│   ├── shared/                   # shared types + Zod schemas
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── index.ts
│   │       ├── types.ts
│   │       └── schemas.ts
│   ├── db/                       # Drizzle schema + client (used by web + mcp)
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── drizzle.config.ts
│   │   └── src/
│   │       ├── schema.ts         # areas, projects, tasks tables
│   │       ├── index.ts          # Turso client export
│   │       └── seed.ts           # dev seed data
│   ├── web/                      # Next.js 15 app (frontend + API)
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── next.config.ts
│   │   ├── tailwind.config.ts
│   │   ├── components.json       # shadcn/ui
│   │   └── src/
│   │       ├── app/
│   │       │   ├── layout.tsx
│   │       │   ├── page.tsx      # redirect to /inbox
│   │       │   ├── (views)/      # route group for main views
│   │       │   │   ├── inbox/page.tsx
│   │       │   │   ├── today/page.tsx
│   │       │   │   ├── upcoming/page.tsx
│   │       │   │   ├── logbook/page.tsx
│   │       │   │   ├── project/[id]/page.tsx
│   │       │   │   └── area/[id]/page.tsx
│   │       │   └── api/          # REST API routes (for iOS + MCP)
│   │       │       ├── tasks/route.ts
│   │       │       ├── tasks/[id]/route.ts
│   │       │       ├── tasks/[id]/complete/route.ts
│   │       │       ├── projects/route.ts
│   │       │       ├── projects/[id]/route.ts
│   │       │       ├── projects/[id]/complete/route.ts
│   │       │       ├── areas/route.ts
│   │       │       └── areas/[id]/route.ts
│   │       ├── components/
│   │       │   ├── ui/           # shadcn primitives
│   │       │   ├── layout/
│   │       │   │   ├── app-shell.tsx
│   │       │   │   └── sidebar.tsx
│   │       │   ├── tasks/
│   │       │   │   ├── task-list.tsx
│   │       │   │   ├── task-item.tsx
│   │       │   │   ├── task-detail.tsx
│   │       │   │   ├── task-quick-add.tsx
│   │       │   │   ├── task-checkbox.tsx
│   │       │   │   └── subtask-list.tsx
│   │       │   ├── projects/
│   │       │   │   └── project-list.tsx
│   │       │   └── command-palette.tsx
│   │       ├── hooks/
│   │       │   ├── use-tasks.ts
│   │       │   ├── use-projects.ts
│   │       │   └── use-areas.ts
│   │       └── lib/
│   │           ├── api.ts        # fetch wrapper
│   │           ├── utils.ts      # cn() helper
│   │           └── dates.ts      # chrono-node integration
│   └── mcp/                      # MCP server (separate process)
│       ├── package.json
│       ├── tsconfig.json
│       └── src/
│           ├── index.ts          # stdio server entry
│           └── tools/
│               ├── tasks.ts
│               ├── projects.ts
│               └── areas.ts
```

**Key architecture decisions:**
- **Next.js API routes serve as the REST API** — both the web frontend and future iOS app use these
- **MCP server connects to Turso directly** (not through the API) — works even when the web app is down, no HTTP hop for local usage
- **Both `web` and `mcp` import `@todo/db`** for shared schema/client
- **`packages/shared`** has Zod schemas used by API routes, MCP tools, and frontend validation

## Database Schema

### `areas` table
| Column | Type | Notes |
|---|---|---|
| id | text PK | nanoid |
| name | text NOT NULL | |
| notes | text | markdown |
| color | text | hex color |
| is_archived | integer DEFAULT 0 | boolean |
| position | real DEFAULT 0 | fractional indexing |
| created_at | text | ISO 8601 |
| updated_at | text | ISO 8601 |

### `projects` table
| Column | Type | Notes |
|---|---|---|
| id | text PK | nanoid |
| name | text NOT NULL | |
| notes | text | markdown |
| color | text | hex color |
| area_id | text FK | -> areas.id, ON DELETE SET NULL |
| is_completed | integer DEFAULT 0 | |
| completed_at | text | |
| position | real DEFAULT 0 | |
| created_at | text | |
| updated_at | text | |

### `tasks` table
| Column | Type | Notes |
|---|---|---|
| id | text PK | nanoid |
| title | text NOT NULL | |
| notes | text | markdown |
| when_date | text | YYYY-MM-DD; routes to Today/Upcoming |
| time_of_day | text | null / morning / day / night; groups within Today view |
| deadline | text | YYYY-MM-DD; actual due date, warning badge |
| project_id | text FK | -> projects.id, ON DELETE SET NULL |
| area_id | text FK | -> areas.id, ON DELETE SET NULL (for tasks not in a project) |
| parent_task_id | text FK | -> tasks.id, ON DELETE CASCADE (subtasks) |
| is_completed | integer DEFAULT 0 | |
| completed_at | text | |
| recurrence_type | text | null / daily / weekly / monthly / yearly / custom |
| recurrence_mode | text | null / on_schedule / after_completion |
| recurrence_interval | integer | e.g. 2 for "every 2 weeks" |
| recurrence_ends_at | text | optional end date |
| position | real DEFAULT 0 | |
| created_at | text | |
| updated_at | text | |

**Routing logic:**
- **Inbox:** `when_date IS NULL AND project_id IS NULL AND area_id IS NULL AND parent_task_id IS NULL AND is_completed = 0`
- **Today:** `when_date = :today AND parent_task_id IS NULL AND is_completed = 0`
- **Upcoming:** `when_date > :today AND parent_task_id IS NULL AND is_completed = 0`
- **Logbook:** `is_completed = 1 AND parent_task_id IS NULL ORDER BY completed_at DESC`
- **By project:** `project_id = :id AND parent_task_id IS NULL AND is_completed = 0`
- **Subtasks:** `parent_task_id = :taskId`

## API Routes

### Tasks
| Method | Path | Description |
|---|---|---|
| GET | /api/tasks | List with ?filter=inbox\|today\|upcoming\|completed&projectId=X&areaId=X |
| POST | /api/tasks | Create (body: title, notes?, whenDate?, deadline?, projectId?, areaId?, parentTaskId?) |
| GET | /api/tasks/[id] | Get single task (includes subtasks) |
| PATCH | /api/tasks/[id] | Update partial fields |
| POST | /api/tasks/[id]/complete | Mark complete; creates next recurrence if recurring |
| DELETE | /api/tasks/[id] | Delete (cascades subtasks) |

### Projects
| Method | Path | Description |
|---|---|---|
| GET | /api/projects | List with task counts, optionally filter by areaId |
| POST | /api/projects | Create |
| PATCH | /api/projects/[id] | Update |
| POST | /api/projects/[id]/complete | Complete (optionally complete all tasks) |
| DELETE | /api/projects/[id] | Delete |

### Areas
| Method | Path | Description |
|---|---|---|
| GET | /api/areas | List (with project + task counts) |
| POST | /api/areas | Create |
| PATCH | /api/areas/[id] | Update (including archive/unarchive) |
| DELETE | /api/areas/[id] | Delete |

All responses: `{ data: T }`. Auth: `Authorization: Bearer <token>` checked in middleware.

## MCP Tools (7+)

1. **list_tasks** — filter: inbox/today/upcoming/completed/all, by projectId, by areaId
2. **create_task** — title (required), notes, whenDate, deadline, projectId, areaId, parentTaskId
3. **update_task** — id (required), any updatable field
4. **complete_task** — id; handles recurrence (creates next instance)
5. **list_projects** — with task counts, optionally by areaId
6. **create_project** — name (required), notes, color, areaId
7. **complete_project** — id, optionally complete all tasks
8. **list_areas** — all active areas with project/task counts

## Build Order

### Phase 0: Scaffolding
- [x] Root monorepo config (package.json, pnpm-workspace, tsconfig.base, .gitignore, .prettierrc)
- [x] packages/shared — types.ts stub created
- [ ] **Clean up original Vite+Express scaffolding** — remove packages/api, update root to reflect Next.js
- [ ] packages/db — Drizzle schema (areas + projects + tasks), Turso client, run migrations
- [ ] packages/web — `npx create-next-app@latest`, configure shadcn/ui, Tailwind, TanStack Query
- [ ] packages/mcp — MCP server skeleton with stdio transport
- [ ] packages/shared — complete types.ts + schemas.ts for all entities

### Phase 1: Database + API Routes
- [ ] Task CRUD API routes with filter logic (inbox/today/upcoming/logbook)
- [ ] Project CRUD API routes with area FK + task counts
- [ ] Area CRUD API routes
- [ ] Auth middleware (Bearer token from env var)
- [ ] Recurring task completion logic (creates next instance)

### Phase 2: Frontend Shell
- [ ] AppShell + Sidebar (Inbox/Today/Upcoming/Logbook + Areas/Projects tree)
- [ ] React Router pages (inbox, today, upcoming, logbook, project/[id], area/[id])
- [ ] Cmd+K command palette (search + navigation + quick actions)
- [ ] TaskList + TaskItem (displays when_date, deadline with warning badge)
- [ ] TaskQuickAdd with chrono-node natural language date input
- [ ] TaskDetailPanel (Sheet: all fields, subtask list, recurrence picker)

### Phase 3: Pages + Polish
- [ ] InboxPage, TodayPage, UpcomingPage (grouped by date)
- [ ] LogbookPage (completed tasks, grouped by date, filterable)
- [ ] ProjectPage (tasks, progress, project header)
- [ ] AreaPage (projects list, loose tasks)
- [ ] Completion animations (Framer Motion — checkbox fill, row fade-out)
- [ ] Drag-to-reorder (@dnd-kit, fractional position PATCH)
- [ ] Dark mode (system preference + manual toggle)

### Phase 4: MCP Server
- [ ] All 8 tools with Zod validation, Drizzle queries to Turso
- [ ] Recurring task completion handler (respects recurrence_mode: on_schedule vs after_completion)
- [ ] Test with MCP inspector
- [ ] Register server in both config locations:
  - Claude Desktop: `~/Library/Application Support/Claude/claude_desktop_config.json`
  - Claude Code: `.claude/settings.json` (project-level MCP server)

### Phase 5: Production
- [ ] PWA manifest + service worker (offline support)
- [ ] Vercel deployment config
- [ ] Environment variables: TURSO_URL, TURSO_AUTH_TOKEN, AUTH_TOKEN
- [ ] Commit + push

## Verification

1. `pnpm dev` starts Next.js dev server with hot reload
2. Create task in Inbox via UI → appears in list
3. Set when_date to today → moves to Today view
4. Set future when_date → appears in Upcoming grouped by date
5. Add deadline → warning badge shows when near/overdue
6. Create subtask on a task → appears in detail panel with its own dates
7. Complete a recurring task → next instance auto-created
8. Cmd+K → search tasks, navigate to views
9. Type "tomorrow" in date field → parses to correct date
10. Complete task → animation plays, task moves to Logbook
11. MCP: `npx @modelcontextprotocol/inspector` → all 8 tools work
12. `vercel build` succeeds, deploys, accessible from phone
