# Today Page Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add dynamic red→green progress bar, routines section, snooze controls on every task row, age-aware overdue triage, and a completion celebration to the Today page.

**Architecture:** Six self-contained tasks land sequentially. `Progress` gets an `indicatorStyle` escape hatch; `TodayProgress` computes the HSL color and owns the counter. `TodayRoutineRow` is a lightweight routine row (no N+1 stats queries). `TodaySnoozeControls` mirrors `InboxDispatchControls` with Tomorrow/Someday/Weekend options. `TaskList` gains a `renderRowSuffix` prop so hover controls compose without replacing the component. `today/page.tsx` wires all pieces together, adds the collapsible routines section, and shows a completion celebration.

**Tech Stack:** Next.js App Router, TanStack Query (`useUpdateTask`, `useTasks`, `useMutation`), shadcn/ui (`Progress`), Tailwind CSS group/group-hover pattern, lucide-react (`Sparkles`, `Check`).

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Modify | `packages/web/src/components/ui/progress.tsx` | Add `indicatorStyle` prop forwarded to the indicator element |
| Create | `packages/web/src/components/today/today-progress.tsx` | Dynamic-color progress bar (red→green HSL) with N/M counter |
| Create | `packages/web/src/components/today/today-routine-row.tsx` | Compact routine row: dot + title + hover "Log" button |
| Create | `packages/web/src/components/today/snooze-controls.tsx` | Hover snooze pills: Tomorrow / Someday / Weekend |
| Modify | `packages/web/src/components/tasks/task-list.tsx` | Add `renderRowSuffix?: (task: Task) => React.ReactNode` prop |
| Modify | `packages/web/src/app/(views)/today/page.tsx` | Wire routines section, snooze controls, age badges, celebration |

---

## Task 1: Add `indicatorStyle` to `Progress`

**Files:**
- Modify: `packages/web/src/components/ui/progress.tsx`

- [ ] **Step 1: Read the current file**

Open `packages/web/src/components/ui/progress.tsx`. Current content:

```tsx
"use client"

import * as React from "react"
import { Progress as ProgressPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

function Progress({
  className,
  value,
  ...props
}: React.ComponentProps<typeof ProgressPrimitive.Root>) {
  return (
    <ProgressPrimitive.Root
      data-slot="progress"
      className={cn(
        "relative flex h-3 w-full items-center overflow-x-hidden rounded-full bg-muted",
        className
      )}
      {...props}
    >
      <ProgressPrimitive.Indicator
        data-slot="progress-indicator"
        className="size-full flex-1 bg-primary transition-all"
        style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
      />
    </ProgressPrimitive.Root>
  )
}

export { Progress }
```

- [ ] **Step 2: Replace with the updated version**

Full replacement for `packages/web/src/components/ui/progress.tsx`:

```tsx
"use client"

import * as React from "react"
import { Progress as ProgressPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

function Progress({
  className,
  value,
  indicatorStyle,
  ...props
}: React.ComponentProps<typeof ProgressPrimitive.Root> & {
  indicatorStyle?: React.CSSProperties;
}) {
  return (
    <ProgressPrimitive.Root
      data-slot="progress"
      className={cn(
        "relative flex h-3 w-full items-center overflow-x-hidden rounded-full bg-muted",
        className
      )}
      {...props}
    >
      <ProgressPrimitive.Indicator
        data-slot="progress-indicator"
        className="size-full flex-1 bg-primary transition-all"
        style={{ transform: `translateX(-${100 - (value || 0)}%)`, ...indicatorStyle }}
      />
    </ProgressPrimitive.Root>
  )
}

export { Progress }
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd packages/web && pnpm tsc --noEmit 2>&1 | grep -i "progress" | head -10
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add packages/web/src/components/ui/progress.tsx
git commit -m "feat: add indicatorStyle prop to Progress component"
```

---

## Task 2: Create `TodayProgress` component

**Files:**
- Create: `packages/web/src/components/today/today-progress.tsx`

- [ ] **Step 1: Create the file**

