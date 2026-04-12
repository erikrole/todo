import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { db, tasks } from "@todo/db";
import { eq, and, isNull, gt, lte, desc } from "drizzle-orm";
import { nanoid } from "nanoid";

const todayStr = () => new Date().toISOString().slice(0, 10);

function nowIso() {
  return new Date().toISOString();
}

/** Advance when_date by interval based on recurrence_type */
function nextDate(fromDate: string, type: string, interval: number): string {
  const d = new Date(fromDate + "T00:00:00");
  switch (type) {
    case "daily":
      d.setDate(d.getDate() + interval);
      break;
    case "weekly":
      d.setDate(d.getDate() + interval * 7);
      break;
    case "monthly":
      d.setMonth(d.getMonth() + interval);
      break;
    case "yearly":
      d.setFullYear(d.getFullYear() + interval);
      break;
    default:
      d.setDate(d.getDate() + interval);
  }
  return d.toISOString().slice(0, 10);
}

export function registerTaskTools(server: McpServer) {
  // ─── list_tasks ────────────────────────────────────────────────────────────
  server.tool(
    "list_tasks",
    "List tasks with optional filter (inbox/today/upcoming/completed/all) and project/area scope",
    {
      filter: z
        .enum(["inbox", "today", "upcoming", "completed", "all"])
        .default("all")
        .describe("Which tasks to return"),
      projectId: z.string().optional().describe("Filter by project ID"),
      areaId: z.string().optional().describe("Filter by area ID"),
    },
    async ({ filter, projectId, areaId }) => {
      const today = todayStr();
      let query = db.select().from(tasks).$dynamic();

      const conditions = [];
      conditions.push(isNull(tasks.deletedAt));
      if (projectId) conditions.push(eq(tasks.projectId, projectId));
      if (areaId) conditions.push(eq(tasks.areaId, areaId));

      switch (filter) {
        case "inbox":
          conditions.push(isNull(tasks.whenDate), isNull(tasks.projectId), isNull(tasks.areaId), isNull(tasks.parentTaskId), eq(tasks.isCompleted, false), eq(tasks.isCancelled, false), eq(tasks.isSomeday, false));
          break;
        case "today":
          conditions.push(lte(tasks.whenDate, today), isNull(tasks.parentTaskId), eq(tasks.isCompleted, false), eq(tasks.isCancelled, false));
          break;
        case "upcoming":
          conditions.push(gt(tasks.whenDate, today), isNull(tasks.parentTaskId), eq(tasks.isCompleted, false), eq(tasks.isCancelled, false));
          break;
        case "completed":
          conditions.push(eq(tasks.isCompleted, true), isNull(tasks.parentTaskId));
          break;
        default:
          conditions.push(isNull(tasks.parentTaskId));
      }

      if (conditions.length) query = query.where(and(...conditions));
      const rows = await query;

      return { content: [{ type: "text", text: JSON.stringify(rows, null, 2) }] };
    },
  );

  // ─── create_task ───────────────────────────────────────────────────────────
  server.tool(
    "create_task",
    "Create a new task",
    {
      title: z.string().min(1).describe("Task title"),
      notes: z.string().optional(),
      whenDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("YYYY-MM-DD"),
      timeOfDay: z.enum(["morning", "day", "night"]).optional(),
      deadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      projectId: z.string().optional(),
      areaId: z.string().optional(),
      sectionId: z.string().optional(),
      parentTaskId: z.string().optional(),
      recurrenceType: z.enum(["daily", "weekly", "monthly", "yearly", "custom"]).optional(),
      recurrenceMode: z.enum(["on_schedule", "after_completion"]).optional(),
      recurrenceInterval: z.number().int().positive().optional(),
      recurrenceEndsAt: z.string().optional(),
    },
    async (input) => {
      const now = nowIso();
      const [task] = await db
        .insert(tasks)
        .values({ id: nanoid(), ...input, createdAt: now, updatedAt: now })
        .returning();
      return { content: [{ type: "text", text: JSON.stringify(task, null, 2) }] };
    },
  );

  // ─── update_task ───────────────────────────────────────────────────────────
  server.tool(
    "update_task",
    "Update fields on an existing task",
    {
      id: z.string().describe("Task ID"),
      title: z.string().optional(),
      notes: z.string().nullable().optional(),
      whenDate: z.string().nullable().optional(),
      timeOfDay: z.enum(["morning", "day", "night"]).nullable().optional(),
      deadline: z.string().nullable().optional(),
      projectId: z.string().nullable().optional(),
      areaId: z.string().nullable().optional(),
      sectionId: z.string().nullable().optional(),
      recurrenceType: z.enum(["daily", "weekly", "monthly", "yearly", "custom"]).nullable().optional(),
      recurrenceMode: z.enum(["on_schedule", "after_completion"]).nullable().optional(),
      recurrenceInterval: z.number().int().positive().nullable().optional(),
      recurrenceEndsAt: z.string().nullable().optional(),
    },
    async ({ id, ...fields }) => {
      const [task] = await db
        .update(tasks)
        .set({ ...fields, updatedAt: nowIso() })
        .where(eq(tasks.id, id))
        .returning();
      if (!task) return { content: [{ type: "text", text: `Task ${id} not found` }], isError: true };
      return { content: [{ type: "text", text: JSON.stringify(task, null, 2) }] };
    },
  );

  // ─── complete_task ─────────────────────────────────────────────────────────
  server.tool(
    "complete_task",
    "Mark a task complete. If recurring, creates the next instance automatically.",
    { id: z.string().describe("Task ID") },
    async ({ id }) => {
      const now = nowIso();
      const today = todayStr();

      const [original] = await db.select().from(tasks).where(and(eq(tasks.id, id), isNull(tasks.deletedAt)));
      if (!original) return { content: [{ type: "text", text: `Task ${id} not found` }], isError: true };

      const [completed] = await db
        .update(tasks)
        .set({ isCompleted: true, completedAt: now, updatedAt: now })
        .where(eq(tasks.id, id))
        .returning();

      // Create next recurrence instance if applicable
      if (original.recurrenceType && original.recurrenceInterval) {
        const endsAt = original.recurrenceEndsAt;
        if (!endsAt || today <= endsAt) {
          const baseDate =
            original.recurrenceMode === "after_completion"
              ? today
              : (original.whenDate ?? today);
          const nextWhenDate = nextDate(baseDate, original.recurrenceType, original.recurrenceInterval);

          if (!endsAt || nextWhenDate <= endsAt) {
            await db.insert(tasks).values({
              id: nanoid(),
              title: original.title,
              notes: original.notes,
              whenDate: nextWhenDate,
              timeOfDay: original.timeOfDay,
              deadline: original.deadline,
              projectId: original.projectId,
              areaId: original.areaId,
              recurrenceType: original.recurrenceType,
              recurrenceMode: original.recurrenceMode,
              recurrenceInterval: original.recurrenceInterval,
              recurrenceEndsAt: original.recurrenceEndsAt,
              position: original.position,
              createdAt: now,
              updatedAt: now,
            });
          }
        }
      }

      return { content: [{ type: "text", text: JSON.stringify(completed, null, 2) }] };
    },
  );
}
