# Today View: Unified Task List Design

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the split active/completed task list architecture in Today view with a single unified list per time-of-day section, eliminating animation glitches caused by tasks "moving" between two separate React component trees.

**Root cause of existing bugs:** Task completion triggered removal from one `TaskList` component and insertion into another. Two competing `AnimatePresence` layers (one inside `TaskItem`, one in `TaskList`) fought over the same task's exit animation, and two independent query refetches for `"today"` and `"completed_today"` completed at slightly different times — creating a race condition where the task briefly disappeared from both lists simultaneously.

**Solution:** One query, one list per section, completion = visual state change only.

---

## Architecture

### Data layer

**New API filter: `"today_all"`**

A single GET `/api/tasks?filter=today_all` returns all tasks relevant to Today view in one response:
- Active tasks due today (`when_date = today, is_completed = 0, is_cancelled = 0`)
- Overdue tasks (`when_date < today, is_completed = 0, is_cancelled = 0`)
- Completed today (`is_completed = 1, date(completed_at) = today`)

All in one array, one cache key `["tasks", "today_all"]`, one refetch. No race conditions possible.

Server implementation uses Drizzle's `or()` to combine the two groups:
```
OR(
  AND(lte(whenDate, today), eq(isCompleted, false), eq(isCancelled, false), isNull(parentTaskId)),
  AND(eq(isCompleted, true), isNull(parentTaskId), gte(completedAt, today), lt(completedAt, tomorrow))
)
```

**Hook:** `useTasks("today_all")` — no new hook needed, the existing `useTasks` accepts any filter string.

### Optimistic updates

Completion and uncompletion use optimistic cache updates so the UI responds at click speed without waiting for the server.

Pattern in `TaskItem.handleComplete`:
1. Snapshot: `qc.getQueriesData<Task[]>({ queryKey: ["tasks"] })`
2. Optimistic: `qc.setQueriesData<Task[]>({ queryKey: ["tasks"] }, old => old?.map(t => t.id === id ? { ...t, isCompleted: true, completedAt: now } : t))`
3. Mutate: fire `completeTask.mutate(id, { onError: rollback, onSettled: invalidate })`
4. On error: restore all snapshots
5. On settled: `qc.invalidateQueries({ queryKey: ["tasks"] })` to reconcile with server truth

`handleUncomplete` mirrors this exactly with `isCompleted: false, completedAt: null`.

### Animation model

**One animation layer, one purpose:**

- `TaskItem` handles **visual state** — checkbox fill, title color, completed time opacity. All CSS class transitions (`transition-colors`, `transition-opacity`). No Framer Motion enter/exit inside `TaskItem`.
- `TaskList`'s `AnimatePresence` handles **physical presence** — task appears/disappears from the list (delete, move to another view). Fade only, no height collapse (simpler, no overflow issues).

**What is removed:**
- `completing` state in `TaskItem`
- Inner `AnimatePresence {!completing && <ContextMenu>}` wrapper in `TaskItem`
- `motion.div` wrapper per task in `TaskList`'s map (the outer AnimatePresence stays at the list boundary for delete/move exits)

**What stays:**
- Checkbox `motion.button` with `whileTap` and keyframe scale bounce — untouched
- Section collapse/expand `AnimatePresence` in Today page — untouched
- Root `motion.div` in `TaskItem` (draggable, focus indicator) — untouched

### Component changes

**`packages/web/src/app/api/tasks/route.ts`**
- Add `case "today_all":` using Drizzle `or()` to combine active-today+overdue and completed-today conditions
- No other changes to this file

**`packages/web/src/hooks/use-tasks.ts`**
- No changes needed — `useTasks("today_all")` works with existing hook signature

**`packages/web/src/components/tasks/task-item.tsx`**
- Remove `completing` state and the `useState` import if unused after removal
- Remove inner `AnimatePresence` wrapper (`{!completing && <ContextMenu>...}`)
- Replace `handleComplete` and `handleUncomplete` with optimistic-update versions using `useQueryClient`
- Keep root `motion.div` unchanged
- Keep `TaskCheckbox` props: `checked`, `onComplete`, `onUncomplete` — remove `completing` and `disabled={completing}`
- Completed time badge on right side: keep as-is (already implemented)

**`packages/web/src/components/tasks/task-checkbox.tsx`**
- Remove `completing` prop and `completing?: boolean` from interface
- `filled` becomes: `checked || animating` (no `completing` term)
- `disabled` becomes: just `disabled` prop (no `|| checked` removal needed — was already removed)

**`packages/web/src/components/tasks/task-list.tsx`**
- Keep `AnimatePresence initial={false}` + `motion.div` wrapper per task, but remove the entry animation (`initial` and `animate` props). Only `exit={{ opacity: 0 }}` remains. This means tasks fade out when deleted or moved to another view, but do not animate in (they're loaded all at once on mount). No structural change — just remove the `initial`/`animate` props from the existing `motion.div`.

**`packages/web/src/app/(views)/today/page.tsx`**
- Replace three queries with one: `const { data: allTasks = [], isLoading } = useTasks("today_all")`
- Add `todayStr` helper (already exists in scope)
- `overdueTasks`: `allTasks.filter(t => t.whenDate && t.whenDate < today && !t.isCompleted)`
- `tasksBySection(sectionId)`:
  ```typescript
  function tasksBySection(sectionId: TimeOfDay | null): Task[] {
    return allTasks
      .filter(t => t.isCompleted || (t.whenDate !== null && t.whenDate >= today)) // completed today (any whenDate) + active today
      .filter(t => (t.timeOfDay ?? null) === sectionId)
      .sort((a, b) => {
        // Active before completed
        if (a.isCompleted !== b.isCompleted) return a.isCompleted ? 1 : -1;
        // Active: sort by scheduledTime
        if (!a.isCompleted && !b.isCompleted) {
          if (!a.scheduledTime && !b.scheduledTime) return 0;
          if (!a.scheduledTime) return 1;
          if (!b.scheduledTime) return -1;
          return a.scheduledTime.localeCompare(b.scheduledTime);
        }
        // Completed: sort by completedAt DESC
        return (b.completedAt ?? "").localeCompare(a.completedAt ?? "");
      });
  }
  ```
- Progress bar: `const completed = allTasks.filter(t => t.isCompleted && !t.isCancelled).length`; `const total = allTasks.filter(t => !t.isCancelled).length`
- `hasContent` for each section: `tasksBySection(id).length > 0`
- `taskCount` for collapsed badge: `tasksBySection(id).length`
- Remove `completedBySection` function (no longer needed)
- Each section renders ONE `<TaskList>` (not two)
- Overdue section: keep as-is, uses `overdueTasks` slice of the unified array

---

## Tradeoffs

**Accepted:** Tasks completed live stay at their current list position until page reload. On reload, completed tasks sort to the bottom of each section (server sort order). This matches Things 3 behavior.

**Accepted:** The `"today_all"` query returns more data than the old split queries in some edge cases (e.g., tasks with old `completedAt` being re-queried). Negligible in practice for a personal task manager.

**Not accepted:** Any scenario where completing a task produces a visible flicker, pop, or disappear/reappear. The unified list makes this structurally impossible.

---

## What This Does Not Touch

- Inbox, Upcoming, Someday, Logbook, Project views — no changes
- `TaskQuickAdd` — no changes
- Keyboard shortcut handlers in `task-list.tsx` — no changes
- DnD (`DroppableZone`, `useDraggable`) — no changes
- Context menu items — no changes
- Expanded panel — no changes