```tsx
import { Progress } from "@/components/ui/progress";

interface TodayProgressProps {
  completed: number;
  total: number;
}

function progressColor(pct: number): string {
  // Interpolate hsl(0, 80%, 50%) at 0% → hsl(120, 60%, 45%) at 100%
  const h = Math.round(pct * 1.2);
  const s = Math.round(80 - pct * 0.2);
  const l = Math.round(50 - pct * 0.05);
  return `hsl(${h}, ${s}%, ${l}%)`;
}

export function TodayProgress({ completed, total }: TodayProgressProps) {
  if (total === 0) return null;
  const pct = (completed / total) * 100;

  return (
    <div className="flex items-center gap-3 px-4">
      <Progress
        value={pct}
        className="h-1.5 flex-1"
        indicatorStyle={{ backgroundColor: progressColor(pct), transition: "background-color 0.5s ease, transform 0.5s ease" }}
      />
      <span className="text-xs text-muted-foreground/65 shrink-0 tabular-nums">
        {completed}/{total}
      </span>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd packages/web && pnpm tsc --noEmit 2>&1 | grep -i "today-progress" | head -10
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add packages/web/src/components/today/today-progress.tsx
git commit -m "feat: add TodayProgress component with dynamic red-green color"
```

---

## Task 3: Create `TodayRoutineRow` component

**Files:**
- Create: `packages/web/src/components/today/today-routine-row.tsx`

This is a lightweight routine row for the Today page. It does NOT fetch per-item stats (no N+1 queries). It shows a colored dot + title + hover "Log" button. Clicking "Log" posts to the completions endpoint.

- [ ] **Step 1: Create the file**

```tsx
"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/fetch";
import { cn } from "@/lib/utils";
import { toLocalDateStr } from "@/lib/dates";
import { Check } from "lucide-react";
import type { Task } from "@todo/shared";

interface Props {
  task: Task;
}

export function TodayRoutineRow({ task }: Props) {
  const qc = useQueryClient();
  const today = toLocalDateStr(new Date());

  const logMutation = useMutation({
    mutationFn: () =>
      api.post(`/api/tasks/${task.id}/completions`, {
        completedAt: today + "T12:00:00",
        notes: null,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
    },
  });

  const daysToGo =
    task.whenDate !== null
      ? Math.round(
          (Date.parse(task.whenDate + "T00:00:00") - Date.parse(today + "T00:00:00")) / 86400000,
        )
      : null;

  const isOverdue = daysToGo !== null && daysToGo < 0;
  const isDueToday = daysToGo === 0;

  return (
    <div className="group relative flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-accent/40 transition-colors">
      {/* Status dot */}
      <div
        className={cn(
          "h-2.5 w-2.5 rounded-full shrink-0",
          isOverdue ? "bg-destructive/70" : isDueToday ? "bg-amber-500/80" : "bg-primary/40",
        )}
      />

      <span className="flex-1 text-sm truncate">{task.title}</span>

      {isOverdue && daysToGo !== null && (
        <span className="text-xs text-destructive/70 tabular-nums shrink-0 group-hover:opacity-0 transition-opacity">
          {Math.abs(daysToGo)}d overdue
        </span>
      )}

      {/* Log today button — visible on hover */}
      <button
        type="button"
        aria-label="Log today"
        disabled={logMutation.isPending}
        onClick={(e) => {
          e.stopPropagation();
          logMutation.mutate();
        }}
        className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity flex items-center gap-1 rounded-full border border-border bg-card px-2.5 py-0.5 text-xs text-muted-foreground hover:text-foreground hover:border-foreground/30 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Check className="h-3 w-3" />
        Log
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd packages/web && pnpm tsc --noEmit 2>&1 | grep -i "today-routine" | head -10
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add packages/web/src/components/today/today-routine-row.tsx
git commit -m "feat: add TodayRoutineRow compact component"
```

---

## Task 4: Create `TodaySnoozeControls` component

**Files:**
- Create: `packages/web/src/components/today/snooze-controls.tsx`

Mirror of `InboxDispatchControls` but with snooze-appropriate options: Tomorrow, Someday, Weekend. No overflow popover needed — three pills is sufficient.

- [ ] **Step 1: Create the file**

```tsx
"use client";

import { useUpdateTask } from "@/hooks/use-tasks";
import { tomorrowStr, nextSaturdayStr } from "@/lib/dates";

interface TodaySnoozeControlsProps {
  taskId: string;
}

export function TodaySnoozeControls({ taskId }: TodaySnoozeControlsProps) {
  const updateTask = useUpdateTask();

  function pill(label: string, onClick: () => void) {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
        disabled={updateTask.isPending}
        className="rounded-full border border-border bg-card px-2.5 py-0.5 text-xs text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {label}
      </button>
    );
  }

  return (
    <div
      className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity"
      onClick={(e) => e.stopPropagation()}
    >
      {pill("Tomorrow", () => updateTask.mutate({ id: taskId, whenDate: tomorrowStr(), isSomeday: false }))}
      {pill("Someday", () => updateTask.mutate({ id: taskId, whenDate: null, isSomeday: true }))}
      {pill("Weekend", () => updateTask.mutate({ id: taskId, whenDate: nextSaturdayStr(), isSomeday: false }))}
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd packages/web && pnpm tsc --noEmit 2>&1 | grep -i "snooze" | head -10
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add packages/web/src/components/today/snooze-controls.tsx
git commit -m "feat: add TodaySnoozeControls (Tomorrow/Someday/Weekend pills)"
```

