# Inbox Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add dispatch controls (Today / Tomorrow / ··· overflow), empty state, task count header, and client-side sort to the Inbox page.

**Architecture:** Three page-level changes land directly in `inbox/page.tsx`. Dispatch controls are extracted into a focused `InboxDispatchControls` component that wraps each `TaskItem` with a `group` div and renders pill buttons on hover. All state is local; no new API routes.

**Tech Stack:** Next.js App Router, TanStack Query (`useUpdateTask`, `useProjects`), shadcn/ui (`Popover`, `DropdownMenu`, `Calendar`), Tailwind CSS, lucide-react.

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Modify | `packages/web/src/lib/dates.ts` | Add `todayStr`, `tomorrowStr`, `nextSaturdayStr` helpers |
| Create | `packages/web/src/components/inbox/dispatch-controls.tsx` | Hover dispatch pills + ··· overflow popover |
| Modify | `packages/web/src/app/(views)/inbox/page.tsx` | Wire dispatch controls; add empty state, count header, sort |

---

## Task 1: Add date helpers to `dates.ts`

**Files:**
- Modify: `packages/web/src/lib/dates.ts`

- [ ] **Step 1: Add three helpers at the end of the file**

```ts
/** YYYY-MM-DD string for today in local time. */
export function todayStr(): string {
  return toLocalDateStr(new Date());
}

/** YYYY-MM-DD string for tomorrow in local time. */
export function tomorrowStr(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return toLocalDateStr(d);
}

/** YYYY-MM-DD string for the coming Saturday in local time (or today if today is Saturday). */
export function nextSaturdayStr(): string {
  const d = new Date();
  const day = d.getDay(); // 0=Sun … 6=Sat
  const daysUntilSat = day === 6 ? 0 : 6 - day;
  d.setDate(d.getDate() + daysUntilSat);
  return toLocalDateStr(d);
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/web/src/lib/dates.ts
git commit -m "feat: add todayStr, tomorrowStr, nextSaturdayStr helpers to dates.ts"
```

---

## Task 2: Create `InboxDispatchControls` component

**Files:**
- Create: `packages/web/src/components/inbox/dispatch-controls.tsx`

This component renders the Today / Tomorrow / ··· pill buttons. It is rendered inside a `group` wrapper div — `opacity-0 group-hover:opacity-100` controls visibility. It does NOT render the TaskItem itself; that stays in the page.

- [ ] **Step 1: Create the file**

