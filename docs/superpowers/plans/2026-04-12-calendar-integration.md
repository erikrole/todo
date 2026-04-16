# Calendar Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Two related features — (1) seasonal recurrence windows so tasks like "Mow lawn" only spawn during active months, and (2) iCal feed sync so external calendars (municipal garbage/recycling schedules) auto-create tasks without manual entry.

**Architecture:** Seasonal recurrence adds a `recurrence_active_months` JSON column to tasks; the existing `complete` route's spawn logic calls a new `advanceToActiveMonth()` helper to skip inactive months. iCal sync introduces a `calendar_sources` table (feed URL + target project/area) and a `syncCalendarSource()` utility that fetches a feed with `node-ical`, deduplicates by iCal UID, and inserts tasks. A Vercel Cron job at 6 AM UTC hits `/api/cron/calendar-sync` to sync all sources daily. A settings sheet (Sheet component in the sidebar footer) lets the user manage their feeds.

**Tech Stack:** Drizzle ORM (sqlite-core), `node-ical` + `@types/node-ical`, TanStack Query v5, shadcn/ui (Sheet, Button, Input, Label), Tailwind CSS v4, TypeScript strict, Vercel Cron

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `packages/db/src/schema.ts` | Modify | Add `calendarSources` table; add `recurrenceActiveMonths`, `calendarSourceId`, `recurrenceSourceUid` to tasks |
| `packages/db/drizzle/` | Generate | New migration via `pnpm db:generate` + `pnpm db:migrate` |
| `packages/shared/src/types.ts` | Modify | Add `CalendarSource` interface; add 3 new fields to `Task` |
| `packages/shared/src/schemas.ts` | Modify | Add `CreateCalendarSourceSchema`; add new optional task fields to Create/Update schemas |
| `packages/web/src/lib/api.ts` | Modify | Add `advanceToActiveMonth()` helper |
| `packages/web/src/app/api/tasks/[id]/complete/route.ts` | Modify | Call `advanceToActiveMonth` when spawning next recurrence; carry `recurrenceActiveMonths` forward |
| `packages/web/src/lib/ical-sync.ts` | Create | `syncCalendarSource(id)` — fetch + parse iCal feed, upsert tasks, update `lastSyncedAt` |
| `packages/web/src/app/api/calendar-sources/route.ts` | Create | GET list all sources, POST create source |
| `packages/web/src/app/api/calendar-sources/[id]/route.ts` | Create | DELETE source |
| `packages/web/src/app/api/calendar-sources/[id]/sync/route.ts` | Create | POST trigger sync for one source |
| `packages/web/src/app/api/cron/calendar-sync/route.ts` | Create | POST sync all sources (Vercel Cron, protected by CRON_SECRET) |
| `vercel.json` | Modify | Add `"crons"` entry pointing to calendar-sync |
| `packages/web/src/hooks/use-calendar-sources.ts` | Create | TanStack Query hooks: `useCalendarSources`, `useCreateCalendarSource`, `useDeleteCalendarSource`, `useSyncCalendarSource` |
| `packages/web/src/components/settings/calendar-sources-sheet.tsx` | Create | Sheet UI: list sources with delete, add-source form (name + URL + project picker) |
| `packages/web/src/components/layout/sidebar.tsx` | Modify | Add calendar/settings icon button in `SidebarFooter` to open the sheet |

---

## Task 1: Install dependency

**Files:**
- Run: `pnpm add node-ical` and `pnpm add -D @types/node-ical` in `packages/web`

- [ ] **Step 1: Install node-ical**

  ```bash
  cd packages/web && pnpm add node-ical && pnpm add -D @types/node-ical
  ```

  Expected: `node_modules/node-ical` exists in `packages/web`.

- [ ] **Step 2: Verify TypeScript picks up types**

  ```bash
  cd packages/web && npx tsc --noEmit 2>&1 | grep node-ical || echo "OK — no type errors for node-ical"
  ```

