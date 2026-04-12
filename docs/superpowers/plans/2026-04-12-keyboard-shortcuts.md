# Keyboard Shortcuts System — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a comprehensive keyboard shortcut system with Things 3-inspired bindings, j/k task navigation, full rebinding UI at `/settings/shortcuts`, and a `?` quick-reference overlay.

**Architecture:** A config-driven `KeyboardProvider` wraps the app in `providers.tsx`, holding a single `keydown` listener, focused task state, and an action handler registry. Components register handlers via `useShortcutAction(id, fn)`. Customizations persist to `localStorage["todo-keyboard-shortcuts"]`.

**Tech Stack:** React context, `usePathname` (next/navigation), shadcn/ui Dialog, Playwright E2E

**Spec:** `docs/superpowers/specs/2026-04-12-keyboard-shortcuts-design.md`

---

## File Map

| Action | File |
|---|---|
| Create | `packages/web/src/lib/keyboard/shortcut-config.ts` |
| Create | `packages/web/src/components/keyboard/keyboard-provider.tsx` |
| Create | `packages/web/src/components/keyboard/shortcuts-overlay.tsx` |
| Create | `packages/web/src/app/(views)/settings/shortcuts/page.tsx` |
| Create | `packages/web/e2e/keyboard-shortcuts.spec.ts` |
| Modify | `packages/web/src/app/providers.tsx` |
| Modify | `packages/web/src/components/command-palette.tsx` |
| Modify | `packages/web/src/components/layout/app-shell.tsx` |
| Modify | `packages/web/src/components/layout/sidebar.tsx` |
| Modify | `packages/web/src/components/tasks/task-list.tsx` |
| Modify | `packages/web/src/components/tasks/task-item.tsx` |
| Modify | `packages/web/src/components/tasks/task-quick-add.tsx` |

---

## Task 1: Shortcut config and key-matching utilities

**Files:**
- Create: `packages/web/src/lib/keyboard/shortcut-config.ts`

- [ ] **Step 1: Create the shortcut config file**

```ts
// packages/web/src/lib/keyboard/shortcut-config.ts

export type ShortcutCategory = "navigation" | "task-nav" | "task-actions" | "app";

export interface ShortcutDef {
  id: string;
  defaultKey: string; // e.g. "Meta+1", "c", "Backspace", "?"
  label: string;
  category: ShortcutCategory;
  description?: string;
}

export const SHORTCUT_DEFS: ShortcutDef[] = [
  // Navigation (Cmd+number — no browser conflicts)
  { id: "navigate-today",    defaultKey: "Meta+1",    label: "Go to Today",           category: "navigation" },
  { id: "navigate-inbox",    defaultKey: "Meta+2",    label: "Go to Inbox",           category: "navigation" },
  { id: "navigate-upcoming", defaultKey: "Meta+3",    label: "Go to Upcoming",        category: "navigation" },
  { id: "navigate-someday",  defaultKey: "Meta+4",    label: "Go to Someday",         category: "navigation" },
  { id: "navigate-logbook",  defaultKey: "Meta+5",    label: "Go to Logbook",         category: "navigation" },
  { id: "command-palette",   defaultKey: "Meta+k",    label: "Open command palette",  category: "navigation" },
  { id: "toggle-sidebar",    defaultKey: "Meta+/",    label: "Toggle sidebar",        category: "navigation" },
  // Task navigation (bare keys — skip when focus is in an input)
  { id: "task-next",         defaultKey: "j",         label: "Focus next task",       category: "task-nav" },
  { id: "task-prev",         defaultKey: "k",         label: "Focus previous task",   category: "task-nav" },
  { id: "task-expand",       defaultKey: "Enter",     label: "Expand / open task",    category: "task-nav" },
  { id: "task-close",        defaultKey: "Escape",    label: "Close / deselect",      category: "task-nav" },
  // Task actions (bare keys — no-op when focusedTaskId is null)
  { id: "task-new",          defaultKey: "n",         label: "New task",              category: "task-actions", description: "Quick-add in current view" },
  { id: "task-complete",     defaultKey: "c",         label: "Complete task",         category: "task-actions" },
  { id: "task-delete",       defaultKey: "Backspace", label: "Delete task",           category: "task-actions" },
  { id: "task-edit",         defaultKey: "e",         label: "Edit title",            category: "task-actions", description: "Focuses the title input" },
  { id: "task-move-today",   defaultKey: "t",         label: "Move → Today",          category: "task-actions" },
  { id: "task-move-inbox",   defaultKey: "i",         label: "Move → Inbox",          category: "task-actions" },
  { id: "task-move-someday", defaultKey: "s",         label: "Move → Someday",        category: "task-actions" },
  // App
  { id: "show-shortcuts",    defaultKey: "?",         label: "Show shortcuts",        category: "app" },
  { id: "undo",              defaultKey: "Meta+z",    label: "Undo",                  category: "app" },
];

export const SHORTCUT_STORAGE_KEY = "todo-keyboard-shortcuts";

export type ShortcutOverrides = Record<string, { key: string; enabled: boolean }>;

/**
 * Convert a KeyboardEvent to a normalized key string.
 * Returns "" for lone modifier keys (Meta, Ctrl, Alt, Shift).
 * Examples: "Meta+1", "c", "Backspace", "?" (shift is embedded in e.key)
 */
export function eventToKey(e: KeyboardEvent): string {
  if (["Meta", "Control", "Alt", "Shift"].includes(e.key)) return "";
  const mods: string[] = [];
  if (e.metaKey) mods.push("Meta");
  if (e.ctrlKey) mods.push("Ctrl");
  if (e.altKey) mods.push("Alt");
  return [...mods, e.key].join("+");
}

/**
 * Returns true if a KeyboardEvent matches a stored key string.
 * Note: Shift is NOT checked explicitly — it's already embedded in e.key
 * (e.g. e.key === "?" when Shift+/ is pressed on a US keyboard).
 */
export function matchesKey(e: KeyboardEvent, keyDef: string): boolean {
  if (!keyDef) return false;
  const parts = keyDef.split("+");
  const key = parts[parts.length - 1];
  const needsMeta = parts.includes("Meta");
  const needsCtrl = parts.includes("Ctrl");
  const needsAlt = parts.includes("Alt");
  return (
    e.key === key &&
    e.metaKey === needsMeta &&
    e.ctrlKey === needsCtrl &&
    e.altKey === needsAlt
  );
}

/** Load overrides from localStorage. Returns {} if empty or on error. */
export function loadOverrides(): ShortcutOverrides {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(SHORTCUT_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as ShortcutOverrides) : {};
  } catch {
    return {};
  }
}

/** Persist overrides to localStorage. */
export function saveOverrides(overrides: ShortcutOverrides): void {
  localStorage.setItem(SHORTCUT_STORAGE_KEY, JSON.stringify(overrides));
}

/** Format a key string for display. Returns an array of key-cap strings. */
export function formatKeyParts(key: string): string[] {
  return key.split("+").map((part) => {
    if (part === "Meta") return "⌘";
    if (part === "Ctrl") return "⌃";
    if (part === "Alt") return "⌥";
    if (part === "Backspace") return "⌫";
    if (part === "Escape") return "Esc";
    if (part === "Enter") return "↵";
    return part;
  });
}
```

