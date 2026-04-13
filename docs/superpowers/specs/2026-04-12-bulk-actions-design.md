# v1.4 — Bulk Actions Design

**Date:** 2026-04-12
**Goal:** Select multiple tasks and act on them all at once — complete, reschedule, move, cancel, someday, or delete.

---

## Selection Model

**Trigger:** Modifier+click a task row to enter selection mode with that task selected. Modifier+click additional tasks to add or remove them. Modifier+A selects all visible tasks. Escape exits selection mode (deselects all).

**Modifier key:** Configurable via the keyboard shortcuts settings page (`/settings/shortcuts`). Default: `meta` on Mac (detected via `navigator.platform.includes("Mac")`), `ctrl` elsewhere. Stored in the existing shortcut config in localStorage under the key `select-modifier`. Valid values: `meta`, `ctrl`, `alt`.

**Visual state:** While selection mode is active (one or more tasks selected), each task's circular completion checkbox swaps to a square checkbox. Selected rows are highlighted. Non-selected rows show an unselected square checkbox.

**Click behavior in selection mode:**
- Modifier+click a non-selected task → adds to selection
- Modifier+click a selected task → removes from selection
- Modifier+A → selects all visible tasks in the current view
- Escape → clears selection, exits selection mode
- Route change → clears selection

---

## Action Bar

A floating bar that appears at the bottom of the viewport whenever `selectedIds.size > 0`. Disappears when selection is cleared.

**Bar contents (left to right):**
- Count label: "N tasks"
- Complete button
- Reschedule button (opens popover)
- Move to project button (opens popover)
- Cancel button
- Someday button
- Delete button

### Actions

| Action | API calls | Optimistic update | Toast |
|--------|-----------|-------------------|-------|
| **Complete** | `POST /api/tasks/:id/complete` × N | Remove from current view (or mark completed in today_all) | "N tasks completed" + Undo |
| **Reschedule** | `PATCH /api/tasks/:id` × N | Update `whenDate` in cache | None (easily reversible) |
| **Move to project** | `PATCH /api/tasks/:id` × N | Update `projectId` in cache | None |
| **Cancel** | `PATCH /api/tasks/:id` × N | Set `isCancelled: true` in cache | "N tasks cancelled" + Undo |
| **Someday** | `PATCH /api/tasks/:id` × N | Set `isSomeday: true`, clear `whenDate` | None |
| **Delete** | `DELETE /api/tasks/:id` × N | Remove from current view | "N tasks deleted" + Undo |

All mutations fire in parallel (`Promise.all`), then invalidate `["tasks"]`. Confirmation dialog only for Delete with 10+ tasks selected.

**Reschedule popover options:** Today · Tomorrow · Next Week · Pick date (Calendar). Anchored to the Reschedule button.

**Move to project popover:** Scrollable list of all projects (same data as existing context menu). Anchored to the Move button.

---

## Architecture

### New files

| File | Responsibility |
|------|----------------|
| `src/hooks/use-selection.ts` | `useSelection()` hook — `selectedIds: Set<string>`, `toggle(id)`, `selectAll(ids)`, `clear()`, `isActive` computed from set size |
| `src/components/tasks/bulk-action-bar.tsx` | Floating bar; renders when `isActive`; all 6 action buttons + count; mounts Reschedule and Move popovers |
| `src/components/tasks/reschedule-popover.tsx` | Today/Tomorrow/Next Week/Custom date picker; reuses existing `Popover` + `Calendar` components |

### Modified files

| File | Change |
|------|--------|
| `src/components/tasks/task-item.tsx` | Detect modifier+click on row; swap circle → square checkbox when `isActive`; apply selected highlight style |
| `src/lib/keyboard/shortcut-config.ts` | Add `select-modifier` entry (default: `meta`/`ctrl` by platform); appears in settings page |
| `src/app/(views)/layout.tsx` | Mount `<BulkActionBar />` once so it floats over all views |

### State

`useSelection` is a plain React context (no Zustand needed — selection is view-local and clears on navigation). Provider mounted in `(views)/layout.tsx` alongside `BulkActionBar`.

---

## Views

Bulk actions work in all task list views: Inbox, Today, Upcoming, Someday, Logbook, Trash, Project, Area. The floating bar renders over whichever view is active.

---

## Testing

E2E tests in `packages/web/e2e/bulk-actions.spec.ts`:
- ⌘-click selects a task; second ⌘-click deselects it
- ⌘+A selects all tasks in the view
- Escape clears selection
- Completing 2 selected tasks removes them from the view
- Deleting 2 selected tasks removes them from the view
- Rescheduling 2 selected tasks updates their when_date
