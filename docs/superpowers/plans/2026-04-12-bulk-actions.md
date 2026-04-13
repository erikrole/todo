# Bulk Actions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users modifier+click tasks to multi-select, then act on all selected tasks at once via a floating action bar (complete, reschedule, move to project, cancel, someday, delete).

**Architecture:** A `SelectionProvider` React context (mounted in `AppShell`) holds `selectedIds: Set<string>`. `TaskItem` detects modifier+click and calls `toggle(id)`. `BulkActionBar` (also in `AppShell`) renders a fixed bottom bar when any tasks are selected and fires parallel mutations for each action. The selection modifier key (default: Meta on Mac, Ctrl elsewhere) is configurable from the keyboard shortcuts settings page.

**Tech Stack:** React context, framer-motion (bar entrance animation), TanStack Query mutations (existing hooks), shadcn Popover + Calendar (existing), Playwright E2E.

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/hooks/use-selection.ts` | Create | SelectionContext, SelectionProvider, useSelection hook |
| `src/lib/keyboard/shortcut-config.ts` | Modify | Add selection modifier storage helpers |
| `src/app/(views)/settings/shortcuts/page.tsx` | Modify | Add modifier picker section |
| `src/components/layout/app-shell.tsx` | Modify | Mount SelectionProvider + BulkActionBar |
| `src/components/tasks/task-item.tsx` | Modify | Modifier click detection, selection visual state |
| `src/components/tasks/task-list.tsx` | Modify | Modifier+A select-all keydown handler |
| `src/components/tasks/bulk-action-bar.tsx` | Create | Floating bar with 6 actions + clear button |
| `src/components/tasks/reschedule-popover.tsx` | Create | Today/Tomorrow/Next Week/Custom calendar picker |
| `src/components/tasks/move-to-project-popover.tsx` | Create | Scrollable project picker |
| `packages/web/e2e/bulk-actions.spec.ts` | Create | E2E tests |

---

### Task 1: `useSelection` hook

**Files:**
- Create: `packages/web/src/hooks/use-selection.ts`

- [ ] **Step 1: Write the file**

```typescript
// packages/web/src/hooks/use-selection.ts
"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { usePathname } from "next/navigation";

interface SelectionContextValue {
  selectedIds: Set<string>;
  isActive: boolean;
  toggle: (id: string) => void;
  selectAll: (ids: string[]) => void;
  clear: () => void;
}

const SelectionContext = createContext<SelectionContextValue | null>(null);

export function SelectionProvider({ children }: { children: React.ReactNode }) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const pathname = usePathname();

  // Clear selection on route change
  useEffect(() => {
    setSelectedIds(new Set());
  }, [pathname]);

  // Clear selection on Escape (capture phase — fires before keyboard provider's task-close)
  const isActive = selectedIds.size > 0;
  useEffect(() => {
    if (!isActive) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        setSelectedIds(new Set());
      }
    }
    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [isActive]);

  const toggle = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const selectAll = useCallback((ids: string[]) => {
    setSelectedIds(new Set(ids));
  }, []);

  const clear = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  return (
    <SelectionContext.Provider value={{ selectedIds, isActive, toggle, selectAll, clear }}>
      {children}
    </SelectionContext.Provider>
  );
}

export function useSelection(): SelectionContextValue {
  const ctx = useContext(SelectionContext);
  if (!ctx) throw new Error("useSelection must be used within SelectionProvider");
  return ctx;
}
```

- [ ] **Step 2: Verify it compiles**

```bash
cd /Users/erole/GitHub/todo && pnpm --filter @todo/web build 2>&1 | grep -E "error|Error" | head -20
```

Expected: no TypeScript errors related to `use-selection.ts`.

- [ ] **Step 3: Commit**

```bash
git add packages/web/src/hooks/use-selection.ts
git commit -m "feat: add useSelection hook and SelectionProvider"
```

---

### Task 2: Selection modifier config

**Files:**
- Modify: `packages/web/src/lib/keyboard/shortcut-config.ts` (end of file)
- Modify: `packages/web/src/app/(views)/settings/shortcuts/page.tsx`

- [ ] **Step 1: Add helpers to `shortcut-config.ts`**

Append to the end of `packages/web/src/lib/keyboard/shortcut-config.ts`:

```typescript
// --- Selection modifier ---