- [ ] **Step 2: Commit**

```bash
cd packages/web && git add src/lib/keyboard/shortcut-config.ts
git commit -m "feat: keyboard shortcut config and key-matching utilities"
```

---

## Task 2: KeyboardProvider context

**Files:**
- Create: `packages/web/src/components/keyboard/keyboard-provider.tsx`

- [ ] **Step 1: Create the provider**

```tsx
// packages/web/src/components/keyboard/keyboard-provider.tsx
"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import {
  SHORTCUT_DEFS,
  ShortcutOverrides,
  eventToKey,
  loadOverrides,
  matchesKey,
  saveOverrides,
} from "@/lib/keyboard/shortcut-config";

interface KeyboardContextValue {
  overrides: ShortcutOverrides;
  focusedTaskId: string | null;
  setFocusedTaskId: (id: string | null) => void;
  registerTaskList: (ids: string[]) => void;
  registerAction: (id: string, handler: () => void) => void;
  unregisterAction: (id: string) => void;
  recordingId: string | null;
  startRecording: (id: string, onRecorded: (key: string | null) => void) => void;
  stopRecording: () => void;
  updateShortcut: (id: string, key: string) => void;
  toggleShortcut: (id: string, enabled: boolean) => void;
  resetAll: () => void;
}

const KeyboardContext = createContext<KeyboardContextValue | null>(null);

export function useKeyboard(): KeyboardContextValue {
  const ctx = useContext(KeyboardContext);
  if (!ctx) throw new Error("useKeyboard must be used within KeyboardProvider");
  return ctx;
}

export function useFocusedTask() {
  const { focusedTaskId, setFocusedTaskId } = useKeyboard();
  return { focusedTaskId, setFocusedTaskId };
}

/**
 * Register the current page's ordered task IDs for j/k navigation.
 * Uses ids.join(",") as a stable dependency so it re-registers when the list changes.
 */
export function useRegisterTaskList(ids: string[]) {
  const { registerTaskList } = useKeyboard();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { registerTaskList(ids); }, [ids.join(","), registerTaskList]);
}

/**
 * Register an action handler for a shortcut ID.
 * Uses a ref to avoid stale closures — the latest handler is always called.
 */
export function useShortcutAction(id: string, handler: () => void) {
  const { registerAction, unregisterAction } = useKeyboard();
  const handlerRef = useRef(handler);
  useEffect(() => { handlerRef.current = handler; });
  useEffect(() => {
    const stable = () => handlerRef.current();
    registerAction(id, stable);
    return () => unregisterAction(id);
  }, [id, registerAction, unregisterAction]);
}

export function KeyboardProvider({ children }: { children: React.ReactNode }) {
  const [overrides, setOverrides] = useState<ShortcutOverrides>({});
  const [focusedTaskId, setFocusedTaskId] = useState<string | null>(null);
  const [recordingId, setRecordingId] = useState<string | null>(null);
  const pathname = usePathname();

  const orderedTaskIds = useRef<string[]>([]);
  const actionHandlers = useRef<Map<string, () => void>>(new Map());
  const onRecordedCallback = useRef<((key: string | null) => void) | null>(null);

  // Keep mutable refs in sync for use inside the stable keydown listener
  const focusedRef = useRef(focusedTaskId);
  useEffect(() => { focusedRef.current = focusedTaskId; }, [focusedTaskId]);
  const overridesRef = useRef(overrides);
  useEffect(() => { overridesRef.current = overrides; }, [overrides]);
  const recordingRef = useRef(recordingId);
  useEffect(() => { recordingRef.current = recordingId; }, [recordingId]);

  // Load persisted customizations on mount
  useEffect(() => { setOverrides(loadOverrides()); }, []);

  // Reset focus whenever the user navigates to a different view
  useEffect(() => { setFocusedTaskId(null); }, [pathname]);

  const registerTaskList = useCallback((ids: string[]) => {
    orderedTaskIds.current = ids;
  }, []);

  const registerAction = useCallback((id: string, handler: () => void) => {
    actionHandlers.current.set(id, handler);
  }, []);

  const unregisterAction = useCallback((id: string) => {
    actionHandlers.current.delete(id);
  }, []);

  const startRecording = useCallback((id: string, onRecorded: (key: string | null) => void) => {
    setRecordingId(id);
    onRecordedCallback.current = onRecorded;
  }, []);

  const stopRecording = useCallback(() => {
    setRecordingId(null);
    onRecordedCallback.current = null;
  }, []);

  const updateShortcut = useCallback((id: string, key: string) => {
    setOverrides((prev) => {
      const next = { ...prev, [id]: { key, enabled: prev[id]?.enabled ?? true } };
      saveOverrides(next);
      return next;
    });
  }, []);

  const toggleShortcut = useCallback((id: string, enabled: boolean) => {
    setOverrides((prev) => {
      const def = SHORTCUT_DEFS.find((d) => d.id === id);
      const key = prev[id]?.key ?? def?.defaultKey ?? "";
      const next = { ...prev, [id]: { key, enabled } };
      saveOverrides(next);
      return next;
    });
  }, []);

  const resetAll = useCallback(() => {
    setOverrides({});
    saveOverrides({});
  }, []);

  // Single global keydown listener. All state is accessed via refs to keep
  // the effect stable (empty deps array — never re-registers).
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Let Radix dialogs/popovers handle their own Escape/etc first
      if (e.defaultPrevented) return;

      // ── Recording mode ────────────────────────────────────────────────
      const rid = recordingRef.current;
      if (rid) {
        const key = eventToKey(e);
        if (!key) return; // lone modifier
        e.preventDefault();
        const result = e.key === "Escape" ? null : key;
        const cb = onRecordedCallback.current;
        onRecordedCallback.current = null;
        setRecordingId(null);
        cb?.(result);
        return;
      }

      // ── Normal shortcut dispatch ───────────────────────────────────────
      const target = e.target as HTMLElement;
      const inInput =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable;

      const cur = overridesRef.current;

      for (const def of SHORTCUT_DEFS) {
        const override = cur[def.id];
        const key = override?.key ?? def.defaultKey;
        const enabled = override?.enabled ?? true;

        if (!enabled) continue;
        if (!matchesKey(e, key)) continue;

        // Bare keys (no Meta/Ctrl/Alt modifier): skip when focus is in a text field
        const isBareKey = !key.includes("Meta") && !key.includes("Ctrl") && !key.includes("Alt");
        if (isBareKey && inInput) continue;

        // Built-in: task navigation moves the focus cursor
        if (def.id === "task-next") {
          e.preventDefault();
          const ids = orderedTaskIds.current;
          if (!ids.length) break;
          const idx = ids.indexOf(focusedRef.current ?? "");
          setFocusedTaskId(ids[idx === -1 ? 0 : Math.min(idx + 1, ids.length - 1)]);
          break;
        }
        if (def.id === "task-prev") {
          e.preventDefault();
          const ids = orderedTaskIds.current;
          if (!ids.length) break;
          const idx = ids.indexOf(focusedRef.current ?? "");
          if (idx > 0) setFocusedTaskId(ids[idx - 1]);
          break;
        }

        // Dispatch to registered handler
        const handler = actionHandlers.current.get(def.id);
        if (handler) {
          e.preventDefault();
          handler();
        }
        break;
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []); // stable — everything read through refs

  return (
    <KeyboardContext.Provider
      value={{
        overrides,
        focusedTaskId,
        setFocusedTaskId,
        registerTaskList,
        registerAction,
        unregisterAction,
        recordingId,
        startRecording,
        stopRecording,
        updateShortcut,
        toggleShortcut,
        resetAll,
      }}
    >
      {children}
    </KeyboardContext.Provider>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/web/src/components/keyboard/keyboard-provider.tsx
git commit -m "feat: KeyboardProvider context with action registry and focused task state"
```