---

## Task 2: Schema — calendar_sources table + new task columns

**Files:**
- Modify: `packages/db/src/schema.ts`
- Generate: `packages/db/drizzle/`

- [ ] **Step 1: Add `calendarSources` table to schema.ts**

  In `packages/db/src/schema.ts`, add this block **between the `sections` and `tasks` table definitions**:

  ```typescript
  // ─── Calendar Sources ─────────────────────────────────────────────────────────

  export const calendarSources = sqliteTable(
    "calendar_sources",
    {
      id: text("id").primaryKey(),
      name: text("name").notNull(),
      url: text("url").notNull(),
      /** Tasks created from this feed go into this project (optional). */
      projectId: text("project_id").references(() => projects.id, { onDelete: "set null" }),
      /** Or this area, if no project. */
      areaId: text("area_id").references(() => areas.id, { onDelete: "set null" }),
      lastSyncedAt: text("last_synced_at"),
      createdAt: text("created_at").notNull(),
      updatedAt: text("updated_at").notNull(),
    },
    (t) => [
      index("idx_calendar_sources_project_id").on(t.projectId),
      index("idx_calendar_sources_area_id").on(t.areaId),
    ],
  );
  ```

- [ ] **Step 2: Add three new columns to the tasks table**

  In `packages/db/src/schema.ts`, inside the `tasks` sqliteTable definition, add these three lines after `recurrenceEndsAt`:

  ```typescript
  recurrenceEndsAt: text("recurrence_ends_at"),
  /** JSON array of active month numbers (1–12). Null = active all year. e.g. "[4,5,6,7,8,9,10,11]" */
  recurrenceActiveMonths: text("recurrence_active_months"),
  /** FK to calendar_sources.id — set when task was created by an iCal sync. */
  calendarSourceId: text("calendar_source_id").references(() => calendarSources.id, { onDelete: "set null" }),
  /** iCal event UID. Used to deduplicate during sync. */
  recurrenceSourceUid: text("recurrence_source_uid"),
  position: real("position").default(0).notNull(),
  ```

  Also add an index for `calendarSourceId` in the tasks index array:

  ```typescript
  index("idx_tasks_calendar_source_id").on(t.calendarSourceId),
  ```

- [ ] **Step 3: Add inferred types for calendarSources**

  At the bottom of `packages/db/src/schema.ts`, add:

  ```typescript
  export type CalendarSource = typeof calendarSources.$inferSelect;
  export type NewCalendarSource = typeof calendarSources.$inferInsert;
  ```

- [ ] **Step 4: Generate migration**

  ```bash
  pnpm db:generate
  ```

  Expected: a new SQL file in `packages/db/drizzle/` containing:
  ```sql
  CREATE TABLE `calendar_sources` (...);
  ALTER TABLE `tasks` ADD `recurrence_active_months` text;
  ALTER TABLE `tasks` ADD `calendar_source_id` text REFERENCES calendar_sources(id);
  ALTER TABLE `tasks` ADD `recurrence_source_uid` text;
  ```

- [ ] **Step 5: Apply migration**

  ```bash
  pnpm db:migrate
  ```

  Expected: "Migrations applied" with no errors.

- [ ] **Step 6: Commit**

  ```bash
  git add packages/db/src/schema.ts packages/db/drizzle/
  git commit -m "feat: add calendar_sources table and task iCal/seasonal-recurrence columns"
  ```

---

## Task 3: Shared types and Zod schemas

**Files:**
- Modify: `packages/shared/src/types.ts`
- Modify: `packages/shared/src/schemas.ts`

- [ ] **Step 1: Add CalendarSource interface to types.ts**

  After the `Section` interface in `packages/shared/src/types.ts`, add:

  ```typescript
  // ─── Calendar Sources ─────────────────────────────────────────────────────────

  export interface CalendarSource {
    id: string;
    name: string;
    url: string;
    projectId: string | null;
    areaId: string | null;
    lastSyncedAt: string | null;
    createdAt: string;
    updatedAt: string;
  }
  ```

