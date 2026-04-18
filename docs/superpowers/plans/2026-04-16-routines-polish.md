# Routines Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Three UX improvements to Routines — split completion button on list items, habit grid + interval bars in the history sheet, and an "Add entry" button inside the history sheet.

**Architecture:** Two independent file changes (one per subagent). `RoutineItem` gets the split button. `CompletionHistorySheet` gets the habit grid and add-entry form. No shared helpers — each change is fully self-contained within its file.

**Tech Stack:** Next.js App Router, React, TanStack Query (`useMutation`, `useQueryClient`), shadcn/ui (`Popover`, `Calendar`, `Button`, `Input`), Lucide icons, Playwright for E2E tests.

---

## Testing strategy note

This codebase has **Playwright E2E tests only** — no Vitest, no RTL, no component tests. TDD here means: write a failing E2E spec first for changes that cross the API boundary, run it to confirm it fails, implement, then rerun to confirm it passes. The habit grid (Task 2) is purely client-side rendering — asserting "91 cells exist" is noise; it has no E2E test.

---

## Subagent split

| Subagent | Task | File |
|----------|------|------|
| A | Task 1 | `packages/web/src/components/routines/routine-item.tsx` |
| B | Tasks 2 & 3 | `packages/web/src/components/routines/completion-history-sheet.tsx` |

These tasks share **no new helpers, types, or utilities**. Subagents must not create shared files — all new logic stays inside its respective component file.

---

## Task 1 — Split completion button (Subagent A)

**Files:**
- Modify: `packages/web/src/components/routines/routine-item.tsx`
- Test: `packages/web/e2e/routines-split-button.spec.ts` (create)

### Background

The current `+` hover button opens a `Popover` + `Calendar` for logging a past completion. Replace it with a two-part split button:

- **Left:** "✓ Today" — fires `POST /api/tasks/${task.id}/completions` immediately with today's date, no popover.
- **Right:** `›` chevron — opens the existing calendar popover (unchanged).

Feedback on "log today" success: the status ring repaintings (query invalidation triggers re-render with new data) is sufficient — no animation needed.

---

- [ ] **Step 1: Write the failing E2E test**

Create `packages/web/e2e/routines-split-button.spec.ts`:

```typescript
import { test, expect } from "@playwright/test";

test.describe("Routines — split completion button", () => {
  test("'Log today' button creates a completion without opening a popover", async ({ page }) => {
    await page.goto("/routines");
    await page.waitForLoadState("networkidle");

    // Grab the first routine item
    const firstItem = page.locator(".group.relative.cursor-pointer").first();
    await expect(firstItem).toBeVisible();

    // Hover to reveal the split button
    await firstItem.hover();

    // The "✓ Today" button should be visible (left half of split button)
    const todayBtn = firstItem.getByRole("button", { name: /today/i });
    await expect(todayBtn).toBeVisible();

    // Clicking it should NOT open a popover
    await todayBtn.click();
    const popover = page.locator("[data-radix-popper-content-wrapper]");
    await expect(popover).not.toBeVisible({ timeout: 500 });

    // The completion count in the meta row should increment (re-query)
    // We just verify no error state appears
    await expect(firstItem).toBeVisible();
  });

  test("chevron button opens date picker popover", async ({ page }) => {
    await page.goto("/routines");
    await page.waitForLoadState("networkidle");

    const firstItem = page.locator(".group.relative.cursor-pointer").first();
    await firstItem.hover();

    const chevronBtn = firstItem.getByRole("button", { name: /past date/i });
    await expect(chevronBtn).toBeVisible();
    await chevronBtn.click();

    // Calendar popover should appear
    const popover = page.locator("[data-radix-popper-content-wrapper]");
    await expect(popover).toBeVisible();
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails**

```bash
cd /Users/erole/GitHub/todo
pnpm e2e --grep "split completion button"
```

Expected: FAIL — "✓ Today" button not found.

- [ ] **Step 3: Implement the split button in `RoutineItem`**

Open `packages/web/src/components/routines/routine-item.tsx`.

**a) Add `ChevronDown` to the lucide import:**

```typescript
import { Plus, ChevronDown } from "lucide-react";
```

**b) Add `todayMutation` after the existing `logMutation`:**

```typescript
const todayMutation = useMutation({
  mutationFn: () =>
    api.post(`/api/tasks/${task.id}/completions`, {
      completedAt: today + "T12:00:00",
      notes: null,
    }),
  onSuccess: () => {
    qc.invalidateQueries({ queryKey: ["task-completions", task.id] });
    qc.invalidateQueries({ queryKey: ["tasks"] });
  },
});
```

**c) Replace the entire `{/* Log completion button */}` `<Popover>` block with:**

```tsx
{/* Split completion button */}
<div
  className="opacity-0 group-hover:opacity-100 transition-opacity flex shrink-0 rounded-lg overflow-hidden border border-primary/20"
  onClick={(e) => e.stopPropagation()}