export const SELECTION_MODIFIER_STORAGE_KEY = "todo-select-modifier";
export type SelectionModifier = "meta" | "ctrl" | "alt";

export function defaultSelectionModifier(): SelectionModifier {
  if (typeof navigator === "undefined") return "meta";
  return navigator.platform.toLowerCase().includes("mac") ? "meta" : "ctrl";
}

export function loadSelectionModifier(): SelectionModifier {
  if (typeof window === "undefined") return defaultSelectionModifier();
  try {
    const raw = localStorage.getItem(SELECTION_MODIFIER_STORAGE_KEY);
    if (raw === "meta" || raw === "ctrl" || raw === "alt") return raw;
  } catch {
    // ignore
  }
  return defaultSelectionModifier();
}

export function saveSelectionModifier(mod: SelectionModifier): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(SELECTION_MODIFIER_STORAGE_KEY, mod);
}
```

- [ ] **Step 2: Add modifier picker to settings page**

In `packages/web/src/app/(views)/settings/shortcuts/page.tsx`:

Add to the imports at the top:
```typescript
import {
  SHORTCUT_DEFS,
  ShortcutCategory,
  ShortcutDef,
  formatKeyParts,
  SelectionModifier,
  loadSelectionModifier,
  saveSelectionModifier,
} from "@/lib/keyboard/shortcut-config";
```

Add state inside `ShortcutsSettingsPage`:
```typescript
const [selectionModifier, setSelectionModifier] = useState<SelectionModifier>(loadSelectionModifier);

function handleModifierChange(mod: SelectionModifier) {
  setSelectionModifier(mod);
  saveSelectionModifier(mod);
}
```

Add a new section at the bottom of the returned JSX, after the closing `</div>` of the shortcuts table div:
```tsx
<div className="mt-8">
  <h2 className="text-base font-semibold tracking-tight">Selection Modifier</h2>
  <p className="text-sm text-muted-foreground mt-1 mb-3">
    Hold this key while clicking a task to enter multi-select mode.
  </p>
  <div className="flex gap-2">
    {(["meta", "ctrl", "alt"] as const).map((mod) => {
      const labels: Record<SelectionModifier, string> = {
        meta: "⌘ Meta",
        ctrl: "⌃ Ctrl",
        alt: "⌥ Alt",
      };
      return (
        <button
          key={mod}
          onClick={() => handleModifierChange(mod)}
          className={cn(
            "px-3 py-1.5 rounded-md border text-sm font-mono transition-colors",
            selectionModifier === mod
              ? "border-primary bg-primary/10 text-primary"
              : "border-border text-muted-foreground hover:border-foreground/40",
          )}
        >
          {labels[mod]}
        </button>
      );
    })}
  </div>
</div>
```

- [ ] **Step 3: Build check**

```bash
cd /Users/erole/GitHub/todo && pnpm --filter @todo/web build 2>&1 | grep -E "error|Error" | head -20
```

Expected: no TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add packages/web/src/lib/keyboard/shortcut-config.ts packages/web/src/app/\(views\)/settings/shortcuts/page.tsx
git commit -m "feat: selection modifier config — loadSelectionModifier, saveSelectionModifier, settings picker"
```

---

### Task 3: Mount SelectionProvider and BulkActionBar in AppShell

**Files:**
- Modify: `packages/web/src/components/layout/app-shell.tsx`

- [ ] **Step 1: Update `app-shell.tsx`**

Replace the entire file content of `packages/web/src/components/layout/app-shell.tsx`:

```typescript
"use client";

import { useRouter } from "next/navigation";
import { SidebarProvider, SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import { AppSidebar } from "./sidebar";
import { TaskDndProvider } from "@/components/dnd/task-dnd-provider";
import { useShortcutAction } from "@/components/keyboard/keyboard-provider";
import { ShortcutsOverlay } from "@/components/keyboard/shortcuts-overlay";
import { SelectionProvider } from "@/hooks/use-selection";
import { BulkActionBar } from "@/components/tasks/bulk-action-bar";

/** Registers navigation shortcuts that need router + sidebar access. */
function KeyboardNavigationHandlers() {
  const router = useRouter();
  const { toggleSidebar } = useSidebar();

  useShortcutAction("navigate-today",    () => router.push("/today"));
  useShortcutAction("navigate-inbox",    () => router.push("/inbox"));
  useShortcutAction("navigate-upcoming", () => router.push("/upcoming"));
  useShortcutAction("navigate-someday",  () => router.push("/someday"));
  useShortcutAction("navigate-logbook",  () => router.push("/logbook"));
  useShortcutAction("toggle-sidebar",    toggleSidebar);

  return null;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <TaskDndProvider>
      <SidebarProvider>
        <SelectionProvider>
          <KeyboardNavigationHandlers />
          <ShortcutsOverlay />
          <BulkActionBar />
          <AppSidebar />
          <main className="flex flex-1 flex-col min-h-screen">
            <header className="flex h-12 items-center gap-2 border-b px-4 md:hidden">
              <SidebarTrigger />
            </header>
            <div className="flex flex-1 flex-col p-6">{children}</div>
          </main>
        </SelectionProvider>
      </SidebarProvider>
    </TaskDndProvider>
  );
}
```

Note: `BulkActionBar` doesn't exist yet — it will be created in Task 7. This will cause a build error until then. Stub it first:

- [ ] **Step 2: Create a temporary stub for BulkActionBar**

Create `packages/web/src/components/tasks/bulk-action-bar.tsx` with just:

```typescript
// packages/web/src/components/tasks/bulk-action-bar.tsx
"use client";

export function BulkActionBar() {
  return null;
}
```

- [ ] **Step 3: Build check**

```bash
cd /Users/erole/GitHub/todo && pnpm --filter @todo/web build 2>&1 | grep -E "error|Error" | head -20
```

Expected: no TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add packages/web/src/components/layout/app-shell.tsx packages/web/src/components/tasks/bulk-action-bar.tsx
git commit -m "feat: mount SelectionProvider and BulkActionBar stub in AppShell"
```

---

### Task 4: TaskItem — modifier click + selection visual state

**Files:**
- Modify: `packages/web/src/components/tasks/task-item.tsx`
- Modify: `packages/web/src/components/tasks/task-list.tsx`

- [ ] **Step 1: Add imports to `task-item.tsx`**

At the top of `packages/web/src/components/tasks/task-item.tsx`, add to the existing imports:

```typescript
import { useSelection } from "@/hooks/use-selection";
import { loadSelectionModifier } from "@/lib/keyboard/shortcut-config";
```

- [ ] **Step 2: Add selection state inside `TaskItem`**

Inside `TaskItem`, after the existing `const isFocused = focusedTaskId === task.id;` line, add:

```typescript
const selection = useSelection();
const isSelected = selection.selectedIds.has(task.id);
```

- [ ] **Step 3: Add `data-selected` attribute to the outer motion.div**

The outer `motion.div` currently has:
```tsx
data-task-id={task.id}
data-focused={isFocused ? "true" : undefined}
```

Change it to:
```tsx
data-task-id={task.id}
data-focused={isFocused ? "true" : undefined}
data-selected={isSelected ? "true" : undefined}
```

- [ ] **Step 4: Update the title row's onClick to handle modifier click**

Find the title row `div` with `onClick={() => !isDragging && onToggle(task.id)}` and replace that `onClick` with:

```tsx
onClick={(e) => {
  if (isDragging) return;
  const modifier = loadSelectionModifier();
  const modPressed =
    modifier === "meta" ? e.metaKey : modifier === "ctrl" ? e.ctrlKey : e.altKey;
  if (modPressed) {
    e.stopPropagation();
    selection.toggle(task.id);
    return;
  }
  onToggle(task.id);
}}
```

- [ ] **Step 5: Update the title row className to show selection highlight**

The title row div currently has this className (in the `!isExpanded` branch):
```tsx
"pl-4 pr-3 border-l-2",
isFocused
  ? "border-primary/70 bg-primary/[0.04]"
  : "border-transparent hover:border-primary/40 hover:bg-primary/[0.05]",