- [ ] **Step 2: Add three new fields to the Task interface**

  In the `Task` interface in `packages/shared/src/types.ts`, add after `recurrenceEndsAt`:

  ```typescript
  /** Active months for recurrence (1–12). Null = every month. */
  recurrenceActiveMonths: number[] | null;
  /** ID of the calendar_sources row that created this task via iCal sync. */
  calendarSourceId: string | null;
  /** iCal event UID, used for dedup during sync. */
  recurrenceSourceUid: string | null;
  ```

- [ ] **Step 3: Add CalendarSource Zod schemas**

  In `packages/shared/src/schemas.ts`, add before the `// ─── Exports` section:

  ```typescript
  // ─── Calendar Sources ─────────────────────────────────────────────────────────

  export const CreateCalendarSourceSchema = z.object({
    name: z.string().min(1),
    url: z.string().url(),
    projectId: z.string().optional(),
    areaId: z.string().optional(),
  });

  export const UpdateCalendarSourceSchema = z.object({
    name: z.string().min(1).optional(),
    url: z.string().url().optional(),
    projectId: z.string().nullable().optional(),
    areaId: z.string().nullable().optional(),
  });
  ```

- [ ] **Step 4: Add type exports at the bottom of schemas.ts**

  ```typescript
  export type CreateCalendarSourceInput = z.infer<typeof CreateCalendarSourceSchema>;
  export type UpdateCalendarSourceInput = z.infer<typeof UpdateCalendarSourceSchema>;
  ```

- [ ] **Step 5: Verify TypeScript compiles**

  ```bash
  cd packages/shared && npx tsc --noEmit
  ```

  Expected: no errors.

- [ ] **Step 6: Commit**

  ```bash
  git add packages/shared/src/types.ts packages/shared/src/schemas.ts
  git commit -m "feat: CalendarSource types + schema; Task recurrenceActiveMonths/calendarSourceId/recurrenceSourceUid"
  ```

---

## Task 4: Seasonal recurrence — advanceToActiveMonth helper

**Files:**
- Modify: `packages/web/src/lib/api.ts`
- Modify: `packages/web/src/app/api/tasks/[id]/complete/route.ts`

- [ ] **Step 1: Add advanceToActiveMonth to api.ts**

  In `packages/web/src/lib/api.ts`, add after `nextRecurrenceDate`:

  ```typescript
  /**
   * If dateStr's month is not in activeMonths (1-indexed, Jan=1), advances to the
   * first day of the next active month. Returns dateStr unchanged if month is active.
   * Example: advanceToActiveMonth("2026-12-07", [4,5,6,7,8,9,10,11]) → "2027-04-01"
   */
  export function advanceToActiveMonth(dateStr: string, activeMonths: number[]): string {
    const sorted = [...activeMonths].sort((a, b) => a - b);
    const d = new Date(dateStr + "T00:00:00");
    const month = d.getMonth() + 1; // 1-indexed
    if (sorted.includes(month)) return dateStr;
    let targetMonth = sorted.find((m) => m > month);
    let targetYear = d.getFullYear();
    if (!targetMonth) {
      targetMonth = sorted[0]!;
      targetYear += 1;
    }
    return new Date(targetYear, targetMonth - 1, 1).toISOString().slice(0, 10);
  }
  ```

