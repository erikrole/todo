# Today View: Unified Task List Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the split active/completed task list in Today view with a single unified list per section, and add optimistic updates to completion mutations so task state changes are instant with no flicker.

**Architecture:** A new `today_all` API filter returns overdue + active today + completed today in one query — eliminating the race condition between three separate refetches. Optimistic updates in `useCompleteTask`/`useUncompleteTask` update the cache immediately on click. The `completing` state and inner `AnimatePresence` are removed from `TaskItem`; completion is now a pure CSS class transition (title mutes, completed time appears) with no task movement.

**Tech Stack:** Next.js App Router, Drizzle ORM (libsql), TanStack Query v5, Framer Motion

---

## File Map

| File | Change |
|------|--------|
| `packages/shared/src/types.ts` | Add `"today_all"` to `TaskFilter` union |
| `packages/web/src/app/api/tasks/route.ts` | Add `today_all` filter case using Drizzle `or()` |
| `packages/web/src/hooks/use-tasks.ts` | Add `onMutate` optimistic updates to `useCompleteTask` and `useUncompleteTask` |
| `packages/web/src/components/tasks/task-checkbox.tsx` | Remove `completing` prop |
| `packages/web/src/components/tasks/task-item.tsx` | Remove `completing` state + inner `AnimatePresence`; simplify `handleComplete`/`handleUncomplete` |
| `packages/web/src/components/tasks/task-list.tsx` | Remove `initial`/`animate` from per-task `motion.div` (keep `exit` only) |
| `packages/web/src/app/(views)/today/page.tsx` | Replace 3 queries with `useTasks("today_all")`; unify list per section |
| `packages/web/e2e/today-completion.spec.ts` | E2E: task stays visible after completion |

---

### Task 1: Add `today_all` to the shared TaskFilter type

**Files:**
- Modify: `packages/shared/src/types.ts`

- [ ] **Step 1: Add `"today_all"` to the `TaskFilter` union**

Open `packages/shared/src/types.ts`. Find this line (near the bottom, under `// ─── API ───`):

```typescript
export type TaskFilter = "inbox" | "today" | "upcoming" | "someday" | "completed" | "completed_today" | "overdue" | "trash" | "all";
```

Replace with:

```typescript
export type TaskFilter = "inbox" | "today" | "today_all" | "upcoming" | "someday" | "completed" | "completed_today" | "overdue" | "trash" | "all";
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/erole/GitHub/todo
pnpm build 2>&1 | head -30
```

Expected: no type errors related to `TaskFilter`.

- [ ] **Step 3: Commit**

```bash
git add packages/shared/src/types.ts
git commit -m "feat: add today_all to TaskFilter type"
```

---

### Task 2: Add `today_all` API filter

**Files:**
- Modify: `packages/web/src/app/api/tasks/route.ts`

- [ ] **Step 1: Add `or` to Drizzle imports**

Open `packages/web/src/app/api/tasks/route.ts`. Find:

```typescript
import { and, eq, gt, gte, isNotNull, isNull, lt, lte } from "drizzle-orm";
```

Replace with:

```typescript
import { and, eq, gt, gte, isNotNull, isNull, lt, lte, or } from "drizzle-orm";
```

- [ ] **Step 2: Add the `today_all` case to the switch statement**

Find the `case "overdue":` block (ends around line 68). Insert the new case **before** the `case "trash":` block:

```typescript
    case "today_all": {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().slice(0, 10);
      conditions.push(
        or(
          and(
            lte(tasks.whenDate, today),
            eq(tasks.isCompleted, false),
            eq(tasks.isCancelled, false),
            isNull(tasks.parentTaskId),
          ),
          and(
            eq(tasks.isCompleted, true),
            isNull(tasks.parentTaskId),
            gte(tasks.completedAt, today),
            lt(tasks.completedAt, tomorrowStr),
          ),
        ),
      );
      break;
    }
```

The outer `conditions` array already has `isNull(tasks.deletedAt)` from the top of the function. The final `and(...conditions)` becomes: `deletedAt IS NULL AND (active-today-or-overdue OR completed-today)`. Correct.

- [ ] **Step 3: Verify the dev server starts without errors**

```bash
cd /Users/erole/GitHub/todo
pnpm dev 2>&1 | head -20
```