```

Change it to:
```tsx
"pl-4 pr-3 border-l-2",
isSelected
  ? "border-primary/70 bg-primary/[0.07]"
  : isFocused
    ? "border-primary/70 bg-primary/[0.04]"
    : "border-transparent hover:border-primary/40 hover:bg-primary/[0.05]",
```

- [ ] **Step 6: Swap checkbox for square select box when selection mode is active**

Find the checkbox wrapper div:
```tsx
<div className="mt-[3px] shrink-0" onClick={(e) => e.stopPropagation()}>
  <TaskCheckbox
    checked={task.isCompleted}
    onComplete={handleComplete}
    onUncomplete={handleUncomplete}
  />
</div>
```

Replace with:
```tsx
<div
  className="mt-[3px] shrink-0"
  onClick={(e) => {
    e.stopPropagation();
    if (selection.isActive) {
      selection.toggle(task.id);
    }
  }}
>
  {selection.isActive ? (
    <button
      type="button"
      aria-label={isSelected ? "Deselect task" : "Select task"}
      className={cn(
        "h-[18px] w-[18px] rounded-sm border-[1.5px] flex items-center justify-center transition-colors",
        isSelected
          ? "bg-primary border-primary"
          : "border-foreground/20 hover:border-primary/55",
      )}
    >
      {isSelected && (
        <svg viewBox="0 0 10 8" fill="none" className="h-2.5 w-2.5">
          <path
            d="M1 4L3.5 6.5L9 1"
            stroke="white"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </button>
  ) : (
    <TaskCheckbox
      checked={task.isCompleted}
      onComplete={handleComplete}
      onUncomplete={handleUncomplete}
    />
  )}
</div>
```

- [ ] **Step 7: Add modifier+A select-all to `task-list.tsx`**

In `packages/web/src/components/tasks/task-list.tsx`, add imports:
```typescript
import { useSelection } from "@/hooks/use-selection";
import { loadSelectionModifier } from "@/lib/keyboard/shortcut-config";
```

Inside `TaskList`, after the existing hooks, add:
```typescript
const selection = useSelection();

// Modifier+A — select all visible tasks
useEffect(() => {
  function onKeyDown(e: KeyboardEvent) {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    const modifier = loadSelectionModifier();
    const modPressed =
      modifier === "meta" ? e.metaKey : modifier === "ctrl" ? e.ctrlKey : e.altKey;
    if (modPressed && e.key.toLowerCase() === "a") {
      e.preventDefault();
      selection.selectAll(taskIds);
    }
  }
  document.addEventListener("keydown", onKeyDown);
  return () => document.removeEventListener("keydown", onKeyDown);
}, [taskIds, selection.selectAll]);
```

(Add this after the existing `useRegisterTaskList(taskIds)` call.)

- [ ] **Step 8: Build check**

```bash
cd /Users/erole/GitHub/todo && pnpm --filter @todo/web build 2>&1 | grep -E "error|Error" | head -20
```

Expected: no TypeScript errors.

- [ ] **Step 9: Commit**

```bash
git add packages/web/src/components/tasks/task-item.tsx packages/web/src/components/tasks/task-list.tsx
git commit -m "feat: TaskItem modifier-click selection, select-all in TaskList"
```

---

### Task 5: `ReschedulePopover` component

**Files:**
- Create: `packages/web/src/components/tasks/reschedule-popover.tsx`

- [ ] **Step 1: Write the file**

```typescript
// packages/web/src/components/tasks/reschedule-popover.tsx
"use client";

import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";

interface ReschedulePopoverProps {
  onReschedule: (whenDate: string) => void;
}

function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function ReschedulePopover({ onReschedule }: ReschedulePopoverProps) {
  const [open, setOpen] = useState(false);

  function pick(date: Date) {
    onReschedule(toDateStr(date));
    setOpen(false);
  }

  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const nextWeek = new Date(today);
  nextWeek.setDate(today.getDate() + 7);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="px-2.5 py-1 rounded-md border border-border text-xs text-foreground/70 hover:bg-muted transition-colors">
          Reschedule
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-2" align="center" side="top">
        <div className="flex flex-col gap-0.5 mb-2">
          {[
            { label: "Today", date: today },
            { label: "Tomorrow", date: tomorrow },
            { label: "Next Week", date: nextWeek },
          ].map(({ label, date }) => (
            <button
              key={label}
              onClick={() => pick(date)}
              className="text-left px-2 py-1.5 rounded text-sm hover:bg-muted transition-colors"
            >
              {label}
            </button>
          ))}
        </div>
        <div className="border-t border-border/50 pt-2">
          <Calendar
            mode="single"
            onSelect={(date) => { if (date) pick(date); }}
            fromDate={today}
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}
```

- [ ] **Step 2: Build check**

```bash
cd /Users/erole/GitHub/todo && pnpm --filter @todo/web build 2>&1 | grep -E "error|Error" | head -20
```

Expected: no TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add packages/web/src/components/tasks/reschedule-popover.tsx
git commit -m "feat: ReschedulePopover — Today/Tomorrow/Next Week/Custom date picker"
```

---

### Task 6: `MoveToProjectPopover` component

**Files:**
- Create: `packages/web/src/components/tasks/move-to-project-popover.tsx`

- [ ] **Step 1: Write the file**

```typescript
// packages/web/src/components/tasks/move-to-project-popover.tsx
"use client";

import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { ProjectWithCounts } from "@todo/shared";

interface MoveToProjectPopoverProps {
  projects: ProjectWithCounts[];
  onMove: (projectId: string) => void;
}

export function MoveToProjectPopover({ projects, onMove }: MoveToProjectPopoverProps) {
  const [open, setOpen] = useState(false);

  if (projects.length === 0) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="px-2.5 py-1 rounded-md border border-border text-xs text-foreground/70 hover:bg-muted transition-colors">
          Move to…
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-48 p-1" align="center" side="top">
        <div className="flex flex-col gap-0.5 max-h-60 overflow-y-auto">
          {projects.map((p) => (
            <button
              key={p.id}
              onClick={() => { onMove(p.id); setOpen(false); }}
              className="flex items-center gap-2 w-full text-left px-2 py-1.5 rounded text-sm hover:bg-muted transition-colors"
            >
              {p.color && (
                <span
                  className="h-2 w-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: p.color }}
                />
              )}
              {p.name}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
```

- [ ] **Step 2: Build check**

```bash
cd /Users/erole/GitHub/todo && pnpm --filter @todo/web build 2>&1 | grep -E "error|Error" | head -20
```

Expected: no TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add packages/web/src/components/tasks/move-to-project-popover.tsx
git commit -m "feat: MoveToProjectPopover — scrollable project list"
```

---

### Task 7: `BulkActionBar` — full implementation

**Files:**
- Modify: `packages/web/src/components/tasks/bulk-action-bar.tsx` (replace stub)

- [ ] **Step 1: Replace the stub with the full implementation**

```typescript
// packages/web/src/components/tasks/bulk-action-bar.tsx
"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useSelection } from "@/hooks/use-selection";
import {
  useCompleteTask,
  useDeleteTask,
  useRestoreTask,
  useUncompleteTask,
  useUpdateTask,
} from "@/hooks/use-tasks";
import { useProjects } from "@/hooks/use-projects";
import { notify } from "@/lib/toast";
import type { ProjectWithCounts } from "@todo/shared";
import { ReschedulePopover } from "./reschedule-popover";
import { MoveToProjectPopover } from "./move-to-project-popover";

export function BulkActionBar() {
  const { selectedIds, isActive, clear } = useSelection();
  const completeTask = useCompleteTask();
  const uncompleteTask = useUncompleteTask();
  const deleteTask = useDeleteTask();
  const restoreTask = useRestoreTask();
  const updateTask = useUpdateTask();
  const { data: allProjects = [] } = useProjects();
  const activeProjects = (allProjects as ProjectWithCounts[]).filter((p) => !p.isCompleted);

  const count = selectedIds.size;
  const label = `${count} task${count === 1 ? "" : "s"}`;

  function handleComplete() {
    const ids = Array.from(selectedIds);
    ids.forEach((id) => completeTask.mutate(id));
    notify.undoable(`${label} completed`, () => ids.forEach((id) => uncompleteTask.mutate(id)));
    clear();
  }

  function handleCancel() {
    const ids = Array.from(selectedIds);
    ids.forEach((id) => updateTask.mutate({ id, isCancelled: true }));
    notify.undoable(`${label} cancelled`, () =>
      ids.forEach((id) => updateTask.mutate({ id, isCancelled: false })),
    );
    clear();
  }

  function handleSomeday() {
    const ids = Array.from(selectedIds);
    ids.forEach((id) => updateTask.mutate({ id, isSomeday: true, whenDate: null, timeOfDay: null }));
    clear();
  }

  function handleDelete() {
    const ids = Array.from(selectedIds);
    ids.forEach((id) => deleteTask.mutate(id));
    notify.undoable(`${label} deleted`, () => ids.forEach((id) => restoreTask.mutate(id)));
    clear();
  }

  function handleReschedule(whenDate: string) {
    const ids = Array.from(selectedIds);
    ids.forEach((id) => updateTask.mutate({ id, whenDate, isSomeday: false }));
    clear();
  }

  function handleMoveToProject(projectId: string) {
    const ids = Array.from(selectedIds);
    ids.forEach((id) => updateTask.mutate({ id, projectId }));
    clear();
  }

  return (
    <AnimatePresence>
      {isActive && (
        <motion.div
          data-testid="bulk-action-bar"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 16 }}
          transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border bg-popover shadow-lg"
        >
          <span className="text-xs font-medium text-muted-foreground pr-1 select-none">
            {label}
          </span>

          <button
            onClick={handleComplete}
            className="px-2.5 py-1 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors"
          >
            Complete
          </button>

          <ReschedulePopover onReschedule={handleReschedule} />

          <MoveToProjectPopover projects={activeProjects} onMove={handleMoveToProject} />

          <button
            onClick={handleCancel}
            className="px-2.5 py-1 rounded-md border border-border text-xs text-foreground/70 hover:bg-muted transition-colors"
          >
            Cancel
          </button>

          <button
            onClick={handleSomeday}
            className="px-2.5 py-1 rounded-md border border-border text-xs text-foreground/70 hover:bg-muted transition-colors"
          >
            Someday
          </button>

          <button
            onClick={handleDelete}
            className="px-2.5 py-1 rounded-md border border-border text-xs text-destructive hover:bg-destructive/10 transition-colors"
          >
            Delete
          </button>

          <button
            onClick={clear}
            aria-label="Clear selection"
            className="ml-1 h-5 w-5 flex items-center justify-center rounded text-muted-foreground/50 hover:text-muted-foreground hover:bg-muted transition-colors text-xs"
          >
            ✕
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
```

- [ ] **Step 2: Build check**

```bash
cd /Users/erole/GitHub/todo && pnpm --filter @todo/web build 2>&1 | grep -E "error|Error" | head -20
```

Expected: no TypeScript errors, clean build.

- [ ] **Step 3: Smoke test manually**

Start the dev server (`pnpm dev`), open `/inbox`, hold ⌘ and click a task. Verify:
- Task gets a blue left border + slightly highlighted background
- Square checkbox appears in place of the circle
- Floating bar appears at the bottom with "1 task · Complete · Reschedule · Move to… · Cancel · Someday · Delete · ✕"
- Clicking ✕ dismisses the bar
- Pressing Escape also dismisses the bar
- Clicking "Complete" removes the task and shows toast "1 task completed"

- [ ] **Step 4: Commit**

```bash
git add packages/web/src/components/tasks/bulk-action-bar.tsx
git commit -m "feat: BulkActionBar — complete, reschedule, move, cancel, someday, delete"
```

---

### Task 8: E2E tests

**Files:**
- Create: `packages/web/e2e/bulk-actions.spec.ts`

- [ ] **Step 1: Write the test file**

```typescript
// packages/web/e2e/bulk-actions.spec.ts
import { test, expect } from "@playwright/test";

test.describe("Bulk actions", () => {
  test("⌘-click selects a task and shows the action bar", async ({ page }) => {
    await page.goto("/inbox");
    await page.waitForLoadState("networkidle");

    const task = page.locator("[data-task-id]").first();
    await task.click({ modifiers: ["Meta"] });

    await expect(task).toHaveAttribute("data-selected", "true");
    await expect(page.getByTestId("bulk-action-bar")).toBeVisible();
  });

  test("second ⌘-click deselects the task", async ({ page }) => {
    await page.goto("/inbox");
    await page.waitForLoadState("networkidle");

    const task = page.locator("[data-task-id]").first();
    await task.click({ modifiers: ["Meta"] });
    await expect(task).toHaveAttribute("data-selected", "true");

    await task.click({ modifiers: ["Meta"] });
    await expect(task).not.toHaveAttribute("data-selected");
    await expect(page.getByTestId("bulk-action-bar")).not.toBeVisible();
  });

  test("Escape clears selection", async ({ page }) => {
    await page.goto("/inbox");
    await page.waitForLoadState("networkidle");

    const task = page.locator("[data-task-id]").first();
    await task.click({ modifiers: ["Meta"] });
    await expect(page.getByTestId("bulk-action-bar")).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(page.getByTestId("bulk-action-bar")).not.toBeVisible();
  });

  test("bulk complete removes tasks from inbox", async ({ page }) => {
    await page.goto("/inbox");
    await page.waitForLoadState("networkidle");

    const ts = Date.now();
    const title1 = `Bulk complete A ${ts}`;
    const title2 = `Bulk complete B ${ts}`;

    await page.keyboard.press("n");
    await page.getByPlaceholder(/new task/i).fill(title1);
    await page.keyboard.press("Enter");
    await expect(page.getByText(title1)).toBeVisible();
    await page.waitForLoadState("networkidle");

    await page.keyboard.press("n");
    await page.getByPlaceholder(/new task/i).fill(title2);
    await page.keyboard.press("Enter");
    await expect(page.getByText(title2)).toBeVisible();
    await page.waitForLoadState("networkidle");

    await page.locator("[data-task-id]").filter({ hasText: title1 }).click({ modifiers: ["Meta"] });
    await page.locator("[data-task-id]").filter({ hasText: title2 }).click({ modifiers: ["Meta"] });

    await expect(page.getByTestId("bulk-action-bar")).toBeVisible();
    await page.getByTestId("bulk-action-bar").getByRole("button", { name: "Complete" }).click();

    await expect(page.getByText(title1)).not.toBeVisible({ timeout: 8000 });
    await expect(page.getByText(title2)).not.toBeVisible({ timeout: 8000 });
  });

  test("bulk delete removes tasks from inbox", async ({ page }) => {
    await page.goto("/inbox");
    await page.waitForLoadState("networkidle");

    const title = `Bulk delete ${Date.now()}`;
    await page.keyboard.press("n");
    await page.getByPlaceholder(/new task/i).fill(title);
    await page.keyboard.press("Enter");
    await expect(page.getByText(title)).toBeVisible();
    await page.waitForLoadState("networkidle");

    await page.locator("[data-task-id]").filter({ hasText: title }).click({ modifiers: ["Meta"] });
    await page.getByTestId("bulk-action-bar").getByRole("button", { name: "Delete" }).click();

    await expect(page.getByText(title)).not.toBeVisible({ timeout: 8000 });
  });
});
```

- [ ] **Step 2: Run the new tests only**

```bash
cd /Users/erole/GitHub/todo && pnpm e2e -- e2e/bulk-actions.spec.ts --reporter=line
```

Expected: 5 tests pass.

- [ ] **Step 3: Run the full suite to confirm no regressions**

```bash
cd /Users/erole/GitHub/todo && pnpm e2e --reporter=line
```

Expected: all tests pass (previous suite + 5 new bulk-action tests).

- [ ] **Step 4: Commit**

```bash
git add packages/web/e2e/bulk-actions.spec.ts
git commit -m "test: bulk actions E2E — select, deselect, escape, bulk complete, bulk delete"
```