- [ ] **Step 2: Update the complete route to apply seasonal recurrence and carry new fields**

  Replace the current spawn block in `packages/web/src/app/api/tasks/[id]/complete/route.ts` with:

  ```typescript
  import { db, tasks } from "@todo/db";
  import { and, eq, isNull } from "drizzle-orm";
  import { advanceToActiveMonth, err, nextRecurrenceDate, nowIso, ok, todayStr } from "@/lib/api";

  export async function POST(
    _req: Request,
    { params }: { params: Promise<{ id: string }> },
  ) {
    const { id } = await params;
    const now = nowIso();
    const today = todayStr();

    const [original] = await db.select().from(tasks).where(and(eq(tasks.id, id), isNull(tasks.deletedAt)));
    if (!original) return err("Not found", 404);

    const [completed] = await db
      .update(tasks)
      .set({ isCompleted: true, completedAt: now, updatedAt: now })
      .where(eq(tasks.id, id))
      .returning();

    // Spawn next recurrence instance
    if (original.recurrenceType && original.recurrenceInterval) {
      const endsAt = original.recurrenceEndsAt;
      if (!endsAt || today <= endsAt) {
        const baseDate =
          original.recurrenceMode === "after_completion"
            ? today
            : (original.whenDate ?? today);
        let nextWhenDate = nextRecurrenceDate(baseDate, original.recurrenceType, original.recurrenceInterval);

        // Apply seasonal window if configured
        if (original.recurrenceActiveMonths) {
          const activeMonths = JSON.parse(original.recurrenceActiveMonths) as number[];
          if (activeMonths.length > 0) {
            nextWhenDate = advanceToActiveMonth(nextWhenDate, activeMonths);
          }
        }

        if (!endsAt || nextWhenDate <= endsAt) {
          const { nanoid } = await import("nanoid");
          await db.insert(tasks).values({
            id: nanoid(),
            title: original.title,
            notes: original.notes,
            whenDate: nextWhenDate,
            timeOfDay: original.timeOfDay,
            scheduledTime: original.scheduledTime,
            deadline: original.deadline,
            projectId: original.projectId,
            areaId: original.areaId,
            recurrenceType: original.recurrenceType,
            recurrenceMode: original.recurrenceMode,
            recurrenceInterval: original.recurrenceInterval,
            recurrenceEndsAt: original.recurrenceEndsAt,
            recurrenceActiveMonths: original.recurrenceActiveMonths,
            // iCal-sourced fields are NOT carried forward — manual recurrences only
            position: original.position,
            createdAt: now,
            updatedAt: now,
          });
        }
      }
    }

    return ok(completed);
  }
  ```

- [ ] **Step 3: Verify TypeScript**

  ```bash
  cd packages/web && npx tsc --noEmit
  ```

  Expected: no errors.

- [ ] **Step 4: Commit**

  ```bash
  git add packages/web/src/lib/api.ts packages/web/src/app/api/tasks/[id]/complete/route.ts
  git commit -m "feat: seasonal recurrence — advanceToActiveMonth, carry active months on spawn"
  ```

---

## Task 5: iCal sync utility

**Files:**
- Create: `packages/web/src/lib/ical-sync.ts`

- [ ] **Step 1: Create the sync utility**

  Create `packages/web/src/lib/ical-sync.ts`:

  ```typescript
  import ical from "node-ical";
  import { db, tasks, calendarSources } from "@todo/db";
  import { and, eq } from "drizzle-orm";
  import { nanoid } from "nanoid";
  import { nowIso } from "./api";

  export interface SyncResult {
    created: number;
    skipped: number;
  }

  /**
   * Fetches the iCal feed for the given calendar source, creates tasks for new
   * events, and updates lastSyncedAt. Idempotent: existing events (matched by UID)
   * are skipped.
   */
  export async function syncCalendarSource(sourceId: string): Promise<SyncResult> {
    const [source] = await db.select().from(calendarSources).where(eq(calendarSources.id, sourceId));
    if (!source) throw new Error(`Calendar source not found: ${sourceId}`);

    const raw = await ical.fromURL(source.url);
    const now = nowIso();
    let created = 0;
    let skipped = 0;

    for (const event of Object.values(raw)) {
      if (event.type !== "VEVENT") continue;
      const uid = event.uid;
      if (!uid) continue;

      // Skip events with no start date
      if (!event.start) continue;

      // Deduplicate by calendarSourceId + uid
      const [existing] = await db
        .select({ id: tasks.id })
        .from(tasks)
        .where(and(eq(tasks.calendarSourceId, sourceId), eq(tasks.recurrenceSourceUid, uid)));

      if (existing) {
        skipped++;
        continue;
      }

      // Convert Date → YYYY-MM-DD (use UTC date to avoid TZ shift on all-day events)
      const start = event.start instanceof Date ? event.start : new Date(event.start);
      const whenDate = start.toISOString().slice(0, 10);

      await db.insert(tasks).values({
        id: nanoid(),
        title: event.summary?.trim() || "Untitled event",
        notes: typeof event.description === "string" ? event.description.trim() || null : null,
        whenDate,
        projectId: source.projectId,
        areaId: source.areaId,
        calendarSourceId: sourceId,
        recurrenceSourceUid: uid,
        position: 0,
        createdAt: now,
        updatedAt: now,
      });
      created++;
    }

    await db
      .update(calendarSources)
      .set({ lastSyncedAt: now, updatedAt: now })
      .where(eq(calendarSources.id, sourceId));

    return { created, skipped };
  }
  ```

