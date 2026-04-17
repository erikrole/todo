# Routines Polish — Design Spec

**Date:** 2026-04-16  
**Status:** Approved  
**Scope:** Three isolated improvements to the Routines feature — split completion button, habit grid in history sheet, add-entry from history sheet.

---

## Overview

Three focused changes across two files. No new API routes, no schema changes, no shared state between changes. Parallelizable via subagents.

---

## Change 1 — Split completion button (`RoutineItem`)

**File:** `packages/web/src/components/routines/routine-item.tsx`

### Current behavior
A single `+` button appears on hover and always opens a calendar popover to log a past completion.

### New behavior
The `+` button is replaced by a two-part split button, visible on hover only:

| Part | Label | Action |
|------|-------|--------|
| Left | `✓ Today` | Immediately fires `POST /api/tasks/${task.id}/completions` with today's date (noon local time). No popover. Brief green flash on success. |
| Right | `›` | Opens the existing calendar popover for past date entry (unchanged). |

### Implementation notes
- Add a `todayMutation` using `useMutation` — same endpoint as `logMutation`, hardcoded date to `toLocalDateStr(new Date()) + "T12:00:00"`, notes `null`.
- On `todayMutation` success: invalidate `["task-completions", task.id]` and `["tasks"]`. Show a brief green ring flash on the status ring (CSS animation, ~600ms, then remove class).
- The existing `logMutation`, `Popover`, `Calendar`, `logDate`, `logNotes` state all stay — the chevron just triggers `setLogOpen(true)`.
- Split button visual: two halves joined with a shared border-radius container. Left half has checkmark icon + "Today" text. Right half has a small chevron-down icon. Both `opacity-0 group-hover:opacity-100`.

---

## Change 2 — Habit grid in history sheet (`CompletionHistorySheet`)

**File:** `packages/web/src/components/routines/completion-history-sheet.tsx`

### Current behavior
The chart section shows an interval bar chart (last 16 completions, bar height = interval in days).

### New behavior
Two stacked visualizations replace the single chart section:

**Habit grid (new, above bars):**
- 13 columns × 7 rows = 91 cells, each representing one calendar day.
- Oldest day = top-left, newest day (today) = bottom-right.
- Cell is lit (`bg-primary` with opacity scaled by completion count on that day) if completions exist, dark (`bg-muted/30`) if not.
- Computed client-side from the existing `completions` array — no new API call.
- Labeled `"Last 90 days"`.

**Interval bars (existing, below grid):**
- Unchanged in logic and color coding.
- Labeled `"Interval history"` (already is).

Both sections live inside the existing `border-b` wrapper, stacked vertically with a small divider between them.

### Implementation notes
- Build a `Set<string>` of completion date strings (`c.completedAt.slice(0, 10)`) from the `completions` array.
- Generate the 91-day array by walking back from today: `Array.from({ length: 91 }, (_, i) => subtractDays(today, 90 - i))`.
- Cell opacity: if date has a completion, use `opacity-80`; no completion = `opacity-20` on a muted background.
- No tooltip needed for MVP.

---

## Change 3 — Add entry from history sheet (`CompletionHistorySheet`)

**File:** `packages/web/src/components/routines/completion-history-sheet.tsx`

### Current behavior
No way to log a completion from within the history sheet. Must close sheet and use the list item's button.

### New behavior
A `+ Add entry` button appears in the `SheetHeader`, right-aligned next to the title. Clicking it reveals an inline form directly below the stats grid:

- Date picker (Calendar via Popover, defaults to today, `disabled={(d) => d > new Date()}`)
- Notes textarea (optional, same as existing)
- `Save` + `Cancel` buttons

On save: `POST /api/tasks/${task.id}/completions`, invalidates `["task-completions", task.id]` and `["tasks"]`. Form collapses on success or cancel.

### Implementation notes
- Add `addingEntry` boolean state + `entryDate` / `entryNotes` state (mirroring RoutineItem's `logDate`/`logNotes` pattern).
- Add `addMutation` using `useMutation` — same endpoint/payload as RoutineItem's `logMutation`.
- Inline form renders between the stats grid and the chart section when `addingEntry` is true.
- `task` prop is already non-null when the sheet is open (guarded by `enabled: !!task && open`).

---

## Subagent split

| Subagent | Files touched | Changes |
|----------|--------------|---------|
| A | `routine-item.tsx` | Split button (Change 1) |
| B | `completion-history-sheet.tsx` | Habit grid + Add entry (Changes 2 & 3) |

Both subagents can run in parallel — no shared files, no coordination needed.

---

## Out of scope

- No section headers / grouping changes (user chose flat list)
- No streaks
- No new API routes or schema changes
- No tooltip on habit grid cells (MVP)