>
  <button
    aria-label="Log today"
    className="flex items-center gap-1 px-2 py-1.5 text-xs font-semibold text-primary/80 hover:text-primary hover:bg-primary/10 transition-colors"
    onClick={() => todayMutation.mutate()}
    disabled={todayMutation.isPending}
  >
    <svg width="11" height="11" viewBox="0 0 14 14" fill="none">
      <path d="M2.5 7L5.5 10L11.5 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
    Today
  </button>
  <Popover open={logOpen} onOpenChange={setLogOpen}>
    <PopoverTrigger asChild>
      <button
        aria-label="Log past date"
        className="flex items-center px-1.5 py-1.5 text-primary/50 hover:text-primary hover:bg-primary/10 border-l border-primary/20 transition-colors"
        onClick={() => setLogOpen(true)}
      >
        <ChevronDown className="h-3 w-3" />
      </button>
    </PopoverTrigger>
    <PopoverContent
      className="w-auto p-0"
      align="end"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="p-3 border-b">
        <p className="text-xs font-semibold text-muted-foreground/70 uppercase tracking-wider">Log completion</p>
      </div>
      <Calendar
        mode="single"
        selected={logDate}
        onSelect={(d) => { if (d) setLogDate(d); }}
        disabled={(d) => d > new Date()}
        initialFocus
      />
      <div className="p-3 border-t flex flex-col gap-2">
        <Input
          className="h-8 text-xs"
          placeholder="Notes (optional)"
          value={logNotes}
          onChange={(e) => setLogNotes(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") logMutation.mutate(); }}
        />
        <Button
          size="sm"
          className="w-full h-8"
          onClick={() => logMutation.mutate()}
          disabled={logMutation.isPending}
        >
          Log {logDate.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
        </Button>
      </div>
    </PopoverContent>
  </Popover>
</div>
```

**d) Remove the now-unused `Plus` import** (replaced by inline SVG checkmark). Keep `ChevronDown`.

- [ ] **Step 4: Run the test to confirm it passes**

```bash
pnpm e2e --grep "split completion button"
```

Expected: PASS (both tests green).

- [ ] **Step 5: Commit and push**

```bash
git add packages/web/src/components/routines/routine-item.tsx \
        packages/web/e2e/routines-split-button.spec.ts
git commit -m "feat: split completion button on routine items — log today + past date"
git push origin main
```

---

## Task 2 — Habit grid in history sheet (Subagent B, part 1)

**Files:**
- Modify: `packages/web/src/components/routines/completion-history-sheet.tsx`

No E2E test — the habit grid is pure client-side rendering from existing API data. There is no practical way to assert cell states without seeding specific completion dates, which would require test fixtures not present in this codebase.

### Background

Replace the single chart section (interval bars only) with two stacked sections:
1. **Habit grid** (new) — 13 × 7 = 91 cells, one per calendar day, oldest top-left → newest bottom-right.
2. **Interval bars** (existing) — unchanged, just moved below the grid.

---

- [ ] **Step 1: Add the habit grid above the interval bars**

Open `packages/web/src/components/routines/completion-history-sheet.tsx`.

Find the existing interval bar chart section (starts with the `completions.length > 1 && avgDays !== null &&` conditional, around line 172). Replace the **entire block** with:

```tsx
{/* Habit grid + interval bars */}
{completions.length > 0 && (() => {
  const today = toLocalDateStr(new Date());
  const completionDates = new Set(completions.map((c) => c.completedAt.slice(0, 10)));

  // Build 91-day array oldest → newest
  const cells: string[] = Array.from({ length: 91 }, (_, i) => {
    const d = new Date(today + "T00:00:00");
    d.setDate(d.getDate() - (90 - i));
    return toLocalDateStr(d);
  });

  return (
    <>
      {/* Habit grid */}
      <div className="px-4 py-3 border-b flex flex-col gap-2">
        <span className="text-xs font-semibold text-muted-foreground/70 uppercase tracking-wider">Last 90 days</span>
        <div className="grid gap-[3px]" style={{ gridTemplateColumns: "repeat(13, 1fr)" }}>
          {cells.map((dateStr) => (
            <div
              key={dateStr}
              className={cn(
                "aspect-square rounded-sm",
                completionDates.has(dateStr) ? "bg-primary/70" : "bg-muted/30",
              )}
              title={dateStr}
            />
          ))}
        </div>
      </div>

      {/* Interval bars — existing, unchanged */}
      {completions.length > 1 && avgDays !== null && (
        <div className="px-4 py-3 border-b flex flex-col gap-2">
          <span className="text-xs font-semibold text-muted-foreground/70 uppercase tracking-wider">Interval history</span>
          <div className="flex items-end gap-1 h-14">
            {completions.slice(-16).map((c) => {
              const ratio = c.intervalActual !== null ? c.intervalActual / (avgDays * 1.5) : 0;
              const h = Math.max(Math.min(ratio * 100, 100), 8);
              const isLong = c.intervalActual !== null && c.intervalActual > avgDays * 1.2;
              const isShort = c.intervalActual !== null && c.intervalActual < avgDays * 0.8;
              return (
                <div
                  key={c.id}
                  className={cn(
                    "flex-1 rounded-sm min-w-[4px] transition-opacity hover:opacity-100 opacity-80",
                    isLong ? "bg-amber-500/70" : isShort ? "bg-emerald-500/70" : "bg-primary/50",
                  )}
                  style={{ height: `${h}%` }}
                  title={c.intervalActual !== null ? `${c.intervalActual}d` : "first"}
                />
              );
            })}
          </div>
        </div>
      )}
    </>
  );
})()}
```

- [ ] **Step 2: Verify it renders correctly**

```bash
pnpm dev
```

Navigate to `/routines`, click any routine item to open the history sheet. Confirm:
- A 13×7 grid of small squares appears above the bar chart labeled "Last 90 days"
- Lit squares (blue) correspond to days that have completions
- The existing interval bars still appear below labeled "Interval history"
- No console errors

- [ ] **Step 3: Commit (don't push yet — Task 3 completes this file)**

```bash
git add packages/web/src/components/routines/completion-history-sheet.tsx
git commit -m "feat: habit grid (90 days) in routine history sheet"
```

---

## Task 3 — Add entry from history sheet (Subagent B, part 2)

**Files:**
- Modify: `packages/web/src/components/routines/completion-history-sheet.tsx`
- Test: `packages/web/e2e/routines-add-entry.spec.ts` (create)

---

- [ ] **Step 1: Write the failing E2E test**

Create `packages/web/e2e/routines-add-entry.spec.ts`:

```typescript
import { test, expect } from "@playwright/test";

test.describe("Routines — add entry from history sheet", () => {
  test("'Add entry' button in history sheet logs a completion", async ({ page }) => {
    await page.goto("/routines");
    await page.waitForLoadState("networkidle");

    // Open history sheet by clicking the first routine
    const firstItem = page.locator(".group.relative.cursor-pointer").first();
    await firstItem.click();

    // Sheet should be open
    const sheet = page.locator("[role=dialog]");
    await expect(sheet).toBeVisible();

    // Add entry button in the header
    const addBtn = sheet.getByRole("button", { name: /add entry/i });
    await expect(addBtn).toBeVisible();
    await addBtn.click();

    // Inline form should appear
    const saveBtn = sheet.getByRole("button", { name: /save/i });
    await expect(saveBtn).toBeVisible();

    // Submit with today's date (default)
    await saveBtn.click();

    // Form should collapse
    await expect(saveBtn).not.toBeVisible({ timeout: 2000 });
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails**

```bash
pnpm e2e --grep "add entry from history sheet"
```

Expected: FAIL — "Add entry" button not found.

- [ ] **Step 3: Add state and mutation to `CompletionHistorySheet`**

Open `packages/web/src/components/routines/completion-history-sheet.tsx`.

**a) Add imports** — `Input` and `Textarea` are already imported. Add `CalendarIcon` if not present. Also ensure `useState` is imported (it is).

**b) Add state and mutation** inside the `CompletionHistorySheet` function, after the existing `useQuery`:

```typescript
const [addingEntry, setAddingEntry] = useState(false);
const [entryDate, setEntryDate] = useState<Date>(() => new Date());
const [entryNotes, setEntryNotes] = useState("");
const [entryCalOpen, setEntryCalOpen] = useState(false);

const addMutation = useMutation({
  mutationFn: () =>
    api.post(`/api/tasks/${task!.id}/completions`, {
      completedAt: toLocalDateStr(entryDate) + "T12:00:00",
      notes: entryNotes.trim() || null,
    }),
  onSuccess: () => {
    qc.invalidateQueries({ queryKey: ["task-completions", task?.id] });
    qc.invalidateQueries({ queryKey: ["tasks"] });
    setAddingEntry(false);
    setEntryNotes("");
    setEntryDate(new Date());
  },
});
```

- [ ] **Step 4: Add the "Add entry" button to the sheet header**

Find the `<SheetHeader>` block and update it:

```tsx
<SheetHeader className="pb-4 border-b">
  <div className="flex items-start justify-between gap-2">
    <SheetTitle className="text-xl font-bold leading-tight">{task?.title ?? ""}</SheetTitle>
    <Button
      variant="ghost"
      size="sm"
      className="h-7 px-2 text-xs shrink-0 mt-0.5"
      onClick={() => {
        setAddingEntry((v) => !v);
        setEntryDate(new Date());
        setEntryNotes("");
      }}
    >
      + Add entry
    </Button>
  </div>
  <SheetDescription className="sr-only">Completion history</SheetDescription>
</SheetHeader>
```

- [ ] **Step 5: Add the inline entry form below the stats grid**

Find the stats grid block (the `{stats && stats.count > 0 && (...)}` section). Directly after it, insert:

```tsx
{/* Inline add entry form */}
{addingEntry && (
  <div className="px-4 py-3 border-b flex flex-col gap-2">
    <span className="text-xs font-semibold text-muted-foreground/70 uppercase tracking-wider">New entry</span>
    <Popover open={entryCalOpen} onOpenChange={setEntryCalOpen}>
      <PopoverTrigger asChild>
        <button className="flex items-center gap-1.5 text-xs text-left hover:text-foreground transition-colors">
          <CalendarIcon className="h-3 w-3 text-muted-foreground" />
          <span>{entryDate.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={entryDate}
          onSelect={(d) => { if (d) { setEntryDate(d); setEntryCalOpen(false); } }}
          disabled={(d) => d > new Date()}
          initialFocus
        />
      </PopoverContent>
    </Popover>
    <Textarea
      className="text-xs resize-none h-14"
      placeholder="Notes (optional)"
      value={entryNotes}
      onChange={(e) => setEntryNotes(e.target.value)}
    />
    <div className="flex items-center justify-end gap-2">
      <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => setAddingEntry(false)}>
        Cancel
      </Button>
      <Button size="sm" className="h-6 px-2 text-xs" onClick={() => addMutation.mutate()} disabled={addMutation.isPending}>
        Save
      </Button>
    </div>
  </div>
)}
```

- [ ] **Step 6: Run the test to confirm it passes**

```bash
pnpm e2e --grep "add entry from history sheet"
```

Expected: PASS.

- [ ] **Step 7: Smoke test in browser**

```bash
pnpm dev
```

Navigate to `/routines`, click a routine. Confirm:
- "+ Add entry" button visible in sheet header
- Clicking it reveals the inline form with date picker, notes, Save/Cancel
- Saving with today's date adds an entry (timeline updates, count increments)
- Cancelling collapses the form without changes

- [ ] **Step 8: Commit and push**

```bash
git add packages/web/src/components/routines/completion-history-sheet.tsx \
        packages/web/e2e/routines-add-entry.spec.ts
git commit -m "feat: add-entry button in routine history sheet"
git push origin main
```
