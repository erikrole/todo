<!-- Generated: 2026-04-17 | Updated: today components, inbox dispatch, routines, completions | Files scanned: 110+ -->
# Frontend

## Page Tree (`packages/web/src/app/`)

```
layout.tsx              Root — fonts, Providers
providers.tsx           QueryClient, ThemeProvider, KeyboardProvider, CommandPalette, Toaster
page.tsx                / → redirect to /inbox

(views)/layout.tsx      Shell with AppSidebar + TaskDndProvider
(views)/inbox/          Inbox view
(views)/today/          Today view — grouped by time_of_day (Morning/Day/Night)
(views)/upcoming/       Upcoming — grouped by when_date
(views)/someday/        Someday
(views)/logbook/        Completed tasks
(views)/trash/          Soft-deleted tasks
(views)/project/[id]/   Project page — sections + tasks + notes
(views)/area/[id]/      Area page — projects grid + loose tasks + notes
(views)/settings/shortcuts/  Keyboard shortcut rebinding UI
```

## Component Hierarchy

```
AppSidebar (sidebar.tsx, ~624 lines)
  ├── NAV_ITEMS (Inbox/Today/Upcoming/Someday/Logbook/Trash)
  ├── AreaItem[]            ← per-area collapsible with context menu (CRUD)
  │   └── ProjectItem[]     ← sub-projects with context menu (rename/delete)
  ├── ProjectItem[]         ← top-level standalone projects
  │   └── ProjectItem[]     ← sub-projects (1 level max)
  └── SidebarFooter         ← Settings (Keyboard Shortcuts) link + ThemeToggle

TaskDndProvider (task-dnd-provider.tsx)
  └── DndContext            ← @dnd-kit global drag handler
      └── TaskList (task-list.tsx)
          ├── TaskItem[]  (task-item.tsx, ~794 lines)
          │   ├── TaskCheckbox
          │   ├── ContextMenu (move to view/project/section, complete, delete)
          │   ├── data-task-id / data-focused attrs  ← keyboard focus ring
          │   └── ExpandedPanel (inline expanded detail)
          │       ├── Notes textarea (auto-save on blur)
          │       ├── Date picker (Popover + Calendar)
          │       ├── Time-of-day segmented control (Morning/Day/Evening)
          │       ├── Deadline picker (Popover + Calendar)
          │       ├── Recurrence picker (Popover — Daily/Weekly/Monthly/Yearly)
          │       ├── Subtask list + inline add
          │       └── Delete button
          └── TaskQuickAdd (task-quick-add.tsx)  ← exposes focus() handle via forwardRef
              └── NLP parse preview chips (date, time, project, deadline)

TodayProgress (components/today/today-progress.tsx)
  └── Progress bar clamped 0-100%, color ramps red→green via inline style

TodaySnoozeControls (components/today/snooze-controls.tsx)
  └── Tomorrow / Someday / Weekend pill buttons for deferring today tasks

TodayRoutineRow (components/today/today-routine-row.tsx)
  └── Compact row for routines in the Today view Routines section

InboxDispatchControls (components/inbox/dispatch-controls.tsx)
  └── Today / Tomorrow / overflow dropdown dispatch pills for inbox tasks

RoutineItem (components/routines/routine-item.tsx)
  └── Split completion button (log today + past date), streak ring, status ring

StatusRing (components/routines/status-ring.tsx)
  └── SVG ring showing routine completion status

CompletionHistorySheet (components/routines/completion-history-sheet.tsx)
  └── 90-day habit grid + stats + add-entry button, opened from routine item

LogCompletionPopover (components/routines/log-completion-popover.tsx)
  └── Date picker for logging a past completion

SectionBlock (section-block.tsx)
  └── @dnd-kit/sortable — section drag reorder within project page

CommandPalette (command-palette.tsx)  ← Cmd+K (via keyboard system)
  └── CommandDialog → navigate views/projects/areas OR create task with NLP

KeyboardProvider (components/keyboard/keyboard-provider.tsx)  ← wraps all views
  ├── ShortcutsOverlay (shortcuts-overlay.tsx)  ← ? quick-reference modal
  └── useShortcutAction / useRegisterTaskList / useFocusedTask hooks
```

## State Management

All server state via **TanStack Query v5**.

| Hook | Query key | Description |
|------|-----------|-------------|
| `useAreas` | `["areas"]` | All areas |
| `useProjects` | `["projects", areaId?]` | Projects (optionally by area) |
| `useSections` | `["sections", projectId]` | Sections for a project |
| `useTasks` | `["tasks", view, projectId?, areaId?]` | Tasks by view/scope |
| `useTask` | `["task", id]` | Single task + subtasks |
| `useTaskCounts` | `["task-counts"]` | `{ inbox, today, overdue }` counts for sidebar badges (staleTime: 60s) |

Mutations invalidate parent query keys on success. Optimistic updates used for section drag reorder and task complete/uncomplete (removes from inbox immediately; marks completed in today_all).

## Key Libraries

| Lib | Usage |
|-----|-------|
| `@dnd-kit/core` + `@dnd-kit/sortable` | Drag tasks between views; drag sections within project |
| `framer-motion` | Task expand/collapse animation, task completion fade-out |
| `chrono-node` | NLP date parsing in `parseTaskInput` |
| `react-day-picker` | Calendar UI in date/deadline pickers |
| `next-themes` | Dark/light mode |
| `sonner` | Toast notifications with undo support |

## Utility Files (`src/lib/`)

- `parse-task.ts` — NLP token extraction (date, time-of-day, project, deadline, someday)
- `dates.ts` — `formatWhenDate`, `fmtTime`, `deadlineUrgency`, `toLocalDateStr`, `parseNaturalDate`
- `fetch.ts` — `api` object with typed `.get/.post/.patch/.delete`
- `toast.ts` — `notify.success / notify.error / notify.undoable`
- `keyboard/shortcut-config.ts` — `SHORTCUT_DEFS` (20 shortcuts), `eventToKey`, `matchesKey`, `loadOverrides`, `saveOverrides`, `formatKeyParts`; localStorage key: `todo-keyboard-shortcuts`
- `completions.ts` — `recomputeIntervals(canonicalId)` — recalculates `interval_actual` for all completion rows of a recurring task chain

## DnD Drop ID Convention

```
sidebar:inbox | sidebar:today | sidebar:upcoming | sidebar:someday
sidebar:area:{id}
sidebar:project:{id}
section:project:{id}       ← unsectioned tasks in project
section:area:{id}          ← loose tasks in area
section:{sectionId}        ← tasks in a named section
section:upcoming:{date}    ← tasks in an upcoming date group
```