- [ ] **Step 2: Verify TypeScript**

  ```bash
  cd packages/web && npx tsc --noEmit
  ```

  Expected: no errors.

- [ ] **Step 3: Commit**

  ```bash
  git add packages/web/src/lib/ical-sync.ts
  git commit -m "feat: iCal sync utility — fetch feed, upsert tasks, dedup by UID"
  ```

---

## Task 6: Calendar sources CRUD API

**Files:**
- Create: `packages/web/src/app/api/calendar-sources/route.ts`
- Create: `packages/web/src/app/api/calendar-sources/[id]/route.ts`

- [ ] **Step 1: Create list + create route**

  Create `packages/web/src/app/api/calendar-sources/route.ts`:

  ```typescript
  import { db, calendarSources } from "@todo/db";
  import { CreateCalendarSourceSchema } from "@todo/shared";
  import { asc } from "drizzle-orm";
  import { nanoid } from "nanoid";
  import { err, nowIso, ok } from "@/lib/api";

  export async function GET() {
    const sources = await db.select().from(calendarSources).orderBy(asc(calendarSources.name));
    return ok(sources);
  }

  export async function POST(request: Request) {
    const body = await request.json();
    const parsed = CreateCalendarSourceSchema.safeParse(body);
    if (!parsed.success) return err(parsed.error.message);

    const { name, url, projectId, areaId } = parsed.data;
    const now = nowIso();
    const [source] = await db
      .insert(calendarSources)
      .values({
        id: nanoid(),
        name,
        url,
        projectId: projectId ?? null,
        areaId: areaId ?? null,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    return ok(source, 201);
  }
  ```

- [ ] **Step 2: Create delete route**

  Create `packages/web/src/app/api/calendar-sources/[id]/route.ts`:

  ```typescript
  import { db, calendarSources } from "@todo/db";
  import { eq } from "drizzle-orm";
  import { err, ok } from "@/lib/api";

  export async function DELETE(
    _req: Request,
    { params }: { params: Promise<{ id: string }> },
  ) {
    const { id } = await params;
    const [deleted] = await db
      .delete(calendarSources)
      .where(eq(calendarSources.id, id))
      .returning();
    if (!deleted) return err("Not found", 404);
    return ok({ deleted: true });
  }
  ```

- [ ] **Step 3: Verify TypeScript**

  ```bash
  cd packages/web && npx tsc --noEmit
  ```

  Expected: no errors.

- [ ] **Step 4: Commit**

  ```bash
  git add packages/web/src/app/api/calendar-sources/
  git commit -m "feat: calendar-sources CRUD API (GET list, POST create, DELETE)"
  ```

---

## Task 7: Sync endpoint + Vercel Cron

**Files:**
- Create: `packages/web/src/app/api/calendar-sources/[id]/sync/route.ts`
- Create: `packages/web/src/app/api/cron/calendar-sync/route.ts`
- Modify: `vercel.json`