---

## Task 3: Wire provider + navigation shortcuts + update CommandPalette

**Files:**
- Modify: `packages/web/src/app/providers.tsx`
- Modify: `packages/web/src/components/layout/app-shell.tsx`
- Modify: `packages/web/src/components/command-palette.tsx`
- Create: `packages/web/e2e/keyboard-shortcuts.spec.ts` (navigation tests only)

- [ ] **Step 1: Write the failing E2E test**

```ts
// packages/web/e2e/keyboard-shortcuts.spec.ts
import { test, expect } from "@playwright/test";

test.describe("Keyboard shortcuts — navigation", () => {
  test("Cmd+2 navigates to Inbox", async ({ page }) => {
    await page.goto("/today");
    await page.keyboard.press("Meta+2");
    await expect(page).toHaveURL(/\/inbox/);
  });

  test("Cmd+1 navigates to Today", async ({ page }) => {
    await page.goto("/inbox");
    await page.keyboard.press("Meta+1");
    await expect(page).toHaveURL(/\/today/);
  });

  test("Cmd+3 navigates to Upcoming", async ({ page }) => {
    await page.goto("/inbox");
    await page.keyboard.press("Meta+3");
    await expect(page).toHaveURL(/\/upcoming/);
  });
});
```

- [ ] **Step 2: Run to confirm it fails**

```bash
pnpm e2e --grep "navigation"
```
Expected: FAIL — no keyboard handlers exist yet.

- [ ] **Step 3: Wrap providers.tsx with KeyboardProvider**

```tsx
// packages/web/src/app/providers.tsx
"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CommandPalette } from "@/components/command-palette";
import { KeyboardProvider } from "@/components/keyboard/keyboard-provider";
import { Toaster } from "sonner";
import { useState } from "react";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5 * 60 * 1000,
            retry: 1,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
        <TooltipProvider>
          <KeyboardProvider>
            {children}
            <CommandPalette />
            <Toaster theme="system" richColors position="bottom-right" duration={5000} />
          </KeyboardProvider>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
```

- [ ] **Step 4: Add KeyboardNavigationHandlers + ShortcutsOverlay slot in AppShell**

```tsx
// packages/web/src/components/layout/app-shell.tsx
"use client";

import { useRouter } from "next/navigation";
import { SidebarProvider, SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import { AppSidebar } from "./sidebar";
import { TaskDndProvider } from "@/components/dnd/task-dnd-provider";
import { useShortcutAction } from "@/components/keyboard/keyboard-provider";

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
        <KeyboardNavigationHandlers />
        <AppSidebar />
        <main className="flex flex-1 flex-col min-h-screen">
          <header className="flex h-12 items-center gap-2 border-b px-4 md:hidden">
            <SidebarTrigger />
          </header>
          <div className="flex flex-1 flex-col p-6">{children}</div>
        </main>
      </SidebarProvider>
    </TaskDndProvider>
  );
}
```

- [ ] **Step 5: Update CommandPalette to use useShortcutAction, remove its own listener**

Replace the `useEffect` that listens for `⌘K` (lines 45–54 in the current file) with a single hook call.

In `packages/web/src/components/command-palette.tsx`, delete:
```tsx
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);
```

Add this import at the top:
```tsx
import { useShortcutAction } from "@/components/keyboard/keyboard-provider";
```

Add this line inside the `CommandPalette` function body (after the `useState` declarations):
```tsx
  useShortcutAction("command-palette", () => setOpen((prev) => !prev));
```

- [ ] **Step 6: Run E2E tests — should pass now**

```bash
pnpm e2e --grep "navigation"
```
Expected: PASS for all 3 navigation tests.

