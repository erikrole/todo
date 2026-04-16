import { db, tasks } from "@todo/db";
import { CreateTaskSchema } from "@todo/shared";
import { and, asc, eq, gt, gte, isNotNull, isNull, lt, lte, or } from "drizzle-orm";
import { nanoid } from "nanoid";
import { err, nowIso, ok, todayStr } from "@/lib/api";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const filter = searchParams.get("filter") ?? "all";
  const projectId = searchParams.get("projectId");
  const areaId = searchParams.get("areaId");

  const today = searchParams.get("date") || todayStr();
  const conditions = [];

  // Exclude soft-deleted tasks from all views except trash
  if (filter !== "trash") {
    conditions.push(isNull(tasks.deletedAt));
  }

  if (projectId) conditions.push(eq(tasks.projectId, projectId));
  if (areaId) conditions.push(eq(tasks.areaId, areaId));

  switch (filter) {
    case "inbox":
      conditions.push(
        isNull(tasks.whenDate),
        isNull(tasks.projectId),
        isNull(tasks.areaId),
        isNull(tasks.parentTaskId),
        eq(tasks.isCompleted, false),
        eq(tasks.isCancelled, false),
        eq(tasks.isSomeday, false),
      );
      break;
    case "today":
      conditions.push(lte(tasks.whenDate, today), isNull(tasks.parentTaskId), eq(tasks.isCompleted, false), eq(tasks.isCancelled, false));
      break;
    case "completed_today": {
      // Tasks completed today (completedAt starts with today's date string)
      const tomorrowDate = new Date(today + "T00:00:00");
      tomorrowDate.setDate(tomorrowDate.getDate() + 1);
      const tomorrowStr = `${tomorrowDate.getFullYear()}-${String(tomorrowDate.getMonth() + 1).padStart(2, "0")}-${String(tomorrowDate.getDate()).padStart(2, "0")}`;
      conditions.push(
        eq(tasks.isCompleted, true),
        isNull(tasks.parentTaskId),
        gte(tasks.completedAt, today),
        lt(tasks.completedAt, tomorrowStr),
      );
      break;
    }
    case "upcoming":
      conditions.push(gt(tasks.whenDate, today), isNull(tasks.parentTaskId), eq(tasks.isCompleted, false), eq(tasks.isCancelled, false));
      break;
    case "someday":
      conditions.push(eq(tasks.isSomeday, true), isNull(tasks.parentTaskId), eq(tasks.isCompleted, false), eq(tasks.isCancelled, false));
      break;
    case "completed":
      conditions.push(eq(tasks.isCompleted, true), isNull(tasks.parentTaskId));
      break;
    case "overdue":
      conditions.push(
        lt(tasks.whenDate, today),
        isNull(tasks.parentTaskId),
        eq(tasks.isCompleted, false),
        eq(tasks.isCancelled, false),
      );
      break;
    case "today_all": {
      const tomorrowDate = new Date(today + "T00:00:00");
      tomorrowDate.setDate(tomorrowDate.getDate() + 1);
      const tomorrowStr = `${tomorrowDate.getFullYear()}-${String(tomorrowDate.getMonth() + 1).padStart(2, "0")}-${String(tomorrowDate.getDate()).padStart(2, "0")}`;
      conditions.push(
        or(
          and(
            lte(tasks.whenDate, today),
            eq(tasks.isCompleted, false),
            eq(tasks.isCancelled, false),
            isNull(tasks.parentTaskId),
          ),
          and(
            eq(tasks.isCompleted, true),
            isNull(tasks.parentTaskId),
            gte(tasks.completedAt, today),
            lt(tasks.completedAt, tomorrowStr),
          ),
        ),
      );
      break;
    }
    case "trash": {
      conditions.push(isNotNull(tasks.deletedAt));
      break;
    }
    case "routines":
      conditions.push(
        isNotNull(tasks.recurrenceType),
        eq(tasks.isCompleted, false),
        eq(tasks.isCancelled, false),
        isNull(tasks.parentTaskId),
        isNull(tasks.spawnedFromTaskId),
      );
      break;
    default:
      conditions.push(isNull(tasks.parentTaskId));
  }

  const rows = await db
    .select()
    .from(tasks)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(filter === "routines" ? asc(tasks.whenDate) : asc(tasks.position));

  return ok(rows);
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = CreateTaskSchema.safeParse(body);
  if (!parsed.success) return err(parsed.error.message);

  const now = nowIso();
  const [task] = await db
    .insert(tasks)
    .values({ id: nanoid(), ...parsed.data, createdAt: now, updatedAt: now })
    .returning();

  return ok(task, 201);
}