- [ ] **Step 1: Create per-source sync endpoint**

  Create `packages/web/src/app/api/calendar-sources/[id]/sync/route.ts`:

  ```typescript
  import { syncCalendarSource } from "@/lib/ical-sync";
  import { err, ok } from "@/lib/api";

  export async function POST(
    _req: Request,
    { params }: { params: Promise<{ id: string }> },
  ) {
    const { id } = await params;
    try {
      const result = await syncCalendarSource(id);
      return ok(result);
    } catch (e) {
      return err(e instanceof Error ? e.message : "Sync failed", 500);
    }
  }
  ```

- [ ] **Step 2: Create cron sync endpoint**

  Create `packages/web/src/app/api/cron/calendar-sync/route.ts`:

  ```typescript
  import { db, calendarSources } from "@todo/db";
  import { syncCalendarSource } from "@/lib/ical-sync";
  import { ok } from "@/lib/api";

  export async function GET(request: Request) {
    // Vercel Cron sends Authorization: Bearer <CRON_SECRET>
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return new Response("Unauthorized", { status: 401 });
    }

    const sources = await db.select().from(calendarSources);
    const results = await Promise.allSettled(sources.map((s) => syncCalendarSource(s.id)));

    const summary = results.map((r, i) => ({
      id: sources[i]!.id,
      name: sources[i]!.name,
      status: r.status,
      ...(r.status === "fulfilled" ? r.value : { error: (r.reason as Error).message }),
    }));

    return ok(summary);
  }
  ```

  Note: Vercel Cron uses GET by default for cron jobs. The endpoint validates the Vercel-injected `CRON_SECRET`.

- [ ] **Step 3: Add cron to vercel.json**

  Replace the contents of `vercel.json` with:

  ```json
  {
    "buildCommand": "pnpm --filter @todo/web build",
    "installCommand": "pnpm install",
    "framework": "nextjs",
    "crons": [{ "path": "/api/cron/calendar-sync", "schedule": "0 6 * * *" }]
  }
  ```

  This runs at 6:00 AM UTC every day.

- [ ] **Step 4: Add CRON_SECRET to Vercel env**

  Generate and push the secret:

  ```bash
  # Generate a random secret
  openssl rand -hex 32
  # Then add it to Vercel (will prompt for the value):
  vercel env add CRON_SECRET production
  ```

  Also add to your local `.env.local` for testing:
  ```
  CRON_SECRET=<your-generated-value>
  ```

- [ ] **Step 5: Verify TypeScript**

  ```bash
  cd packages/web && npx tsc --noEmit
  ```

  Expected: no errors.

- [ ] **Step 6: Commit**

  ```bash
  git add packages/web/src/app/api/calendar-sources/[id]/sync/ \
          packages/web/src/app/api/cron/ \
          vercel.json
  git commit -m "feat: per-source sync endpoint + daily Vercel Cron job at 6 AM UTC"
  ```

---

## Task 8: TanStack Query hooks

**Files:**
- Create: `packages/web/src/hooks/use-calendar-sources.ts`