---

## Task 5: Add `renderRowSuffix` to `TaskList`

**Files:**
- Modify: `packages/web/src/components/tasks/task-list.tsx`

Add an optional `renderRowSuffix?: (task: Task) => React.ReactNode` prop. When provided, each task row is wrapped in `<div className="group relative">` and the suffix is rendered after `<TaskItem>`. This lets callers overlay hover controls without replacing `TaskList`.

- [ ] **Step 1: Update the `TaskListProps` interface**

Find this block in `packages/web/src/components/tasks/task-list.tsx`:

```tsx
interface TaskListProps {
  tasks: Task[];
  isLoading?: boolean;
  showWhenDate?: boolean;
  quickAddDefaults?: Partial<Pick<Task, "whenDate" | "timeOfDay" | "projectId" | "areaId" | "sectionId">>;
  activeSections?: Section[];
  emptyMessage?: string;
}
```

Replace with:

```tsx
interface TaskListProps {
  tasks: Task[];
  isLoading?: boolean;
  showWhenDate?: boolean;
  quickAddDefaults?: Partial<Pick<Task, "whenDate" | "timeOfDay" | "projectId" | "areaId" | "sectionId">>;
  activeSections?: Section[];
  emptyMessage?: string;
  renderRowSuffix?: (task: Task) => React.ReactNode;
}
```

- [ ] **Step 2: Destructure the new prop in the function signature**

Find:

```tsx
export function TaskList({ tasks, isLoading, showWhenDate, quickAddDefaults, activeSections, emptyMessage }: TaskListProps) {
```

Replace with:

```tsx
export function TaskList({ tasks, isLoading, showWhenDate, quickAddDefaults, activeSections, emptyMessage, renderRowSuffix }: TaskListProps) {
```

- [ ] **Step 3: Wrap task rows conditionally**

Find this block in the render (around line 187):

```tsx
      {tasks.map((task) => (
        <TaskItem
          key={task.id}
          task={task}
          isExpanded={expandedTaskId === task.id}
          onToggle={handleToggle}
          activeProjects={activeProjects}
          activeSections={activeSections}
          showWhenDate={showWhenDate}
        />
      ))}
```

Replace with:

```tsx
      {tasks.map((task) =>
        renderRowSuffix ? (
          <div key={task.id} className="group relative">
            <TaskItem
              task={task}
              isExpanded={expandedTaskId === task.id}
              onToggle={handleToggle}
              activeProjects={activeProjects}
              activeSections={activeSections}
              showWhenDate={showWhenDate}
            />
            {renderRowSuffix(task)}
          </div>
        ) : (
          <TaskItem
            key={task.id}
            task={task}
            isExpanded={expandedTaskId === task.id}
            onToggle={handleToggle}
            activeProjects={activeProjects}
            activeSections={activeSections}
            showWhenDate={showWhenDate}
          />
        )
      )}
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd packages/web && pnpm tsc --noEmit 2>&1 | grep -i "task-list" | head -10
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/components/tasks/task-list.tsx
git commit -m "feat: add renderRowSuffix prop to TaskList for hover controls"
```

---

## Task 6: Rewrite `today/page.tsx`

**Files:**
- Modify: `packages/web/src/app/(views)/today/page.tsx`

Wire all features: `TodayProgress`, routines section (`TodayRoutineRow`), snooze controls on every task row via `renderRowSuffix`, age badge on overdue rows, completion celebration.

- [ ] **Step 1: Replace the full file**

