<!-- Generated: 2026-04-18 | Files scanned: ~40 | Token estimate: ~700 -->

# Frontend

Next.js App Router. Views: `packages/web/src/app/(upshot)/v2/`.
Data: TanStack Query hooks. UI: shadcn/ui primitives only.

## Page Tree
```
(upshot)/v2/
├── page.tsx               Dashboard/home
├── inbox/page.tsx         Inbox (no date/project/area)
├── today/page.tsx         Today (when_date = today)
├── upcoming/page.tsx      Upcoming (when_date > today)
├── someday/page.tsx       Someday (isSomeday = true)
├── logbook/page.tsx       Logbook (completed tasks)
├── trash/page.tsx         Trash (soft-deleted)
├── area/[id]/page.tsx     Area detail
├── project/[id]/page.tsx  Project detail (sections + tasks)
├── logs/
│   ├── page.tsx           Logs index (all logs with entry counts)
│   └── [slug]/page.tsx    Single log (entries list + add form)
├── routines/page.tsx      Routines manager (recurring tasks + completion rings)
├── subscriptions/page.tsx Subscriptions tracker
├── occasions/page.tsx     Occasions (birthdays, anniversaries, events)
└── import/page.tsx        Import/migration tool
```

## Component Hierarchy
```
Shell (upshot/shell.tsx)
├── Sidebar (upshot/sidebar.tsx)          area/project nav, task counts, new-area inline input
├── CommandBar (upshot/command-bar.tsx)   Cmd+K palette (NLP task create + navigation)
├── ContextRail (upshot/context-rail.tsx) AI assistant rail
└── <Page Content>
    ├── task-row.tsx                      single task row (checkbox, title, badges)
    ├── tasks/task-item.tsx               expanded task panel (date, recurrence, subtasks)
    ├── tasks/bulk-action-bar.tsx         multi-select actions
    ├── today/today-progress.tsx          progress ring
    ├── today/today-routine-row.tsx       routine row in today view
    ├── routines/routine-item.tsx         routine card with status ring
    ├── routines/completion-history-sheet.tsx
    ├── routines/import-sheet.tsx
    └── dnd/task-dnd-provider.tsx         drag-and-drop context
```

## Hooks → Endpoints
```
use-tasks.ts          → /api/tasks (all CRUD + complete/batch/counts)
use-areas.ts          → /api/areas
use-projects.ts       → /api/projects
use-sections.ts       → /api/sections
use-logs.ts           → /api/logs, /api/log-entries
use-routines.ts       → /api/routines
use-subscriptions.ts  → /api/subscriptions
use-occasions.ts      → /api/occasions
use-insights.ts       → /api/insights
use-calendar-events.ts → /api/calendar/events
use-weather.ts        → /api/weather
use-selection.tsx     → local state (multi-select)
use-density.ts        → localStorage
use-accent-color.ts   → localStorage
use-mobile.ts         → window.matchMedia
```

## State Management
- Server state: TanStack Query (all hooks in `src/hooks/`)
- UI state: React local state + localStorage (sidebar collapse, density, accent color)
- No global client store

## UI Conventions
- NLP date parsing via `chrono-node` → `when_date` (never `deadline`)
- Deadline only from expanded task panel flag picker
- Context-aware quick-add: infers project/area/date/time_of_day from current view
- Double-submit guard: `submittedRef = useRef(false)` on async form submissions
- Toasts: `notify.success()` / `notify.error()` from `lib/toast.ts`
- All mutations in hooks include `onError: notify.error(...)` and `onSuccess: notify.success(...)` for create/delete