- [ ] **Step 7: Commit**

```bash
git add packages/web/src/app/providers.tsx \
        packages/web/src/components/layout/app-shell.tsx \
        packages/web/src/components/command-palette.tsx \
        packages/web/e2e/keyboard-shortcuts.spec.ts
git commit -m "feat: wire KeyboardProvider, add navigation shortcuts, migrate Cmd+K"
```

---

## Task 4: Task focus ring + j/k navigation

**Files:**
- Modify: `packages/web/src/components/tasks/task-item.tsx`
- Modify: `packages/web/src/components/tasks/task-list.tsx`

- [ ] **Step 1: Add failing E2E tests for task navigation**

Append to `packages/web/e2e/keyboard-shortcuts.spec.ts`:

```ts
test.describe("Keyboard shortcuts — task navigation", () => {
  test("J focuses the first task, second J moves to the next", async ({ page }) => {
    await page.goto("/inbox");

    // Create two tasks to navigate between
    const t1 = `Nav task A ${Date.now()}`;
    const t2 = `Nav task B ${Date.now()}`;
    await page.getByRole("button", { name: "New task" }).click();
    await page.getByPlaceholder(/new task/i).fill(t1);
    await page.keyboard.press("Enter");
    await page.getByRole("button", { name: "New task" }).click();
    await page.getByPlaceholder(/new task/i).fill(t2);
    await page.keyboard.press("Enter");

    // Press J — should focus first task (indigo border)
    await page.keyboard.press("j");
    const firstTask = page.locator(`[data-task-id]`).first();
    await expect(firstTask).toHaveAttribute("data-focused", "true");

    // Press J again — should move to next task
    await page.keyboard.press("j");
    const secondTask = page.locator(`[data-task-id]`).nth(1);
    await expect(secondTask).toHaveAttribute("data-focused", "true");
  });

  test("K moves focus backwards", async ({ page }) => {
    await page.goto("/inbox");

    const title = `Nav K test ${Date.now()}`;
    await page.getByRole("button", { name: "New task" }).click();
    await page.getByPlaceholder(/new task/i).fill(title);
    await page.keyboard.press("Enter");

    await page.keyboard.press("j"); // focus first
    await page.keyboard.press("j"); // move to second (if exists) or stays
    await page.keyboard.press("k"); // move back
    const firstTask = page.locator(`[data-task-id]`).first();
    await expect(firstTask).toHaveAttribute("data-focused", "true");
  });
});
```

- [ ] **Step 2: Run to confirm it fails**

```bash
pnpm e2e --grep "task navigation"
```
Expected: FAIL — `data-focused` attribute doesn't exist yet.

- [ ] **Step 3: Update TaskItem to show focus ring and expose data attributes**

In `packages/web/src/components/tasks/task-item.tsx`, add this import:
```tsx
import { useFocusedTask } from "@/components/keyboard/keyboard-provider";
```

Inside the `TaskItem` function, after the existing hooks, add:
```tsx
  const { focusedTaskId } = useFocusedTask();
  const isFocused = focusedTaskId === task.id;
```

On the `<motion.div ref={setRefs}` element, add two new props:
```tsx
              data-task-id={task.id}
              data-focused={isFocused ? "true" : undefined}
```

In the title-row `<div>`, update the `className` to use `isFocused` for the border:

Find this className block (the non-expanded state has `border-l-2 border-transparent hover:...`):
```tsx
                  isExpanded
                    ? "px-4 pt-3.5"
                    : "pl-4 pr-3 border-l-2 border-transparent hover:border-primary/40 hover:bg-primary/[0.05]",
```

Replace with:
```tsx
                  isExpanded
                    ? "px-4 pt-3.5"
                    : cn(
                        "pl-4 pr-3 border-l-2",
                        isFocused
                          ? "border-primary/70 bg-primary/[0.04]"
                          : "border-transparent hover:border-primary/40 hover:bg-primary/[0.05]",
                      ),
```

- [ ] **Step 4: Update TaskList to register task IDs and handle toggle with focus**

Replace the content of `packages/web/src/components/tasks/task-list.tsx` with:

```tsx
"use client";

import { useState, useCallback, useMemo } from "react";
import type { Task, Section } from "@todo/shared";
import { TaskItem } from "./task-item";
import { TaskQuickAdd } from "./task-quick-add";
import { Skeleton } from "@/components/ui/skeleton";
import { useProjects } from "@/hooks/use-projects";
import type { ProjectWithCounts } from "@todo/shared";
import { useRegisterTaskList, useFocusedTask } from "@/components/keyboard/keyboard-provider";

interface TaskListProps {
  tasks: Task[];
  isLoading?: boolean;
  showWhenDate?: boolean;
  quickAddDefaults?: Partial<Pick<Task, "whenDate" | "timeOfDay" | "projectId" | "areaId" | "sectionId">>;
  activeSections?: Section[];
  emptyMessage?: string;
}

export function TaskList({ tasks, isLoading, showWhenDate, quickAddDefaults, activeSections, emptyMessage }: TaskListProps) {
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const { data: allProjects = [] } = useProjects();
  const activeProjects = allProjects.filter((p) => !p.isCompleted) as ProjectWithCounts[];
  const { setFocusedTaskId } = useFocusedTask();

  // Register ordered task IDs for j/k navigation
  const taskIds = useMemo(() => tasks.map((t) => t.id), [tasks]);
  useRegisterTaskList(taskIds);

  // Clicking a task sets focus AND toggles expand/collapse
  const handleToggle = useCallback((id: string) => {
    setFocusedTaskId(id);
    setExpandedTaskId((prev) => (prev === id ? null : id));
  }, [setFocusedTaskId]);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-2">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-10 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {tasks.length === 0 && emptyMessage && (
        <p className="text-sm text-muted-foreground py-6 text-center">{emptyMessage}</p>
      )}
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
      <TaskQuickAdd defaults={quickAddDefaults} />
    </div>
  );
}
```

- [ ] **Step 5: Run E2E tests — should pass**

```bash
pnpm e2e --grep "task navigation"
```
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/web/src/components/tasks/task-item.tsx \
        packages/web/src/components/tasks/task-list.tsx