```tsx
"use client";

import { useCallback, useState } from "react";
import { ChevronDown, ChevronRight, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { toLocalDateStr, taskAge } from "@/lib/dates";
import { useTasks } from "@/hooks/use-tasks";
import { TaskList } from "@/components/tasks/task-list";
import { DroppableZone } from "@/components/dnd/droppable-zone";
import { TodayProgress } from "@/components/today/today-progress";
import { TodayRoutineRow } from "@/components/today/today-routine-row";
import { TodaySnoozeControls } from "@/components/today/snooze-controls";
import type { Task, TimeOfDay } from "@todo/shared";

const SECTIONS: { id: TimeOfDay | null; label: string; key: string }[] = [
  { id: "morning", label: "Morning", key: "morning" },
  { id: "day", label: "Day", key: "day" },
  { id: "night", label: "Night", key: "night" },
  { id: null, label: "Anytime", key: "anytime" },
];

const STORAGE_KEY = "todo-today-sections-collapsed";

function loadCollapsed(): Record<string, boolean> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, boolean>) : {};
  } catch {
    return {};
  }
}

export default function TodayPage() {
  const today = toLocalDateStr(new Date());
  const { data: allTasks = [], isLoading } = useTasks("today_all");
  const { data: routineTasks = [] } = useTasks("routines");

  const overdueTasks = allTasks.filter(
    (t) => !t.isCompleted && t.whenDate !== null && t.whenDate < today,
  );
  const dueRoutines = routineTasks.filter(
    (t) => t.whenDate !== null && t.whenDate <= today,
  );

  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(loadCollapsed);

  function toggleSection(key: string) {
    setCollapsed((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  }

  const completedCount = allTasks.filter((t) => t.isCompleted && !t.isCancelled).length;
  const totalForProgress = allTasks.filter((t) => !t.isCancelled).length;
  const allDone = totalForProgress > 0 && completedCount === totalForProgress;

  function tasksBySection(sectionId: TimeOfDay | null): Task[] {
    return allTasks
      .filter((t) => t.isCompleted || (t.whenDate !== null && t.whenDate >= today))
      .filter((t) => (t.timeOfDay ?? null) === sectionId)
      .sort((a, b) => {
        if (a.isCompleted !== b.isCompleted) return a.isCompleted ? 1 : -1;
        if (!a.isCompleted) {
          if (!a.scheduledTime && !b.scheduledTime) return 0;
          if (!a.scheduledTime) return 1;
          if (!b.scheduledTime) return -1;
          return a.scheduledTime.localeCompare(b.scheduledTime);
        }
        return (b.completedAt ?? "").localeCompare(a.completedAt ?? "");
      });
  }

  const snoozeControls = useCallback(
    (task: Task) => <TodaySnoozeControls taskId={task.id} />,
    [],
  );

  const overdueRowSuffix = useCallback(
    (task: Task) => (
      <>
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground/35 tabular-nums opacity-100 group-hover:opacity-0 transition-opacity">
          {taskAge(task.createdAt)}
        </span>
        <TodaySnoozeControls taskId={task.id} />
      </>
    ),
    [],
  );

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      {/* Header + progress */}
      <div className="flex flex-col gap-2">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Today</h1>
          <p className="text-sm text-muted-foreground/70 mt-0.5">
            {new Date().toLocaleDateString("en-US", {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
          </p>
        </div>
        <TodayProgress completed={completedCount} total={totalForProgress} />
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-1">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-10 rounded-lg bg-muted/40 animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          {/* Routines section */}
          {dueRoutines.length > 0 && (
            <section>
              <div className="flex items-center justify-between px-4 mb-1">
                <h2 className="text-xs font-semibold text-muted-foreground/70 uppercase tracking-[0.12em]">
                  Routines
                  <span className="ml-1.5 text-muted-foreground/50 normal-case font-normal">
                    {dueRoutines.length} due
                  </span>
                </h2>
                <button
                  onClick={() => toggleSection("routines")}
                  aria-label={collapsed["routines"] ? "Expand Routines" : "Collapse Routines"}
                  className="text-muted-foreground/55 hover:text-muted-foreground/80 transition-colors"
                >
                  {collapsed["routines"] ? (
                    <span className="flex items-center gap-1 text-xs tabular-nums">
                      {dueRoutines.length}
                      <ChevronRight className="h-3 w-3" />
                    </span>
                  ) : (
                    <ChevronDown className="h-3 w-3" />
                  )}
                </button>
              </div>
              <div
                className={cn(
                  "grid transition-[grid-template-rows,opacity] duration-200 ease-in-out",
                  collapsed["routines"]
                    ? "grid-rows-[0fr] opacity-0"
                    : "grid-rows-[1fr] opacity-100",
                )}
              >
                <div className="overflow-hidden">
                  {dueRoutines.map((r) => (
                    <TodayRoutineRow key={r.id} task={r} />
                  ))}
                </div>
              </div>
            </section>
          )}

          {/* Overdue section */}
          {overdueTasks.length > 0 && (
            <section>
              <h2 className="text-xs font-semibold text-destructive/80 uppercase tracking-[0.12em] mb-1 px-4">
                Overdue
              </h2>
              <DroppableZone id="section:today:overdue">
                <TaskList
                  tasks={overdueTasks}
                  showWhenDate
                  emptyMessage=""
                  renderRowSuffix={overdueRowSuffix}
                />
              </DroppableZone>
            </section>
          )}

          {/* Time-of-day sections */}
          {SECTIONS.map(({ id, label, key }) => {
            const dropId = `section:today:${key}`;
            const sectionTasks = tasksBySection(id);
            const hasContent = sectionTasks.length > 0;
            if (!hasContent) return null;

            const isCollapsed = !!collapsed[key];
            const taskCount = sectionTasks.length;

            return (
              <section key={label}>
                <div className="flex items-center justify-between px-4 mb-1">
                  <h2 className="text-xs font-semibold text-muted-foreground/70 uppercase tracking-[0.12em]">
                    {label}
                  </h2>
                  <button
                    onClick={() => toggleSection(key)}
                    aria-label={isCollapsed ? `Expand ${label}` : `Collapse ${label}`}
                    className="text-muted-foreground/55 hover:text-muted-foreground/80 transition-colors"
                  >
                    {isCollapsed ? (
                      <span className="flex items-center gap-1 text-xs tabular-nums">
                        {taskCount}
                        <ChevronRight className="h-3 w-3" />
                      </span>
                    ) : (
                      <ChevronDown className="h-3 w-3" />
                    )}
                  </button>
                </div>
                <div
                  className={cn(
                    "grid transition-[grid-template-rows,opacity] duration-200 ease-in-out",
                    isCollapsed ? "grid-rows-[0fr] opacity-0" : "grid-rows-[1fr] opacity-100",
                  )}
                >
                  <div className="overflow-hidden">
                    <DroppableZone id={dropId}>
                      <TaskList
                        tasks={sectionTasks}
                        quickAddDefaults={{ whenDate: today, timeOfDay: id ?? undefined }}
                        emptyMessage=""
                        renderRowSuffix={snoozeControls}
                      />
                    </DroppableZone>
                  </div>
                </div>
              </section>
            );
          })}

          {/* Completion celebration */}
          {allDone && (
            <div className="flex flex-col items-center gap-2 py-12 text-center">
              <Sparkles className="h-6 w-6 text-muted-foreground/25" />
              <p className="text-sm font-medium text-muted-foreground/40">All done for today</p>
              <p className="text-xs text-muted-foreground/30">Come back tomorrow.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd packages/web && pnpm tsc --noEmit 2>&1 | grep -i "today" | head -20
```