```tsx
"use client";

import { useState } from "react";
import { useUpdateTask } from "@/hooks/use-tasks";
import { useProjects } from "@/hooks/use-projects";
import { todayStr, tomorrowStr, nextSaturdayStr } from "@/lib/dates";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";

interface InboxDispatchControlsProps {
  taskId: string;
}

export function InboxDispatchControls({ taskId }: InboxDispatchControlsProps) {
  const updateTask = useUpdateTask();
  const { data: projects = [] } = useProjects();
  const activeProjects = projects.filter((p) => !p.isCompleted);

  const [overflowOpen, setOverflowOpen] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);

  function dispatch(patch: Parameters<typeof updateTask.mutate>[0]) {
    updateTask.mutate(patch);
  }

  function pill(label: string, onClick: () => void) {
    return (
      <button
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
        className="rounded-full border border-border bg-card px-2.5 py-0.5 text-xs text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
      >
        {label}
      </button>
    );
  }

  return (
    <div
      className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
      onClick={(e) => e.stopPropagation()}
    >
      {pill("Today", () => dispatch({ id: taskId, whenDate: todayStr(), isSomeday: false }))}
      {pill("Tomorrow", () => dispatch({ id: taskId, whenDate: tomorrowStr(), isSomeday: false }))}

      {/* ··· overflow popover */}
      <Popover open={overflowOpen} onOpenChange={setOverflowOpen}>
        <PopoverTrigger asChild>
          <button
            className="rounded-full border border-border bg-card px-2.5 py-0.5 text-xs text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
            onClick={(e) => e.stopPropagation()}
          >
            ···
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-52 p-2" align="end" onClick={(e) => e.stopPropagation()}>
          {/* Schedule section */}
          <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">
            Schedule
          </p>
          <button
            className="w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted transition-colors"
            onClick={() => {
              dispatch({ id: taskId, whenDate: nextSaturdayStr(), isSomeday: false });
              setOverflowOpen(false);
            }}
          >
            This weekend
          </button>

          {/* Pick a date — opens nested Calendar */}
          <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
            <PopoverTrigger asChild>
              <button className="w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted transition-colors">
                Pick a date…
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="single"
                disabled={(d) => {
                  const today = new Date();
                  today.setHours(0, 0, 0, 0);
                  return d < today;
                }}
                onSelect={(date) => {
                  if (!date) return;
                  const y = date.getFullYear();
                  const m = String(date.getMonth() + 1).padStart(2, "0");
                  const day = String(date.getDate()).padStart(2, "0");
                  dispatch({ id: taskId, whenDate: `${y}-${m}-${day}`, isSomeday: false });
                  setCalendarOpen(false);
                  setOverflowOpen(false);
                }}
              />
            </PopoverContent>
          </Popover>

          {/* Move to project section */}
          {activeProjects.length > 0 && (
            <>
              <div className="my-1.5 border-t border-border" />
              <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">
                Move to
              </p>
              <div className="max-h-48 overflow-y-auto">
                {activeProjects.map((p) => (
                  <button
                    key={p.id}
                    className="w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted transition-colors truncate"
                    onClick={() => {
                      dispatch({ id: taskId, projectId: p.id });
                      setOverflowOpen(false);
                    }}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            </>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd packages/web && pnpm tsc --noEmit 2>&1 | grep -i "dispatch-controls\|dates" | head -20
```

Expected: no errors for those files.

- [ ] **Step 3: Commit**

```bash
git add packages/web/src/components/inbox/dispatch-controls.tsx
git commit -m "feat: add InboxDispatchControls component with Today/Tomorrow/overflow dispatch"
```

---

## Task 3: Wire dispatch controls into the inbox page

**Files:**
- Modify: `packages/web/src/app/(views)/inbox/page.tsx`

The page currently passes `tasks` to `<TaskList>`. We need to render each task individually inside a `group relative` wrapper to float the dispatch controls over it.

- [ ] **Step 1: Replace the page contents**

Full replacement for `packages/web/src/app/(views)/inbox/page.tsx`:

```tsx
"use client";

import { useTasks } from "@/hooks/use-tasks";
import { useProjects } from "@/hooks/use-projects";
import { TaskItem } from "@/components/tasks/task-item";
import { InboxDispatchControls } from "@/components/inbox/dispatch-controls";
import { DroppableZone } from "@/components/dnd/droppable-zone";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TaskQuickAdd } from "@/components/tasks/task-quick-add";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCallback, useRef, useState } from "react";
import type { Task, ProjectWithCounts } from "@todo/shared";
import type { TaskQuickAddHandle } from "@/components/tasks/task-quick-add";

type SortKey = "added" | "title" | "deadline";

function sortTasks(tasks: Task[], key: SortKey): Task[] {
  if (key === "added") return tasks;
  if (key === "title") return tasks.slice().sort((a, b) => a.title.localeCompare(b.title));
  // deadline: tasks with deadline sorted ascending, no-deadline at end
  return tasks.slice().sort((a, b) => {
    if (a.deadline && b.deadline) return a.deadline.localeCompare(b.deadline);
    if (a.deadline) return -1;
    if (b.deadline) return 1;
    return 0;
  });
}

const SORT_LABELS: Record<SortKey, string> = {
  added: "Date added",
  title: "Title A → Z",
  deadline: "Deadline",
};

export default function InboxPage() {
  const { data: tasks = [], isLoading } = useTasks("inbox");
  const { data: allProjects = [] } = useProjects();
  const activeProjects = allProjects.filter((p) => !p.isCompleted) as ProjectWithCounts[];

  const [sortKey, setSortKey] = useState<SortKey>("added");
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const quickAddRef = useRef<TaskQuickAddHandle>(null);
  const handleToggle = useCallback(
    (id: string) => setExpandedTaskId((prev) => (prev === id ? null : id)),
    [],
  );

  const sorted = sortTasks(tasks, sortKey);

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Inbox</h1>
          {tasks.length > 0 && (
            <p className="text-sm text-muted-foreground/70 mt-0.5">
              {tasks.length} {tasks.length === 1 ? "item" : "items"} to process
            </p>
          )}
        </div>
        {tasks.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="rounded-md border border-border px-2.5 py-1 text-xs text-muted-foreground/60 hover:text-muted-foreground hover:border-border/80 transition-colors">
                Sort: {SORT_LABELS[sortKey]} ▾
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {(["added", "title", "deadline"] as SortKey[]).map((key) => (
                <DropdownMenuItem
                  key={key}
                  onClick={() => setSortKey(key)}
                  className={cn(sortKey === key && "font-medium")}
                >
                  {SORT_LABELS[key]}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Task list or empty state */}
      {isLoading ? (
        <div className="flex flex-col gap-1">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-10 rounded-lg bg-muted/40 animate-pulse" />
          ))}
        </div>
      ) : tasks.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-16 text-center">
          <Check className="h-8 w-8 text-muted-foreground/30" />
          <p className="text-sm font-medium text-muted-foreground/40">Inbox zero</p>
          <p className="text-xs text-muted-foreground/30">Everything's been dispatched.</p>
        </div>
      ) : (
        <DroppableZone id="section:inbox">
          <div className="flex flex-col">
            {sorted.map((task) => (
              <div key={task.id} className="group relative">
                <TaskItem
                  task={task}
                  isExpanded={expandedTaskId === task.id}
                  onToggle={handleToggle}
                  activeProjects={activeProjects}
                />
                <InboxDispatchControls taskId={task.id} />
              </div>
            ))}
            <TaskQuickAdd ref={quickAddRef} />
          </div>
        </DroppableZone>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd packages/web && pnpm tsc --noEmit 2>&1 | grep -i "inbox" | head -20
```

Expected: no errors.

- [ ] **Step 3: Smoke test in browser**

Start dev server (`pnpm dev`) and visit `/inbox`. Verify:
- Tasks render as before
- Hovering a task row reveals Today / Tomorrow / ··· pills on the right
- Clicking **Today** dispatches the task (it disappears from inbox)
- Clicking **Tomorrow** dispatches the task
- Clicking **···** opens the overflow popover with "This weekend", "Pick a date…", and project list
- Empty inbox shows the checkmark + "Inbox zero" state
- Sort dropdown changes task order

- [ ] **Step 4: Commit**

```bash
git add packages/web/src/app/(views)/inbox/page.tsx
git commit -m "feat: inbox polish — dispatch controls, empty state, count header, sort"
```

---

## Self-Review Notes

- `isSomeday: false` included on all `whenDate` dispatches so a task in Someday state can be properly routed to Today/Tomorrow/Upcoming from Inbox.
- `useProjects()` called in both `InboxDispatchControls` and `InboxPage` — this is a single TanStack Query cache hit (deduped), not two network requests.
- `TaskList` component replaced with inline `TaskItem` rendering to allow the `group relative` wrapper needed for absolute-positioned dispatch controls. `TaskQuickAdd` is added explicitly below the task list to preserve quick-add functionality (previously included implicitly inside `TaskList`).
- Sort is applied to the raw `tasks` array, so it correctly reflects the live count (not a stale sorted copy).