git commit -m "feat: task focus ring and j/k keyboard navigation"
```

---

## Task 5: Task action shortcuts (c, t, i, s, ⌫, e, Enter, Escape)

**Files:**
- Modify: `packages/web/src/components/tasks/task-list.tsx`

- [ ] **Step 1: Add failing E2E test for task completion via keyboard**

Append to `packages/web/e2e/keyboard-shortcuts.spec.ts`:

```ts
test.describe("Keyboard shortcuts — task actions", () => {
  test("C completes the focused task", async ({ page }) => {
    await page.goto("/inbox");

    const title = `Complete via C ${Date.now()}`;
    await page.getByRole("button", { name: "New task" }).click();
    await page.getByPlaceholder(/new task/i).fill(title);
    await page.keyboard.press("Enter");
    await expect(page.getByText(title)).toBeVisible();

    // Focus the task with J, then complete with C
    await page.keyboard.press("j");
    await page.keyboard.press("c");

    await expect(page.getByText(title)).not.toBeVisible({ timeout: 3000 });
  });

  test("T moves focused task to Today", async ({ page }) => {
    await page.goto("/inbox");

    const title = `Move to Today ${Date.now()}`;
    await page.getByRole("button", { name: "New task" }).click();
    await page.getByPlaceholder(/new task/i).fill(title);
    await page.keyboard.press("Enter");

    await page.keyboard.press("j");
    await page.keyboard.press("t");

    // Task should leave inbox
    await expect(page.getByText(title)).not.toBeVisible({ timeout: 2000 });
  });
});
```

- [ ] **Step 2: Run to confirm it fails**

```bash
pnpm e2e --grep "task actions"
```
Expected: FAIL.

- [ ] **Step 3: Add task action handlers to TaskList**

Add these imports to `packages/web/src/components/tasks/task-list.tsx`:
```tsx
import {
  useCompleteTask,
  useDeleteTask,
  useRestoreTask,
  useUncompleteTask,
  useUpdateTask,
} from "@/hooks/use-tasks";
import { useShortcutAction } from "@/components/keyboard/keyboard-provider";
import { notify } from "@/lib/toast";
```

Add a `todayStr()` helper at the top of the file (after imports):
```ts
function todayStr() {
  return new Date().toISOString().slice(0, 10);
}
```

**First**, update the existing `useFocusedTask()` call from Task 4 to also destructure `focusedTaskId`. Find:
```tsx
  const { setFocusedTaskId } = useFocusedTask();
```
Replace with:
```tsx
  const { focusedTaskId, setFocusedTaskId } = useFocusedTask();
```

Then add this block inside `TaskList`, after the `handleToggle` definition (before the `if (isLoading)` check):
```tsx
  const completeTask = useCompleteTask();
  const uncompleteTask = useUncompleteTask();
  const deleteTask = useDeleteTask();
  const restoreTask = useRestoreTask();
  const updateTask = useUpdateTask();

  useShortcutAction("task-complete", () => {
    const id = focusedTaskId;
    if (!id) return;
    completeTask.mutate(id, {
      onSuccess: () => notify.undoable("Task completed", () => uncompleteTask.mutate(id)),
    });
  });

  useShortcutAction("task-delete", () => {
    const id = focusedTaskId;
    if (!id) return;
    setFocusedTaskId(null);
    setExpandedTaskId(null);
    deleteTask.mutate(id, {
      onSuccess: () => notify.undoable("Task deleted", () => restoreTask.mutate(id)),
    });
  });

  useShortcutAction("task-move-today", () => {
    const id = focusedTaskId;
    if (!id) return;
    const focused = tasks.find((t) => t.id === id);
    if (!focused) return;
    const prev = { whenDate: focused.whenDate, timeOfDay: focused.timeOfDay, isSomeday: focused.isSomeday };
    updateTask.mutate(
      { id, whenDate: todayStr(), timeOfDay: null, isSomeday: false },
      { onSuccess: () => notify.undoable("Moved to Today", () => updateTask.mutate({ id, ...prev })) },
    );
  });

  useShortcutAction("task-move-inbox", () => {
    const id = focusedTaskId;
    if (!id) return;
    const focused = tasks.find((t) => t.id === id);
    if (!focused) return;
    const prev = { whenDate: focused.whenDate, timeOfDay: focused.timeOfDay, isSomeday: focused.isSomeday };
    updateTask.mutate(
      { id, whenDate: null, timeOfDay: null, isSomeday: false },
      { onSuccess: () => notify.undoable("Moved to Inbox", () => updateTask.mutate({ id, ...prev })) },
    );
  });

  useShortcutAction("task-move-someday", () => {
    const id = focusedTaskId;
    if (!id) return;
    const focused = tasks.find((t) => t.id === id);
    if (!focused) return;
    const prev = { whenDate: focused.whenDate, timeOfDay: focused.timeOfDay, isSomeday: focused.isSomeday };
    updateTask.mutate(
      { id, isSomeday: true, whenDate: null, timeOfDay: null },
      { onSuccess: () => notify.undoable("Moved to Someday", () => updateTask.mutate({ id, ...prev })) },
    );
  });

  useShortcutAction("task-expand", () => {
    if (!focusedTaskId) return;
    setExpandedTaskId((prev) => (prev === focusedTaskId ? null : focusedTaskId));
  });

  useShortcutAction("task-close", () => {
    if (expandedTaskId) {
      setExpandedTaskId(null); // collapse but keep focus
    } else {
      setFocusedTaskId(null); // deselect
    }
  });

  // task-edit: expand the task — TaskItem auto-focuses the title input when isExpanded becomes true
  useShortcutAction("task-edit", () => {
    if (!focusedTaskId) return;
    setExpandedTaskId(focusedTaskId);
  });
```

- [ ] **Step 4: Run E2E tests — should pass**

```bash
pnpm e2e --grep "task actions"
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/components/tasks/task-list.tsx \
        packages/web/e2e/keyboard-shortcuts.spec.ts