- [ ] **Step 1: Create hooks file**

  Create `packages/web/src/hooks/use-calendar-sources.ts`:

  ```typescript
  "use client";

  import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
  import type { CalendarSource, CreateCalendarSourceInput } from "@todo/shared";
  import { api } from "@/lib/fetch";
  import { notify } from "@/lib/toast";

  export function useCalendarSources() {
    return useQuery({
      queryKey: ["calendar-sources"],
      queryFn: () => api.get<CalendarSource[]>("/api/calendar-sources"),
    });
  }

  export function useCreateCalendarSource() {
    const qc = useQueryClient();
    return useMutation({
      mutationFn: (data: CreateCalendarSourceInput) =>
        api.post<CalendarSource>("/api/calendar-sources", data),
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: ["calendar-sources"] });
        notify.success("Calendar source added");
      },
      onError: (err) => notify.error("Failed to add calendar source", err),
    });
  }

  export function useDeleteCalendarSource() {
    const qc = useQueryClient();
    return useMutation({
      mutationFn: (id: string) => api.delete<{ deleted: boolean }>(`/api/calendar-sources/${id}`),
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: ["calendar-sources"] });
        notify.success("Calendar source removed");
      },
      onError: (err) => notify.error("Failed to remove calendar source", err),
    });
  }

  export function useSyncCalendarSource() {
    const qc = useQueryClient();
    return useMutation({
      mutationFn: (id: string) =>
        api.post<{ created: number; skipped: number }>(`/api/calendar-sources/${id}/sync`, {}),
      onSuccess: (result) => {
        qc.invalidateQueries({ queryKey: ["tasks"] });
        qc.invalidateQueries({ queryKey: ["calendar-sources"] });
        notify.success(`Synced: ${result.created} new, ${result.skipped} skipped`);
      },
      onError: (err) => notify.error("Sync failed", err),
    });
  }
  ```

- [ ] **Step 2: Verify TypeScript**

  ```bash
  cd packages/web && npx tsc --noEmit
  ```

  Expected: no errors.

- [ ] **Step 3: Commit**

  ```bash
  git add packages/web/src/hooks/use-calendar-sources.ts
  git commit -m "feat: TanStack Query hooks for calendar sources CRUD + sync"
  ```

---

## Task 9: Calendar sources settings sheet UI

**Files:**
- Create: `packages/web/src/components/settings/calendar-sources-sheet.tsx`
- Modify: `packages/web/src/components/layout/sidebar.tsx`

- [ ] **Step 1: Create the settings sheet component**

  Create `packages/web/src/components/settings/calendar-sources-sheet.tsx`:

  ```typescript
  "use client";

  import { useState } from "react";
  import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
  import { Button } from "@/components/ui/button";
  import { Input } from "@/components/ui/input";
  import { Label } from "@/components/ui/label";
  import { Separator } from "@/components/ui/separator";
  import { Trash2, RefreshCw, Plus } from "lucide-react";
  import {
    useCalendarSources,
    useCreateCalendarSource,
    useDeleteCalendarSource,
    useSyncCalendarSource,
  } from "@/hooks/use-calendar-sources";
  import { useProjects } from "@/hooks/use-projects";

  interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
  }

  export function CalendarSourcesSheet({ open, onOpenChange }: Props) {
    const { data: sources = [] } = useCalendarSources();
    const { data: projects = [] } = useProjects();
    const createSource = useCreateCalendarSource();
    const deleteSource = useDeleteCalendarSource();
    const syncSource = useSyncCalendarSource();

    const [name, setName] = useState("");
    const [url, setUrl] = useState("");
    const [projectId, setProjectId] = useState("");

    function handleAdd() {
      if (!name.trim() || !url.trim()) return;
      createSource.mutate(
        { name: name.trim(), url: url.trim(), projectId: projectId || undefined },
        {
          onSuccess: () => {
            setName("");
            setUrl("");
            setProjectId("");
          },
        },
      );
    }

    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-96">
          <SheetHeader>
            <SheetTitle>Calendar Feeds</SheetTitle>
          </SheetHeader>

          <div className="mt-6 space-y-4">
            {sources.length === 0 && (
              <p className="text-sm text-muted-foreground">No calendar feeds yet.</p>
            )}
            {sources.map((source) => (
              <div key={source.id} className="flex items-center justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{source.name}</p>
                  {source.lastSyncedAt && (
                    <p className="text-xs text-muted-foreground">
                      Last synced {new Date(source.lastSyncedAt).toLocaleDateString()}
                    </p>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => syncSource.mutate(source.id)}
                  disabled={syncSource.isPending}
                  title="Sync now"
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => deleteSource.mutate(source.id)}
                  disabled={deleteSource.isPending}
                  title="Remove feed"
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>

          <Separator className="my-6" />

          <div className="space-y-3">
            <p className="text-sm font-medium">Add feed</p>
            <div className="space-y-2">
              <Label htmlFor="cs-name">Name</Label>
              <Input
                id="cs-name"
                placeholder="Madison Garbage Collection"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cs-url">iCal URL</Label>
              <Input
                id="cs-url"
                placeholder="https://city.gov/calendar.ics"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cs-project">Project (optional)</Label>
              <select
                id="cs-project"
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
              >
                <option value="">— None —</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <Button
              className="w-full"
              onClick={handleAdd}
              disabled={!name.trim() || !url.trim() || createSource.isPending}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Feed
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    );
  }
  ```

