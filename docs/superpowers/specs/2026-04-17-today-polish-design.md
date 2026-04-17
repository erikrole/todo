# Today Page Polish — Design Spec

## Goal

Elevate the Today page from a flat task list into a structured daily dashboard: dynamic progress bar, routines surfaced inline, snooze controls on every task row, age-aware overdue triage, and a completion celebration.

## Structure

The page is organised into five zones from top to bottom:

1. **Header** — "Today" heading + long date (existing)
2. **Progress bar** — dynamic red→green fill with N/M counter
3. **Routines section** — due-today routines (collapsible)
4. **Events section** — hidden until calendar is connected (MVP: always hidden)
5. **Task sections** — Overdue / Morning / Day / Night / Anytime (existing, with snooze controls added)
6. **Completion celebration** — shown when all tasks and due routines are done

---

## Feature Specs

### 1. Dynamic Progress Bar

- **Scope:** counts all non-cancelled tasks fetched by `useTasks("today_all")` **plus** due-today routines.
- **Formula:** `pct = (completedTasks + completedDueRoutines) / (totalTasks + totalDueRoutines) * 100`
- **Color:** interpolates via inline style on the indicator element:
  - 0% → `hsl(0, 80%, 50%)` (red)
  - 100% → `hsl(120, 60%, 45%)` (green)
  - Interpolation: `hsl(${pct * 1.2}, ${80 - pct * 0.2}%, ${50 - pct * 0.05}%)` (smooth arc through yellow)
- **Component:** `TodayProgress` — thin wrapper around shadcn `Progress` that accepts an `indicatorStyle` prop forwarded to the inner div.
- **Visibility:** only rendered when `totalForProgress > 0`.
- **Counter:** `"N/M"` shown right of bar in `text-xs text-muted-foreground/65 tabular-nums`.

### 2. Routines Section

- **Data:** `useTasks("routines")` filtered client-side to `whenDate !== null && whenDate <= today` (overdue + due today). Excludes completed routines (already logged today).
- **Rendering:** reuses `RoutineItem` component from `packages/web/src/components/routines/routine-item.tsx` for each row.
- **Header:** "Routines" label (same style as Morning/Day/Night), with `"N due"` count badge when any are due.
- **Collapsible:** same `localStorage`-persisted collapse pattern as time-of-day sections, key `"todo-today-routines-collapsed"`.
- **Position:** rendered above the Overdue/task sections, below the progress bar.
- **Progress contribution:** completed due routines count toward the progress bar (see §1).

### 3. Events Section

- Renders `null` when `calendarConnected === false`.
- `calendarConnected` is a module-level constant `false` for MVP.
- Section header would be "Events"; body would show calendar events.
- No UI change in MVP — this is scaffolding only, ready for future wiring.

### 4. Snooze Controls

- **Component:** `TodaySnoozeControls` in `packages/web/src/components/today/snooze-controls.tsx`.
- **Trigger:** absolute-positioned pills, `opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity`, right-aligned on each task row.
- **Options:** Tomorrow · Someday · This Weekend
  - Tomorrow: `{ whenDate: tomorrowStr(), isSomeday: false }`
  - Someday: `{ whenDate: null, isSomeday: true }`
  - This Weekend: `{ whenDate: nextSaturdayStr(), isSomeday: false }`
- **Pill style:** identical to `InboxDispatchControls` pills — `rounded-full border border-border bg-card px-2.5 py-0.5 text-xs text-muted-foreground hover:text-foreground`.
- **Applied to:** all task rows — Overdue, Morning, Day, Night, Anytime sections.
- **Wrapper pattern:** each task row gets `<div className="group relative">` wrapping `<TaskItem>` + `<TodaySnoozeControls taskId={task.id} />`.
- **Overdue rows:** additionally show an age badge (`taskAge(task.createdAt)`) that fades out on hover (same as Inbox).

### 5. Overdue Triage

- **Age badge:** `pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground/35 tabular-nums opacity-100 group-hover:opacity-0 transition-opacity` — shows `taskAge(task.createdAt)`.
- **Snooze controls:** rendered on each overdue row (same as §4).
- **Section header color:** existing `text-destructive/80` retained.

### 6. Completion Celebration

- **Trigger:** `allDone = totalForProgress > 0 && completedCount === totalForProgress` (tasks + routines).
- **Placement:** rendered below all task sections, replacing empty section slots when all done.
- **Design:** a single subtle line — a small icon (e.g. `Sparkles` from lucide) + short message, `text-muted-foreground/50`, no animation.
- **Message:** `"All done for today"` in `text-sm font-medium` + optional sub-line `"Come back tomorrow."` in `text-xs`.

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Modify | `packages/web/src/components/ui/progress.tsx` | Add `indicatorStyle` prop |
| Create | `packages/web/src/components/today/today-progress.tsx` | Dynamic-color progress bar wrapper |
| Create | `packages/web/src/components/today/snooze-controls.tsx` | Hover snooze pills (Tomorrow / Someday / Weekend) |
| Modify | `packages/web/src/app/(views)/today/page.tsx` | Wire all features: routines section, snooze controls, age badges, celebration |

---

## Out of Scope

- Calendar event integration (Events section renders null for MVP)
- Drag-and-drop reordering within routines section
- Animated confetti or complex celebration sequences
- Per-row snooze confirmation dialogs
