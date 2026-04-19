# Native Apple App — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prepare this repo for a native Apple app by adding missing shared TypeScript types, a typed `ExportPayload` interface, and a `GET /api/export` endpoint that the iOS app will call once on first launch to seed CloudKit.

**Architecture:** Add `Log`, `LogEntry`, `Occasion`, `Subscription`, and `TaskCompletion` types to the existing `packages/shared/src/types.ts`. Define `ExportPayload` in a new `packages/shared/src/export-types.ts` and re-export it from the shared index. Implement the route in `packages/web/src/app/api/export/route.ts` following the existing `ok()` / `err()` helper pattern. Auth is already enforced globally by the proxy middleware — no per-route work needed.

**Tech Stack:** Next.js App Router, Drizzle ORM, `@todo/db`, `@todo/shared`, TypeScript

---

## File Map

| Action | Path | Responsibility |
|---|---|---|
| Modify | `packages/shared/src/types.ts` | Add `Log`, `LogEntry`, `Occasion`, `Subscription`, `TaskCompletion` interfaces |
| Create | `packages/shared/src/export-types.ts` | `ExportPayload` interface — the typed shape of the export endpoint |
| Modify | `packages/shared/src/index.ts` | Re-export `export-types` |
| Create | `packages/web/src/app/api/export/route.ts` | `GET /api/export` — queries all tables, returns `ExportPayload` |

---

## Task 1: Add missing entity types to shared

**Files:**
- Modify: `packages/shared/src/types.ts`

The shared `types.ts` already has `Area`, `Project`, `Section`, `Task`. Add the five missing entity types at the bottom of the file, mirroring the Drizzle schema in `packages/db/src/schema.ts`.

- [ ] **Step 1: Append the five missing interfaces**

Open `packages/shared/src/types.ts` and append after the existing `ApiError` interface:

```typescript
// ─── Logs ────────────────────────────────────────────────────────────────────

export interface Log {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  isBuiltIn: boolean;
  position: number;
  createdAt: string;
  updatedAt: string;
}

export interface LogEntry {
  id: string;
  logId: string;
  loggedAt: string;
  numericValue: number | null;
  data: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

// ─── Occasions ───────────────────────────────────────────────────────────────

export interface Occasion {
  id: string;
  name: string;
  date: string;
  isAnnual: boolean;
  prepWindowDays: number;
  notes: string | null;
  emoji: string | null;
  occasionType: string;
  personName: string | null;
  startYear: number | null;
  position: number;
  createdAt: string;
  updatedAt: string;
}

// ─── Subscriptions ───────────────────────────────────────────────────────────

export interface Subscription {
  id: string;
  name: string;
  amount: number;
  billingPeriod: string;
  nextDueDate: string | null;
  category: string | null;
  autoRenew: boolean;
  isSplit: boolean;
  url: string | null;
  notes: string | null;
  isActive: boolean;
  position: number;
  createdAt: string;
  updatedAt: string;
}

// ─── Task Completions ────────────────────────────────────────────────────────

export interface TaskCompletion {
  id: string;
  taskId: string;
  completedAt: string;
  intervalActual: number | null;
  notes: string | null;
  createdAt: string;
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/erole/GitHub/todo && pnpm build 2>&1 | grep -E "error|Error" | head -20
```

Expected: no new type errors.

- [ ] **Step 3: Commit**

```bash
git add packages/shared/src/types.ts
git commit -m "feat(shared): add Log, LogEntry, Occasion, Subscription, TaskCompletion types"
```

---

## Task 2: Create ExportPayload type and re-export from shared index

**Files:**
- Create: `packages/shared/src/export-types.ts`
- Modify: `packages/shared/src/index.ts`

- [ ] **Step 1: Create `export-types.ts`**

Create `packages/shared/src/export-types.ts` with this exact content:

```typescript
import type {
  Area,
  Log,
  LogEntry,
  Occasion,
  Project,
  Section,
  Subscription,
  Task,
  TaskCompletion,
} from "./types";

export interface ExportPayload {
  exportedAt: string;
  areas: Area[];
  projects: Project[];
  sections: Section[];
  tasks: Task[];
  taskCompletions: TaskCompletion[];
  logs: Log[];
  logEntries: LogEntry[];
  occasions: Occasion[];
  subscriptions: Subscription[];
}
```