Expected: no errors.

- [ ] **Step 3: Smoke test in browser**

Start dev server (`pnpm dev`) and visit `/today`. Verify:
- Progress bar renders with a red→green color (not the theme accent color)
- Bar color updates as tasks are completed (red at 0%, green at 100%)
- N/M counter right of bar is correct
- If any routines are due today, a "Routines · N due" section appears above Overdue
- Each routine row shows a colored dot, title, and "Log" button on hover
- Clicking "Log" on a routine dismisses it from the section (whenDate advances)
- Overdue tasks show an age badge (e.g. "3d") that fades on hover, revealing Tomorrow/Someday/Weekend pills
- Morning/Day/Night/Anytime task rows show Tomorrow/Someday/Weekend pills on hover
- Clicking "Tomorrow" removes the task from Today (it moves to Upcoming)
- When all tasks completed, "All done for today" celebration appears

- [ ] **Step 4: Commit**

```bash
git add packages/web/src/app/(views)/today/page.tsx
git commit -m "feat: today page polish — progress bar, routines section, snooze controls, celebration"
```

---

## Self-Review Notes

- `renderRowSuffix` is a stable `useCallback` reference passed to `TaskList` — React won't re-render the task list on every Today page render.
- `useTasks("routines")` is a separate cache key from `useTasks("today_all")` — two distinct queries, no deduplication concern.
- Progress bar counts only non-cancelled tasks (`!t.isCancelled`) to avoid counting tasks that were dismissed.
- Routines in the Today section are filtered client-side after the fetch; the `useTasks("routines")` API already returns all routines.
- The `allDone` celebration fires when `totalForProgress > 0 && completedCount === totalForProgress`. If today has no tasks at all, it doesn't show.
- Snooze "Someday" sets `{ whenDate: null, isSomeday: true }` — this correctly routes the task to the Someday view.
