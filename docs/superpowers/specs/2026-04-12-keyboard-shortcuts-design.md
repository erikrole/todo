# Keyboard Shortcuts System — Design Spec

**Date:** 2026-04-12  
**Status:** Approved  

---

## Overview

A keyboard-first interaction layer for the todo web app, inspired by Things 3 shortcuts and the Raycast shortcut pattern. Covers global navigation, task navigation (j/k cursor), task actions, a full rebinding UI (`/settings/shortcuts`), and a `?` quick-reference overlay.

---

## Goals

- Power users can drive the entire app from the keyboard.
- Shortcuts mirror Things 3 where possible; browser-conflicting shortcuts (`⌘T`, `⌘N`) use bare keys (Gmail-style) instead.
- Every shortcut is individually rebindable and togglable, persisted to `localStorage`.
- The `?` overlay gives an instant in-app reference; `/settings/shortcuts` gives the full editor.

---

## Shortcut Map (defaults)

### Navigation
| Action | Default Key | Notes |
|---|---|---|
| Go to Today | `⌘1` | Things 3 parity |
| Go to Inbox | `⌘2` | |
| Go to Upcoming | `⌘3` | |
| Go to Someday | `⌘4` | |
| Go to Logbook | `⌘5` | |
| Open command palette | `⌘K` | Already exists |
| Toggle sidebar | `⌘/` | |

### Task Navigation (bare keys — no-op when focus is in a text field)
| Action | Default Key |
|---|---|
| Focus next task | `J` or `↓` |
| Focus previous task | `K` or `↑` |
| Expand / open focused task | `Enter` |
| Close / deselect | `Esc` |

### Task Actions (bare keys — no-op when `focusedTaskId` is null)
| Action | Default Key | Notes |
|---|---|---|
| New task | `N` | `⌘N` conflicts with new browser window |
| Complete focused task | `C` | |
| Delete focused task | `⌫` | With undo toast |
| Edit title of focused task | `E` | Focuses title input in expanded panel |
| Move focused → Today | `T` | `⌘T` conflicts with new tab |
| Move focused → Inbox | `I` | |
| Move focused → Someday | `S` | |

### App
| Action | Default Key |
|---|---|
| Show shortcuts reference | `?` |
| Undo | `⌘Z` |

---

## Architecture

### New files

```
src/lib/keyboard/shortcut-config.ts              — shortcut definitions (data only)
src/components/keyboard/keyboard-provider.tsx    — context provider + keydown listener
src/components/keyboard/shortcuts-overlay.tsx    — ? quick-reference modal
src/app/(views)/settings/shortcuts/page.tsx      — full rebinding editor page
```

### Modified files

```
src/components/layout/app-shell.tsx    — wrap with KeyboardProvider
src/components/layout/sidebar.tsx     — add Settings link
src/components/tasks/task-list.tsx    — register task list with provider, register task action handlers
src/components/tasks/task-item.tsx    — render focus ring when focused
```

### `shortcut-config.ts`

An array of static shortcut definitions. No executable code — pure data.

```ts
interface ShortcutDef {
  id: string;           // e.g. "navigate-today"
  defaultKey: string;   // e.g. "Meta+1"
  label: string;        // e.g. "Go to Today"
  category: "navigation" | "task-nav" | "task-actions" | "app";
  description?: string;
}
```

### `KeyboardProvider`

A React context provider that:

1. Loads `localStorage["todo-keyboard-shortcuts"]` on mount, merges with defaults from `shortcut-config.ts`.
2. Registers one `keydown` listener on `document`. Skips events when `e.target` is an `<input>`, `<textarea>`, or `[contenteditable]`.
3. Dispatches to handlers registered via `useShortcutAction(id, handler)`.
4. Holds `focusedTaskId: string | null` and `orderedTaskIds: string[]` in context.
5. Exposes `registerTaskList(ids: string[])` so `TaskList` can tell the provider the current page's ordered task IDs.
6. Exposes `setRecording(id)` / `clearRecording()` for the settings editor.

### `useShortcutAction(id, handler)`

A hook for components to register what happens when a shortcut fires. Uses `useEffect` to register/unregister on mount/unmount. Handler is always called with the latest closure via a ref to avoid stale state.

### Focused task state

- `focusedTaskId` lives in `KeyboardProvider` context.
- `J`/`K` advance/retreat through `orderedTaskIds`.
- Clicking a task in `TaskItem` also sets `focusedTaskId`.
- `focusedTaskId` resets to `null` on route change (`usePathname` effect in provider).
- `TaskItem` reads `focusedTaskId` from context and renders a `border-l-2 border-primary` ring when focused.

---

## Focused Task Behavior

- Focus is a lightweight cursor — indigo left-border on the task row.
- Focused ≠ expanded: `J`/`K` moves focus without opening the detail panel. `Enter` expands.
- `Esc` collapses the expanded panel first; if already collapsed, deselects focus.
- Task actions (`C`, `T`, `I`, `S`, `⌫`, `E`) are no-ops when `focusedTaskId` is `null`.
- On `E`: expands the task (if not already) and focuses the title `<input>` after the animation delay.
- Focus resets to `null` when navigating to a different view.

---

## Rebinding UI — `/settings/shortcuts`

A new page at `src/app/(views)/settings/shortcuts/page.tsx`, linked from the sidebar.

Layout: search input + "Reset all to defaults" button, then a table grouped by category with columns: **Name**, **Category**, **Shortcut**, **On**.

### Recording mode

1. User clicks a kbd chip → that shortcut enters recording mode (chip shows "Recording…" with pulsing border).
2. Next `keydown` event (excluding lone modifiers) becomes the new binding.
3. `Escape` cancels recording without saving.
4. **Conflict detection:** if the recorded key matches an existing shortcut, show an inline warning: *"Already used by [label] — save anyway?"* Confirming saves and clears the old binding.
5. Changes write immediately to `localStorage["todo-keyboard-shortcuts"]` and update the provider via context.

### Toggle

Each row has an on/off toggle. Disabled shortcuts remain in localStorage with `enabled: false` — their key is reserved but not fired.

---

## `?` Quick-Reference Overlay

A modal overlay triggered by the `?` shortcut (also accessible via "Edit shortcuts →" link in footer → `/settings/shortcuts`).

- Two-column layout: Navigate + Task Actions on left; Task Navigation + App on right.
- Read-only: shows current bindings (reflects any customizations).
- Footer: "Bare-key shortcuts fire when focus is not in a text field" + "Edit shortcuts →" link.
- Closed by pressing `Esc` or clicking the backdrop.

---

## localStorage Schema

```json
{
  "todo-keyboard-shortcuts": {
    "navigate-today":   { "key": "Meta+1", "enabled": true },
    "navigate-inbox":   { "key": "Meta+2", "enabled": true },
    "complete-task":    { "key": "c",      "enabled": true },
    "new-task":         { "key": "n",      "enabled": true }
  }
}
```

Only overrides are stored — missing keys fall back to `shortcut-config.ts` defaults.

---

## Browser Compatibility

- Arc (desktop, macOS): `Meta` = `⌘`. Bare keys work. `⌘K` is not intercepted by Arc.
- Safari (iOS): `Meta` = `⌘` on hardware keyboard. Bare keys work the same. No touch-specific shortcut handling needed — shortcuts are keyboard-only.
- `⌘T`, `⌘N`, `⌘W` are avoided as defaults. Users can remap to these if they accept the conflict.

---

## Out of Scope

- Touch / swipe gestures (separate concern)
- Shortcuts for project/area CRUD (can be added later via the same system)
- Syncing shortcut prefs across devices (localStorage only for now)