- [ ] **Step 2: Re-export from the shared index**

Open `packages/shared/src/index.ts`. It currently reads:

```typescript
export * from "./types";
export * from "./schemas";
```

Add the export:

```typescript
export * from "./types";
export * from "./schemas";
export * from "./export-types";
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
pnpm build 2>&1 | grep -E "error|Error" | head -20
```

Expected: no type errors.

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src/export-types.ts packages/shared/src/index.ts
git commit -m "feat(shared): add ExportPayload type for iOS migration endpoint"
```

---

## Task 3: Implement GET /api/export

**Files:**
- Create: `packages/web/src/app/api/export/route.ts`

This route queries every table in one pass and returns the full `ExportPayload`. Auth is already enforced by the proxy middleware for all `/api/*` routes — no additional auth code needed here.

- [ ] **Step 1: Create the route**

Create `packages/web/src/app/api/export/route.ts`:

```typescript
import { areas, db, logEntries, logs, occasions, projects, sections, subscriptions, taskCompletions, tasks } from "@todo/db";
import type { ExportPayload } from "@todo/shared";
import { asc } from "drizzle-orm";
import { nowIso, ok } from "@/lib/api";

export async function GET() {
  const [
    areaRows,
    projectRows,
    sectionRows,
    taskRows,
    taskCompletionRows,
    logRows,
    logEntryRows,
    occasionRows,
    subscriptionRows,
  ] = await Promise.all([
    db.select().from(areas).orderBy(asc(areas.position)),
    db.select().from(projects).orderBy(asc(projects.position)),
    db.select().from(sections).orderBy(asc(sections.position)),
    db.select().from(tasks).orderBy(asc(tasks.position)),
    db.select().from(taskCompletions).orderBy(asc(taskCompletions.completedAt)),
    db.select().from(logs).orderBy(asc(logs.position)),
    db.select().from(logEntries).orderBy(asc(logEntries.loggedAt)),
    db.select().from(occasions).orderBy(asc(occasions.date)),
    db.select().from(subscriptions).orderBy(asc(subscriptions.position)),
  ]);

  const payload: ExportPayload = {
    exportedAt: nowIso(),
    areas: areaRows,
    projects: projectRows,
    sections: sectionRows,
    tasks: taskRows,
    taskCompletions: taskCompletionRows,
    logs: logRows,
    logEntries: logEntryRows,
    occasions: occasionRows,
    subscriptions: subscriptionRows,
  };

  return ok(payload);
}
```

- [ ] **Step 2: Build to confirm no type errors**

```bash
pnpm build 2>&1 | grep -E "error|Error" | head -20
```

Expected: clean build.

- [ ] **Step 3: Start the dev server and test the endpoint**

```bash
pnpm dev
```

In a second terminal, test with your `AUTH_TOKEN`:

```bash
curl -s -H "Authorization: Bearer $AUTH_TOKEN" http://localhost:3000/api/export | jq '{exportedAt: .data.exportedAt, counts: {areas: (.data.areas | length), projects: (.data.projects | length), tasks: (.data.tasks | length), logs: (.data.logs | length), occasions: (.data.occasions | length)}}'
```

Expected output (counts will vary):
```json
{
  "exportedAt": "2026-04-19T...",
  "counts": {
    "areas": 3,
    "projects": 12,
    "tasks": 87,
    "logs": 6,
    "occasions": 4
  }
}
```

- [ ] **Step 4: Verify unauthenticated request is rejected**

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/export
```

Expected: `401`

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/app/api/export/route.ts
git commit -m "feat(api): add GET /api/export for iOS CloudKit seed migration"
```

---

## Done

After all three tasks, the repo is ready for Phase 2: the iOS app can call `GET /api/export` with its `AUTH_TOKEN` on first launch to populate its local Swift Data + CloudKit store.

The next step outside this repo is creating the Xcode project, defining the Swift `Codable` structs that mirror these types, and implementing the one-time import flow.