- [ ] **Step 2: Add the trigger to the sidebar footer**

  In `packages/web/src/components/layout/sidebar.tsx`:

  1. Add import at the top with the other imports:
     ```typescript
     import { useState } from "react";
     import { CalendarSourcesSheet } from "@/components/settings/calendar-sources-sheet";
     import { Rss } from "lucide-react";
     ```
     (Add `Rss` to the existing lucide import line; add `useState` to the existing react import if not already there.)

  2. Inside the main `AppSidebar` component function (or whichever function renders `<SidebarFooter>`), add state:
     ```typescript
     const [calendarSheetOpen, setCalendarSheetOpen] = useState(false);
     ```

  3. Add the button and sheet inside `<SidebarFooter>`, alongside the existing `<ThemeToggle />`:
     ```typescript
     <SidebarFooter>
       <div className="flex items-center justify-between px-2 py-1">
         <ThemeToggle />
         <Button
           variant="ghost"
           size="icon"
           onClick={() => setCalendarSheetOpen(true)}
           title="Calendar feeds"
         >
           <Rss className="h-4 w-4" />
         </Button>
       </div>
       <CalendarSourcesSheet open={calendarSheetOpen} onOpenChange={setCalendarSheetOpen} />
     </SidebarFooter>
     ```

  Read the current `SidebarFooter` block in the file first to find the exact existing markup before editing.

- [ ] **Step 3: Verify TypeScript**

  ```bash
  cd packages/web && npx tsc --noEmit
  ```

  Expected: no errors.

- [ ] **Step 4: Start dev server and test manually**

  ```bash
  pnpm dev
  ```

  Verify:
  - Sidebar footer shows the RSS icon button
  - Clicking it opens a Sheet from the right
  - "Add feed" form validates (empty name/URL → button stays disabled)
  - Adding a feed calls POST /api/calendar-sources and shows it in the list
  - "Sync now" button calls the sync endpoint and shows a toast with created/skipped counts
  - Delete button removes the feed

- [ ] **Step 5: Commit**

  ```bash
  git add packages/web/src/components/settings/ packages/web/src/components/layout/sidebar.tsx
  git commit -m "feat: calendar feeds settings sheet with add/sync/delete UI"
  ```

---

## Self-Review Checklist

- **Seasonal recurrence:** `advanceToActiveMonth` is exported from `api.ts` and imported in the complete route. ✓ New task fields (`recurrenceActiveMonths`) are carried forward on spawn. ✓
- **iCal sync:** `syncCalendarSource` deduplicates by `calendarSourceId + recurrenceSourceUid`. Handles missing `uid` and missing `start` gracefully. ✓
- **Cron:** Uses GET (not POST) matching Vercel Cron's default. Protected by `CRON_SECRET`. ✓
- **Schema forward compat:** `calendarSourceId` uses `onDelete: "set null"` so deleting a source doesn't cascade-delete tasks. ✓
- **Types:** `Task` interface has `recurrenceActiveMonths: number[] | null` (deserialized), but DB stores it as JSON text — the complete route does `JSON.parse`. The shared type reflects the JS-side shape, not the DB column type. This is consistent with how the DB layer works.
- **No placeholder steps:** All code blocks are complete. ✓