git commit -m "feat: task action keyboard shortcuts (c/t/i/s/backspace/e/enter/esc)"
```

---

## Task 6: N shortcut — quick-add via keyboard

**Files:**
- Modify: `packages/web/src/components/tasks/task-quick-add.tsx`
- Modify: `packages/web/src/components/tasks/task-list.tsx`

- [ ] **Step 1: Add failing E2E test**

Append to `packages/web/e2e/keyboard-shortcuts.spec.ts`:

```ts
test.describe("Keyboard shortcuts — new task", () => {
  test("N opens the quick-add input", async ({ page }) => {
    await page.goto("/inbox");
    await page.keyboard.press("n");
    await expect(page.getByPlaceholder(/new task/i)).toBeVisible();
    await expect(page.getByPlaceholder(/new task/i)).toBeFocused();
  });
});
```

- [ ] **Step 2: Run to confirm it fails**

```bash
pnpm e2e --grep "new task"
```
Expected: FAIL.

- [ ] **Step 3: Add forwardRef + imperative handle to TaskQuickAdd**

In `packages/web/src/components/tasks/task-quick-add.tsx`, add `forwardRef` and `useImperativeHandle`:

Change the import line at the top:
```tsx
import { useState, useRef, forwardRef, useImperativeHandle } from "react";
```

Change the interface to add a ref type export:
```tsx
export interface TaskQuickAddHandle {
  focus: () => void;
}
```

Change `export function TaskQuickAdd(...)` to use `forwardRef`:
```tsx
export const TaskQuickAdd = forwardRef<TaskQuickAddHandle, TaskQuickAddProps>(
  function TaskQuickAdd({ defaults }: TaskQuickAddProps, ref) {
```

Inside the function body, after `const inputRef = useRef...`, add:
```tsx
    useImperativeHandle(ref, () => ({
      focus: handleOpen,
    }));
```

Close the forwardRef wrapper at the end of the file (add an extra `}` and `)` before the final semicolon):
```tsx
  },
);
```

- [ ] **Step 4: Wire the ref in TaskList**

In `packages/web/src/components/tasks/task-list.tsx`, add this import change:
```tsx
import { TaskQuickAdd, TaskQuickAddHandle } from "./task-quick-add";
```

Add a ref inside `TaskList`:
```tsx
  const quickAddRef = useRef<TaskQuickAddHandle>(null);
```

Add this `useShortcutAction` call alongside the other action registrations:
```tsx
  useShortcutAction("task-new", () => {
    quickAddRef.current?.focus();
  });
```

Update the `<TaskQuickAdd>` JSX to pass the ref:
```tsx
      <TaskQuickAdd ref={quickAddRef} defaults={quickAddDefaults} />
```

Add `useRef` to the React import if not already there:
```tsx
import { useState, useCallback, useMemo, useRef } from "react";
```

- [ ] **Step 5: Run E2E tests — should pass**

```bash
pnpm e2e --grep "new task"
```
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/web/src/components/tasks/task-quick-add.tsx \
        packages/web/src/components/tasks/task-list.tsx \
        packages/web/e2e/keyboard-shortcuts.spec.ts
git commit -m "feat: N shortcut opens quick-add via TaskQuickAdd forwardRef"
```

---

## Task 7: Shortcuts overlay (? key)

**Files:**
- Create: `packages/web/src/components/keyboard/shortcuts-overlay.tsx`
- Modify: `packages/web/src/components/layout/app-shell.tsx`

- [ ] **Step 1: Add failing E2E test**

Append to `packages/web/e2e/keyboard-shortcuts.spec.ts`:

```ts
test.describe("Keyboard shortcuts — overlay", () => {
  test("? opens the shortcuts reference overlay", async ({ page }) => {
    await page.goto("/inbox");
    await page.keyboard.press("?");
    await expect(page.getByText("Keyboard Shortcuts")).toBeVisible();
    await expect(page.getByText("Go to Today")).toBeVisible();
  });

  test("Esc closes the overlay", async ({ page }) => {
    await page.goto("/inbox");
    await page.keyboard.press("?");
    await expect(page.getByText("Keyboard Shortcuts")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByText("Keyboard Shortcuts")).not.toBeVisible({ timeout: 1000 });
  });
});
```

- [ ] **Step 2: Run to confirm it fails**

```bash
pnpm e2e --grep "overlay"
```
Expected: FAIL.

- [ ] **Step 3: Create ShortcutsOverlay**

```tsx
// packages/web/src/components/keyboard/shortcuts-overlay.tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { Keyboard } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SHORTCUT_DEFS, ShortcutCategory, formatKeyParts } from "@/lib/keyboard/shortcut-config";
import { useKeyboard, useShortcutAction } from "@/components/keyboard/keyboard-provider";

const CATEGORY_LABELS: Record<ShortcutCategory, string> = {
  navigation: "Navigate",
  "task-nav": "Task Navigation",
  "task-actions": "Task Actions",
  app: "App",
};

const CATEGORY_ORDER: ShortcutCategory[] = ["navigation", "task-nav", "task-actions", "app"];

export function ShortcutsOverlay() {
  const [open, setOpen] = useState(false);
  const { overrides } = useKeyboard();

  useShortcutAction("show-shortcuts", () => setOpen((v) => !v));

  const grouped = CATEGORY_ORDER.map((cat) => ({
    cat,
    label: CATEGORY_LABELS[cat],
    items: SHORTCUT_DEFS.filter(
      (d) => d.category === cat && (overrides[d.id]?.enabled ?? true),
    ),
  })).filter((g) => g.items.length > 0);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-lg p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-5 py-4 border-b border-border/50">
          <DialogTitle className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
            <Keyboard className="h-4 w-4" />
            Keyboard Shortcuts
          </DialogTitle>
        </DialogHeader>

        <div className="px-5 py-4 grid grid-cols-2 gap-x-8 gap-y-4 max-h-[60vh] overflow-y-auto">
          {grouped.map(({ cat, label, items }) => (
            <div key={cat} className="flex flex-col">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50 mb-1.5">
                {label}
              </p>
              {items.map((def) => {
                const key = overrides[def.id]?.key ?? def.defaultKey;
                const parts = formatKeyParts(key);
                return (
                  <div
                    key={def.id}
                    className="flex items-center justify-between py-1 border-b border-border/30 last:border-0"
                  >
                    <span className="text-xs text-muted-foreground">{def.label}</span>
                    <div className="flex items-center gap-0.5 ml-3 flex-shrink-0">
                      {parts.map((p, i) => (
                        <kbd
                          key={i}
                          className="inline-flex items-center justify-center bg-muted/60 border border-border/60 rounded px-1.5 py-0.5 text-[11px] font-mono text-muted-foreground min-w-[1.25rem]"
                        >
                          {p}
                        </kbd>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        <div className="px-5 py-3 border-t border-border/50 flex items-center justify-between">
          <span className="text-[11px] text-muted-foreground/40">
            Bare-key shortcuts fire when focus is not in a text field
          </span>
          <Link
            href="/settings/shortcuts"
            onClick={() => setOpen(false)}
            className="text-[11px] text-primary hover:text-primary/80 transition-colors"
          >
            Edit shortcuts →
          </Link>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 4: Add ShortcutsOverlay to AppShell**

In `packages/web/src/components/layout/app-shell.tsx`, add the import:
```tsx
import { ShortcutsOverlay } from "@/components/keyboard/shortcuts-overlay";
```

Add `<ShortcutsOverlay />` inside the `<SidebarProvider>`, after `<KeyboardNavigationHandlers />`:
```tsx
        <KeyboardNavigationHandlers />
        <ShortcutsOverlay />