Expected: `Ready` — no compile errors.

- [ ] **Step 4: Manually verify the new endpoint**

With the dev server running, in a new terminal:

```bash
curl -s -H "Authorization: Bearer $(grep NEXT_PUBLIC_AUTH_TOKEN packages/web/.env.local | cut -d= -f2)" \
  "http://localhost:3000/api/tasks?filter=today_all" | head -c 500
```

Expected: JSON `{ "data": [...] }` — an array of task objects (may be empty if no tasks are due today, which is fine).

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/app/api/tasks/route.ts
git commit -m "feat: add today_all API filter (active today + overdue + completed today)"
```

---

### Task 3: Add optimistic updates to completion hooks

**Files:**
- Modify: `packages/web/src/hooks/use-tasks.ts`

This is the most important task. Optimistic updates mean the UI responds instantly on click — no waiting for the network. The `onMutate` pattern: (1) cancel in-flight refetches, (2) snapshot current data, (3) update cache, (4) return snapshot for rollback on error.

- [ ] **Step 1: Write the failing E2E test first**

Create `packages/web/e2e/today-completion.spec.ts`:

```typescript
import { test, expect } from "@playwright/test";

test.describe("Today view — task completion", () => {
  test("completing a task keeps it visible in the list as completed", async ({ page }) => {
    const taskTitle = `Completion-test-${Date.now()}`;

    await page.goto("/today");
    await page.waitForLoadState("networkidle");

    // Open quick-add with N shortcut
    await page.keyboard.press("n");
    const input = page.getByPlaceholder(/new task/i);
    await expect(input).toBeVisible();

    // Create a task (quick-add in Today view defaults to today's date)
    await input.fill(taskTitle);
    await page.keyboard.press("Enter");

    // Task appears in the list
    const taskText = page.locator(`text=${taskTitle}`).first();
    await expect(taskText).toBeVisible();

    // Click the checkbox to complete it
    const taskRow = page.locator("[data-task-id]").filter({ hasText: taskTitle });
    const checkbox = taskRow.getByRole("button", { name: "Mark complete" });
    await checkbox.click();

    // Task must STILL be visible (unified list — no removal on completion)
    await expect(taskText).toBeVisible({ timeout: 2000 });

    // Checkbox now shows "Mark incomplete" (task is completed)
    await expect(taskRow.getByRole("button", { name: "Mark incomplete" })).toBeVisible();
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails (or is skipped due to missing behavior)**

```bash
cd /Users/erole/GitHub/todo
pnpm e2e -- --grep "completing a task keeps it visible" 2>&1 | tail -20
```

Expected: test fails or shows the task disappearing.

- [ ] **Step 3: Add optimistic updates to `useCompleteTask`**

Open `packages/web/src/hooks/use-tasks.ts`. Find the `useCompleteTask` function and replace it entirely:

```typescript
export function useCompleteTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post<Task>(`/api/tasks/${id}/complete`, {}),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ["tasks"] });
      const snapshots = qc.getQueriesData<Task[]>({ queryKey: ["tasks"] });
      const now = new Date().toISOString();
      qc.setQueriesData<Task[]>({ queryKey: ["tasks"] }, (old) =>
        old?.map((t) => (t.id === id ? { ...t, isCompleted: true, completedAt: now } : t)),
      );
      return { snapshots };
    },
    onError: (_err, _id, ctx) => {
      ctx?.snapshots.forEach(([key, data]) => qc.setQueryData(key, data));
      notify.error("Failed to complete task");
    },
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["task", id] });
    },
  });
}
```

Note: `Task` is already imported at the top via `import type { Task, TaskFilter, CreateTaskInput, UpdateTaskInput } from "@todo/shared";`. No new imports needed beyond what's already there (`useMutation`, `useQueryClient`, `useQuery`, `useQueryClient` are all from `@tanstack/react-query` which is already imported).

- [ ] **Step 4: Add optimistic updates to `useUncompleteTask`**

Find `useUncompleteTask` and replace it entirely:

```typescript
export function useUncompleteTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post<Task>(`/api/tasks/${id}/uncomplete`, {}),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ["tasks"] });
      const snapshots = qc.getQueriesData<Task[]>({ queryKey: ["tasks"] });
      qc.setQueriesData<Task[]>({ queryKey: ["tasks"] }, (old) =>
        old?.map((t) => (t.id === id ? { ...t, isCompleted: false, completedAt: null } : t)),
      );
      return { snapshots };
    },
    onError: (_err, _id, ctx) => {
      ctx?.snapshots.forEach(([key, data]) => qc.setQueryData(key, data));
      notify.error("Failed to undo completion");
    },
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["task", id] });
    },
  });
}
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
cd /Users/erole/GitHub/todo
pnpm build 2>&1 | grep -E "error|Error" | head -20
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add packages/web/src/hooks/use-tasks.ts packages/web/e2e/today-completion.spec.ts
git commit -m "feat: optimistic updates for task complete/uncomplete mutations"
```

---

### Task 4: Remove `completing` prop from TaskCheckbox

**Files:**
- Modify: `packages/web/src/components/tasks/task-checkbox.tsx`

- [ ] **Step 1: Remove `completing` from the interface and implementation**

Open `packages/web/src/components/tasks/task-checkbox.tsx`. Replace the entire file with:

```typescript
"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface TaskCheckboxProps {
  checked: boolean;
  onComplete: () => void;
  onUncomplete?: () => void;
  disabled?: boolean;
}

export function TaskCheckbox({ checked, onComplete, onUncomplete, disabled }: TaskCheckboxProps) {
  const [animating, setAnimating] = useState(false);

  function handleClick() {
    if (disabled || animating) return;
    if (checked) {
      onUncomplete?.();
      return;
    }
    setAnimating(true);
    setTimeout(() => {
      onComplete();
      // Don't reset animating — the component re-renders from the optimistic update
      // which resets local state naturally.
    }, 350);
  }

  const filled = checked || animating;

  return (
    <motion.button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      aria-label={checked ? "Mark incomplete" : "Mark complete"}
      className="group relative flex items-center justify-center h-[18px] w-[18px] shrink-0 rounded-full disabled:pointer-events-none"
      whileTap={{ scale: 0.8 }}
      animate={{ scale: animating ? [1, 0.75, 1.2, 1] : 1 }}
      transition={{ scale: { type: "spring", stiffness: 400, damping: 15, duration: 0.35 } }}
    >
      <svg viewBox="0 0 18 18" fill="none" className="h-[18px] w-[18px]">
        {/* Hollow outline — visible when unchecked */}
        <circle
          cx="9"
          cy="9"
          r="7.25"
          strokeWidth="1.5"
          className={cn(
            "fill-none transition-[stroke,opacity] duration-150",
            filled
              ? "opacity-0 stroke-primary"
              : "stroke-foreground/20 group-hover:stroke-primary/55",
          )}
        />
        {/* Filled circle — fades in when completing/completed */}
        <circle
          cx="9"
          cy="9"
          r="7.25"
          strokeWidth="0"
          className={cn(
            "fill-primary transition-opacity duration-300 ease-out",
            filled ? "opacity-100" : "opacity-0",
          )}
        />
        {/* Checkmark — appears after fill */}
        <path
          d="M5.75 9.25L7.75 11.25L12.25 6.75"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={cn(
            "stroke-primary-foreground transition-opacity duration-200",
            filled ? "opacity-100 delay-150" : "opacity-0",
          )}
        />
      </svg>
    </motion.button>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/erole/GitHub/todo
pnpm build 2>&1 | grep -E "error|Error" | head -20
```

Expected: TypeScript error because `task-item.tsx` still passes `completing` and `disabled={completing}` — this is expected and will be fixed in Task 5.

- [ ] **Step 3: Commit (with known TS error — will be fixed next task)**

```bash
git add packages/web/src/components/tasks/task-checkbox.tsx
git commit -m "refactor: remove completing prop from TaskCheckbox"
```

---

### Task 5: Refactor TaskItem — remove completing state, simplify handlers

**Files:**
- Modify: `packages/web/src/components/tasks/task-item.tsx`

This task removes the `completing` state and the inner `AnimatePresence` that was driving the exit animation. Completion is now purely visual (CSS transitions) driven by `task.isCompleted` from the optimistic cache update.

- [ ] **Step 1: Remove `completing` state and simplify `handleComplete`/`handleUncomplete`**

Open `packages/web/src/components/tasks/task-item.tsx`. Find and remove:

```typescript
  const [completing, setCompleting] = useState(false);
```

(The other `useState` calls for `title`, `notes`, `dateOpen`, `deadlineOpen`, `recurrenceOpen`, `addingSubtask`, `subtaskTitle` remain untouched.)

- [ ] **Step 2: Replace `handleComplete` and `handleUncomplete`**

Find:

```typescript
  function handleComplete() {
    setCompleting(true);
    completeTask.mutate(task.id, {
      onSuccess: () => notify.undoable("Task completed", () => uncompleteTask.mutate(task.id)),
      onError: () => setCompleting(false),
    });
  }

  function handleUncomplete() {
    setCompleting(true);
    uncompleteTask.mutate(task.id, {
      onSuccess: () => notify.undoable("Marked incomplete", () => completeTask.mutate(task.id)),
      onError: () => setCompleting(false),
    });
  }
```

Replace with:

```typescript
  function handleComplete() {
    completeTask.mutate(task.id, {
      onSuccess: () => notify.undoable("Task completed", () => uncompleteTask.mutate(task.id)),
    });
  }

  function handleUncomplete() {
    uncompleteTask.mutate(task.id, {
      onSuccess: () => notify.undoable("Marked incomplete", () => completeTask.mutate(task.id)),
    });
  }
```

- [ ] **Step 3: Remove the outer `AnimatePresence` and `{!completing && ...}` wrapper**

Find the `return` statement. Currently it is:

```typescript
  return (
    <AnimatePresence>
      {!completing && (
        <ContextMenu>
          <ContextMenuTrigger asChild>
            <motion.div
              ref={setRefs}
              layout
              initial={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0, marginTop: 0, marginBottom: 0 }}
              transition={{
                opacity: { duration: 0.18, ease: "easeOut" },
                height: { duration: 0.22, delay: 0.12, ease: [0.4, 0, 0.2, 1] },
                marginTop: { duration: 0.22, delay: 0.12 },
                marginBottom: { duration: 0.22, delay: 0.12 },
              }}
              style={{ ...dragStyle, opacity: isDragging ? 0.3 : 1 }}
```

Replace the outer `AnimatePresence` + condition + `motion.div` props with:

```typescript
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <motion.div
          ref={setRefs}
          layout
          style={{ ...dragStyle, opacity: isDragging ? 0.3 : 1 }}
```

And close the outer wrapping by removing the closing `)}` of `{!completing && (` and the closing `</AnimatePresence>`. The final structure is:

```typescript
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <motion.div
          ref={setRefs}
          layout
          style={{ ...dragStyle, opacity: isDragging ? 0.3 : 1 }}
          className={cn(
            "transition-[border-color,background-color,box-shadow,border-radius] duration-150",
            isExpanded && "rounded-xl border border-border/70 bg-card shadow-sm my-1.5",
          )}
          data-task-id={task.id}
          data-focused={isFocused ? "true" : undefined}
          {...attributes}
          {...listeners}
        >
          {/* Title row */}
          ...unchanged...

          {/* Inline expanded panel */}
          <AnimatePresence>
            {isExpanded && (
              ...unchanged...
            )}
          </AnimatePresence>
        </motion.div>
      </ContextMenuTrigger>

      <ContextMenuContent className="w-52">
        ...unchanged...
      </ContextMenuContent>
    </ContextMenu>
  );
```

The inner `<AnimatePresence>` around `{isExpanded && <motion.div>...ExpandedPanel</motion.div>}` stays exactly as-is — do not touch it.

- [ ] **Step 4: Remove `completing` and `disabled` from `TaskCheckbox` usage**

Find:

```typescript
                  <TaskCheckbox
                    checked={task.isCompleted}
                    onComplete={handleComplete}
                    onUncomplete={handleUncomplete}
                    completing={completing}
                    disabled={completing}
                  />
```

Replace with:

```typescript
                  <TaskCheckbox
                    checked={task.isCompleted}
                    onComplete={handleComplete}
                    onUncomplete={handleUncomplete}
                  />
```

- [ ] **Step 5: Verify TypeScript compiles clean**

```bash
cd /Users/erole/GitHub/todo
pnpm build 2>&1 | grep -E "error|Error" | head -20
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add packages/web/src/components/tasks/task-item.tsx
git commit -m "refactor: remove completing state and exit animation from TaskItem"
```

---

### Task 6: Simplify TaskList exit animation

**Files:**
- Modify: `packages/web/src/components/tasks/task-list.tsx`

Remove the entry animation (`initial`/`animate`) from the per-task `motion.div`. Tasks no longer need to fade in — the list is loaded all at once on mount. Only `exit` remains, so deleted/moved tasks fade out gracefully.

- [ ] **Step 1: Remove `initial` and `animate` from the per-task `motion.div`**

Open `packages/web/src/components/tasks/task-list.tsx`. Find:

```typescript
          <motion.div
            key={task.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
          >
```

Replace with:

```typescript
          <motion.div
            key={task.id}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
          >
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/erole/GitHub/todo
pnpm build 2>&1 | grep -E "error|Error" | head -20
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add packages/web/src/components/tasks/task-list.tsx
git commit -m "refactor: remove entry animation from TaskList (exit-only for deletes)"
```

---

### Task 7: Refactor Today page to use unified task list

**Files:**
- Modify: `packages/web/src/app/(views)/today/page.tsx`

This is the largest change. Replace three queries with one and simplify the rendering.

- [ ] **Step 1: Replace the three queries with one**

Open `packages/web/src/app/(views)/today/page.tsx`. Find:

```typescript
  const todayStr = new Date().toISOString().slice(0, 10);
  const { data: activeTasks = [], isLoading } = useTasks("today");
  const { data: completedTodayTasks = [] } = useTasks("completed_today");
  const { data: overdueTasks = [] } = useTasks("overdue");
```

Replace with:

```typescript
  const today = new Date().toISOString().slice(0, 10);
  const { data: allTasks = [], isLoading } = useTasks("today_all");
  const overdueTasks = allTasks.filter((t) => !t.isCompleted && t.whenDate !== null && t.whenDate < today);
```

- [ ] **Step 2: Update the progress bar calculation**

Find:

```typescript
  const totalForProgress = activeTasks.filter((t) => !t.isCancelled).length + completedTodayTasks.length;
  const progressPct = totalForProgress > 0 ? (completedTodayTasks.length / totalForProgress) * 100 : 0;
```

Replace with:

```typescript
  const completedCount = allTasks.filter((t) => t.isCompleted && !t.isCancelled).length;
  const totalForProgress = allTasks.filter((t) => !t.isCancelled).length;
  const progressPct = totalForProgress > 0 ? (completedCount / totalForProgress) * 100 : 0;
```

- [ ] **Step 3: Replace `tasksBySection` and remove `completedBySection`**

Find:

```typescript
  function tasksBySection(sectionId: TimeOfDay | null): Task[] {
    return activeTasks
      .filter((t) => (t.timeOfDay ?? null) === sectionId)
      .sort((a, b) => {
        if (!a.scheduledTime && !b.scheduledTime) return 0;
        if (!a.scheduledTime) return 1;
        if (!b.scheduledTime) return -1;
        return a.scheduledTime.localeCompare(b.scheduledTime);
      });
  }

  function completedBySection(sectionId: TimeOfDay | null): Task[] {
    return completedTodayTasks.filter((t) => (t.timeOfDay ?? null) === sectionId);
  }
```

Replace with:

```typescript
  function tasksBySection(sectionId: TimeOfDay | null): Task[] {
    return allTasks
      .filter((t) => t.isCompleted || (t.whenDate !== null && t.whenDate >= today))
      .filter((t) => (t.timeOfDay ?? null) === sectionId)
      .sort((a, b) => {
        // Active tasks before completed tasks
        if (a.isCompleted !== b.isCompleted) return a.isCompleted ? 1 : -1;
        // Active: sort by scheduledTime ascending
        if (!a.isCompleted) {
          if (!a.scheduledTime && !b.scheduledTime) return 0;
          if (!a.scheduledTime) return 1;
          if (!b.scheduledTime) return -1;
          return a.scheduledTime.localeCompare(b.scheduledTime);
        }
        // Completed: sort by completedAt descending (most recent first)
        return (b.completedAt ?? "").localeCompare(a.completedAt ?? "");
      });
  }
```

- [ ] **Step 4: Update the section rendering variables**

Inside the `SECTIONS.map(...)` block, find:

```typescript
            const active = tasksBySection(id);
            const completed = completedBySection(id);
            const hasContent = active.length > 0 || completed.length > 0;
            ...
            const taskCount = active.length + completed.length;
```

Replace with:

```typescript
            const sectionTasks = tasksBySection(id);
            const hasContent = sectionTasks.length > 0;
            ...
            const taskCount = sectionTasks.length;
```

- [ ] **Step 5: Replace the two `TaskList` components with one**

Find:

```typescript
                      <DroppableZone id={dropId}>
                        <TaskList
                          tasks={active}
                          quickAddDefaults={{ whenDate: todayStr, timeOfDay: id ?? undefined }}
                          emptyMessage=""
                        />
                        {completed.length > 0 && (
                          <TaskList tasks={completed} emptyMessage="" />
                        )}
                      </DroppableZone>
```

Replace with:

```typescript
                      <DroppableZone id={dropId}>
                        <TaskList
                          tasks={sectionTasks}
                          quickAddDefaults={{ whenDate: today, timeOfDay: id ?? undefined }}
                          emptyMessage=""
                        />
                      </DroppableZone>
```

- [ ] **Step 6: Update the progress bar JSX**

Find:

```typescript
          {completedTodayTasks.length}/{totalForProgress}
```

Replace with:

```typescript
          {completedCount}/{totalForProgress}
```

- [ ] **Step 7: Verify TypeScript compiles clean**

```bash
cd /Users/erole/GitHub/todo
pnpm build 2>&1 | grep -E "error|Error" | head -20
```

Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add packages/web/src/app/(views)/today/page.tsx
git commit -m "feat: unified Today task list — single query, no split active/completed sections"
```

---

### Task 8: Run E2E tests and verify

- [ ] **Step 1: Start the dev server (if not already running)**

```bash
cd /Users/erole/GitHub/todo
pnpm dev &
```

- [ ] **Step 2: Run the new completion test**

```bash
pnpm e2e -- --grep "completing a task keeps it visible" 2>&1 | tail -30
```

Expected: `1 passed`.

- [ ] **Step 3: Run the full E2E suite**

```bash
pnpm e2e 2>&1 | tail -20
```

Expected: all tests pass (or same failures as before this change — no regressions).

- [ ] **Step 4: Manual smoke test**

Open `http://localhost:3000/today` in a browser.

Verify:
1. Tasks for today are visible in their time-of-day sections
2. Overdue section appears if there are overdue tasks
3. Clicking a checkbox: fills immediately (no delay), task stays in place with muted title + completed time on right
4. Unchecking a completed task: reverts immediately
5. Progress bar updates on completion
6. Pressing `X` shortcut on a focused task completes it with the same smooth behavior
7. `Cmd+Z` undo toast works for both complete and uncomplete

- [ ] **Step 5: Final commit if any fixes were needed**

```bash
git add -p  # stage only intentional fixes
git commit -m "fix: address issues found during e2e testing"
```

---

## Context for Implementers

**Key types** (from `packages/shared/src/types.ts`):
- `Task.isCompleted: boolean`
- `Task.completedAt: string | null` (ISO timestamp)
- `Task.whenDate: string | null` (YYYY-MM-DD)
- `Task.timeOfDay: "morning" | "day" | "night" | null`
- `Task.isCancelled: boolean`

**Dev server:** `pnpm dev` from repo root. SQLite at `packages/db/local.db`.

**Auth:** All API calls need `Authorization: Bearer $NEXT_PUBLIC_AUTH_TOKEN` — the browser client handles this automatically via the `api` helper in `packages/web/src/lib/fetch.ts`.

**TanStack Query v5 optimistic update pattern:**
- `onMutate`: cancel in-flight queries → snapshot → optimistic update → return snapshot
- `onError`: restore snapshot from context
- `onSuccess`: invalidate to reconcile with server (overwrites optimistic data with truth)
- `cancelQueries` prevents race where in-flight refetch overwrites optimistic update
