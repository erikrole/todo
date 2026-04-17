# Inbox Polish — Design Spec

**Date:** 2026-04-16
**Status:** Approved
**Scope:** Four isolated improvements to the Inbox page — dispatch controls, empty state, task count header, client-side sort.

---

## Overview

Four focused changes to `packages/web/src/app/(views)/inbox/page.tsx` plus one new component. No new API routes, no schema changes. The Inbox is a capture bucket — these changes make dispatching tasks out of it faster and the page feel more finished.

---

## Change 1 — Dispatch controls (hover, per task row)

**Files:** `packages/web/src/app/(views)/inbox/page.tsx`, new `packages/web/src/components/inbox/dispatch-controls.tsx`

### Current behavior
No hover controls on task rows. Dispatching requires expanding the task panel to set a date or project.

### New behavior
Each task row shows three pill buttons on hover (`opacity-0 group-hover:opacity-100`), right-aligned:

| Button | Action |
|--------|--------|
| **Today** | `PATCH /api/tasks/${id}` with `{ whenDate: todayStr() }` — task immediately leaves inbox |
| **Tomorrow** | `PATCH /api/tasks/${id}` with `{ whenDate: tomorrowStr() }` |
| **···** | Opens a Popover with two sections (see below) |

**··· overflow popover contents:**

*Schedule section:*
- **This weekend** — sets `whenDate` to the coming Saturday (`nextSaturdayStr()`)
- **Pick a date…** — inline Calendar (same pattern as existing log-completion calendar), `disabled={(d) => d < new Date()}`, on select sets `whenDate`

*Move to section:*
- Lists all non-completed projects from `useProjects()` — clicking sets `projectId` on the task
- Projects rendered as a scrollable list (max-height ~200px) if there are many

On any dispatch: call `useUpdateTask`, then invalidate `["tasks"]` — the task vanishes from the inbox list optimistically.

### Implementation notes
- Create `InboxDispatchControls` component accepting `taskId: string`. It owns its own `useUpdateTask` call and the `···` popover open/close state.
- `nextSaturdayStr()`: walk forward from today until `getDay() === 6`.
- Wrap each `TaskItem` in the inbox with a `<div className="group relative">` and render `<InboxDispatchControls>` absolutely positioned (right-0, centered vertically) — it only needs to float over the row, not affect layout.
- `todayStr()` and `tomorrowStr()` already exist in `task-item.tsx` — import from `@/lib/dates` or move there if not already.

---

## Change 2 — Empty state

**File:** `packages/web/src/app/(views)/inbox/page.tsx`

### Current behavior
When inbox is empty, `TaskList` renders its generic `emptyMessage` prop string.

### New behavior
When `tasks.length === 0 && !isLoading`, render a centered empty state instead of `TaskList`:

```
   ✓
Inbox zero
Everything's been dispatched.
```

- Checkmark icon (`Check` from lucide-react, `h-8 w-8`)
- Title: `"Inbox zero"` — `text-sm font-medium`
- Subtitle: `"Everything's been dispatched."` — `text-xs`
- All elements at reduced opacity (`opacity-40`) — intentionally quiet

---

## Change 3 — Task count in header

**File:** `packages/web/src/app/(views)/inbox/page.tsx`

### Current behavior
Header is just `<h1>Inbox</h1>`.

### New behavior
When `tasks.length > 0`, render a subtitle below the title:

```
Inbox
5 items to process
```

- Subtitle: `"{tasks.length} {tasks.length === 1 ? 'item' : 'items'} to process"` — `text-sm text-muted-foreground/70 mt-0.5`
- Hidden when inbox is empty (the empty state speaks for itself)
- Mirrors the date subtitle pattern on the Today page

---

## Change 4 — Client-side sort

**File:** `packages/web/src/app/(views)/inbox/page.tsx`

### Current behavior
Tasks render in API-returned order (position / created_at).

### New behavior
A sort control in the header (right-aligned, same row as the `h1` block) lets the user reorder:

| Option | Behaviour |
|--------|-----------|
| **Date added** (default) | Original API order — no re-sort |
| **Title A → Z** | `tasks.slice().sort((a, b) => a.title.localeCompare(b.title))` |
| **Deadline** | Tasks with a deadline sorted ascending; tasks without deadline at the end |

- Rendered as a small ghost button: `"Sort: Date added ▾"` — opens a `DropdownMenu` (shadcn) with the three options
- Sort preference lives in `useState`; not persisted (resets on navigation)
- Sorted array passed to `TaskList` in place of the raw `tasks` array

---

## Change 5 — Task age badge

**Files:** `packages/web/src/lib/dates.ts`, `packages/web/src/app/(views)/inbox/page.tsx`

### Current behavior
No indication of how long a task has been sitting in inbox.

### New behavior
Each task row shows a subtle age label (e.g. `3d`, `2w`, `1mo`) right-aligned between the title and the dispatch controls. It is visible by default and fades out on hover as the dispatch pills fade in — they swap in the same slot.

| Age | Label |
|-----|-------|
| Same day | `today` |
| 1 day | `1d` |
| 2–6 days | `Nd` |
| 1–4 weeks | `Nw` |
| 1+ months | `Nmo` |

### Implementation notes
- Add `taskAge(createdAt: string): string` helper to `@/lib/dates.ts`.
- Render `<span className="... opacity-100 group-hover:opacity-0 transition-opacity">` in the `group relative` wrapper, right-aligned.
- Dispatch controls already use `opacity-0 group-hover:opacity-100` — they swap cleanly.

---

## Subagent split

| Subagent | Files touched | Changes |
|----------|--------------|---------|
| A | `inbox/page.tsx` | Count header (3) + Sort (4) + Empty state (2) — all page-level, no new components |
| B | `inbox/page.tsx`, new `components/inbox/dispatch-controls.tsx` | Dispatch controls (1) |

Subagents can run in parallel — no shared state between the two sets of changes.

---

## Out of scope

- No bulk dispatch (select multiple → dispatch all)
- No server-side sort (client sort is sufficient for a capture bucket)
- No persistence of sort preference
- No animations on task dispatch (the task vanishes instantly via query invalidation)