```

- [ ] **Step 5: Run E2E tests — should pass**

```bash
pnpm e2e --grep "overlay"
```
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/web/src/components/keyboard/shortcuts-overlay.tsx \
        packages/web/src/components/layout/app-shell.tsx \
        packages/web/e2e/keyboard-shortcuts.spec.ts
git commit -m "feat: ? shortcuts reference overlay"
```

---

## Task 8: Settings page — full rebinding UI

**Files:**
- Create: `packages/web/src/app/(views)/settings/shortcuts/page.tsx`

- [ ] **Step 1: Add failing E2E test**

Append to `packages/web/e2e/keyboard-shortcuts.spec.ts`:

```ts
test.describe("Keyboard shortcuts — settings page", () => {
  test("settings page loads and lists shortcuts", async ({ page }) => {
    await page.goto("/settings/shortcuts");
    await expect(page.getByRole("heading", { name: "Keyboard Shortcuts" })).toBeVisible();
    await expect(page.getByText("Go to Today")).toBeVisible();
    await expect(page.getByText("Complete task")).toBeVisible();
  });

  test("toggle disables a shortcut", async ({ page }) => {
    await page.goto("/settings/shortcuts");

    // Find the toggle for "Go to Today" and click it (turns off)
    const todayRow = page.locator("tr").filter({ hasText: "Go to Today" });
    const toggle = todayRow.getByRole("switch");
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-checked", "false");

    // Verify shortcut no longer navigates
    await page.goto("/inbox");
    await page.keyboard.press("Meta+1");
    await expect(page).toHaveURL(/\/inbox/); // stayed on inbox

    // Re-enable for cleanup
    await page.goto("/settings/shortcuts");
    const todayRow2 = page.locator("tr").filter({ hasText: "Go to Today" });
    await todayRow2.getByRole("switch").click();
  });
});
```

- [ ] **Step 2: Run to confirm it fails**

```bash
pnpm e2e --grep "settings page"
```
Expected: FAIL — page doesn't exist.

- [ ] **Step 3: Create the settings page**

```tsx
// packages/web/src/app/(views)/settings/shortcuts/page.tsx
"use client";

import { useState } from "react";
import { SHORTCUT_DEFS, ShortcutCategory, ShortcutDef, formatKeyParts } from "@/lib/keyboard/shortcut-config";
import { useKeyboard } from "@/components/keyboard/keyboard-provider";
import { cn } from "@/lib/utils";

const CATEGORY_LABELS: Record<ShortcutCategory, string> = {
  navigation: "Navigation",
  "task-nav": "Task Navigation",
  "task-actions": "Task Actions",
  app: "App",
};

const CATEGORY_ORDER: ShortcutCategory[] = ["navigation", "task-nav", "task-actions", "app"];

function formatKeyDisplay(key: string): string {
  return formatKeyParts(key).join("");
}

interface ConflictState {
  id: string;
  key: string;
  conflictLabel: string;
  conflictId: string;
}

export default function ShortcutsSettingsPage() {
  const keyboard = useKeyboard();
  const [search, setSearch] = useState("");
  const [localRecordingId, setLocalRecordingId] = useState<string | null>(null);
  const [conflict, setConflict] = useState<ConflictState | null>(null);

  function handleRecordClick(def: ShortcutDef) {
    // Cancel if already recording this one
    if (localRecordingId === def.id) {
      keyboard.stopRecording();
      setLocalRecordingId(null);
      return;
    }
    setLocalRecordingId(def.id);
    keyboard.startRecording(def.id, (key) => {
      setLocalRecordingId(null);
      if (!key) return; // user pressed Escape

      // Check for conflicts with other enabled shortcuts
      const conflictDef = SHORTCUT_DEFS.find((d) => {
        if (d.id === def.id) return false;
        const override = keyboard.overrides[d.id];
        const currentKey = override?.key ?? d.defaultKey;
        const enabled = override?.enabled ?? true;
        return enabled && currentKey === key;
      });

      if (conflictDef) {
        setConflict({ id: def.id, key, conflictLabel: conflictDef.label, conflictId: conflictDef.id });
      } else {
        keyboard.updateShortcut(def.id, key);
      }
    });
  }

  function resolveConflict(confirm: boolean) {
    if (!conflict) return;
    if (confirm) {
      // Clear the conflicting shortcut's binding
      keyboard.updateShortcut(conflict.conflictId, "");
      keyboard.updateShortcut(conflict.id, conflict.key);
    }
    setConflict(null);
  }

  const lowerSearch = search.toLowerCase();
  const filteredDefs = search.trim()
    ? SHORTCUT_DEFS.filter((d) => d.label.toLowerCase().includes(lowerSearch))
    : SHORTCUT_DEFS;

  const grouped = CATEGORY_ORDER.map((cat) => ({
    cat,
    label: CATEGORY_LABELS[cat],
    items: filteredDefs.filter((d) => d.category === cat),
  })).filter((g) => g.items.length > 0);

  const rows = grouped.flatMap(({ cat, label, items }) => [
    { type: "heading" as const, cat, label },
    ...items.map((def) => ({ type: "row" as const, def })),
  ]);

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight">Keyboard Shortcuts</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Click any shortcut to record a new key. Customizations are saved to your browser.
        </p>
      </div>

      <div className="flex items-center gap-3 mb-4">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search shortcuts…"
          className="flex-1 h-9 px-3 rounded-md border border-input bg-background text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <button
          onClick={keyboard.resetAll}
          className="h-9 px-3 text-sm border border-input rounded-md text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-colors"
        >
          Reset all
        </button>
      </div>

      {conflict && (
        <div className="mb-4 p-3 rounded-lg border border-amber-500/30 bg-amber-500/10 text-sm flex items-center justify-between gap-3">
          <span className="text-amber-700 dark:text-amber-400">
            Already used by <strong>{conflict.conflictLabel}</strong> — save anyway?
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => resolveConflict(true)}
              className="text-xs px-2 py-1 rounded bg-amber-500 text-white hover:bg-amber-600 transition-colors"
            >
              Save
            </button>
            <button
              onClick={() => resolveConflict(false)}
              className="text-xs px-2 py-1 rounded border border-amber-500/40 text-amber-700 dark:text-amber-400 hover:bg-amber-500/10 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="text-left text-xs font-medium text-muted-foreground px-4 py-2.5 w-[42%]">Name</th>
              <th className="text-left text-xs font-medium text-muted-foreground px-4 py-2.5 w-[20%]">Category</th>
              <th className="text-left text-xs font-medium text-muted-foreground px-4 py-2.5">Shortcut</th>
              <th className="text-center text-xs font-medium text-muted-foreground px-4 py-2.5 w-16">On</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              if (row.type === "heading") {
                return (
                  <tr key={`heading-${row.cat}`} className="bg-muted/10 border-b border-border">
                    <td
                      colSpan={4}
                      className="px-4 py-1.5 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/50"
                    >
                      {row.label}
                    </td>
                  </tr>
                );
              }

              const { def } = row;
              const override = keyboard.overrides[def.id];
              const key = override?.key ?? def.defaultKey;
              const enabled = override?.enabled ?? true;
              const isRecording = localRecordingId === def.id;

              return (
                <tr
                  key={def.id}
                  className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors"
                >
                  <td className="px-4 py-2.5">
                    <div className="text-sm text-foreground/80">{def.label}</div>
                    {def.description && (
                      <div className="text-xs text-muted-foreground/50 mt-0.5">{def.description}</div>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="text-xs px-1.5 py-0.5 rounded border border-border/60 text-muted-foreground/60 bg-muted/30">
                      {CATEGORY_LABELS[def.category]}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <button
                      onClick={() => handleRecordClick(def)}
                      className={cn(
                        "inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-mono border transition-colors",
                        isRecording
                          ? "border-primary bg-primary/10 text-primary animate-pulse"
                          : !key
                          ? "border-dashed border-muted-foreground/30 text-muted-foreground/40 hover:border-primary/50 hover:text-primary/60"
                          : "border-border text-muted-foreground hover:border-primary/50 hover:text-primary/60 bg-muted/30",
                      )}
                    >
                      {isRecording ? "Recording…" : key ? formatKeyDisplay(key) : "—"}
                    </button>
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <button
                      role="switch"
                      aria-checked={enabled}
                      onClick={() => keyboard.toggleShortcut(def.id, !enabled)}
                      className={cn(
                        "w-8 h-4 rounded-full transition-colors relative flex-shrink-0",
                        enabled ? "bg-primary" : "bg-muted-foreground/30",
                      )}
                    >
                      <span
                        className={cn(
                          "absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform",
                          enabled ? "translate-x-4" : "translate-x-0.5",
                        )}
                      />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run E2E tests — should pass**

```bash
pnpm e2e --grep "settings page"
```
Expected: PASS for the first two tests. The toggle test may need to clear localStorage between runs — if it's flaky, add `await page.evaluate(() => localStorage.clear())` at the start of that test.

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/app/(views)/settings/shortcuts/page.tsx \
        packages/web/e2e/keyboard-shortcuts.spec.ts
git commit -m "feat: /settings/shortcuts rebinding UI with recording mode and conflict detection"
```

---

## Task 9: Sidebar settings link

**Files:**
- Modify: `packages/web/src/components/layout/sidebar.tsx`

- [ ] **Step 1: Add Settings link to sidebar footer**

In `packages/web/src/components/layout/sidebar.tsx`, add `Settings` to the lucide import:
```tsx
import { Inbox, Sun, Calendar, Hourglass, BookOpen, ChevronRight, Trash2, Plus, Settings } from "lucide-react";
```

Find this block near the bottom of the file (the current `SidebarFooter`):
```tsx
      <SidebarFooter className="p-3">
        <ThemeToggle />
      </SidebarFooter>
```

Replace with:
```tsx
      <SidebarFooter className="p-3 flex flex-col gap-1">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <Link href="/settings/shortcuts">
                <Settings className="h-4 w-4" />
                <span>Keyboard Shortcuts</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <ThemeToggle />
      </SidebarFooter>
```

- [ ] **Step 2: Verify manually**

```bash
pnpm dev
```
Open the app, confirm "Keyboard Shortcuts" link appears in the sidebar footer, clicking it navigates to `/settings/shortcuts`.

- [ ] **Step 3: Run all keyboard shortcut E2E tests**

```bash
pnpm e2e packages/web/e2e/keyboard-shortcuts.spec.ts
```
Expected: All tests PASS.

- [ ] **Step 4: Commit**

```bash
git add packages/web/src/components/layout/sidebar.tsx
git commit -m "feat: keyboard shortcuts settings link in sidebar"
```

---

## Task 10: Final — run full E2E suite

- [ ] **Step 1: Run all tests to confirm no regressions**

```bash
pnpm e2e
```
Expected: All tests PASS (inbox tests + keyboard shortcut tests).

- [ ] **Step 2: Build check**

```bash
pnpm build
```
Expected: No TypeScript errors, successful build.

- [ ] **Step 3: If build errors — fix TypeScript issues**

Common issues:
- `useFocusedTask` used in `task-list.tsx` but `focusedTaskId` already destructured from it — check for double declaration
- `useRef` not in the React import in `task-list.tsx` — add it
- `TaskQuickAddHandle` import in `task-list.tsx` needs to match the named export from `task-quick-add.tsx`
