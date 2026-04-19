import { db, taskCompletions, tasks } from "@todo/db";
import { and, eq, isNotNull, isNull, sql } from "drizzle-orm";
import { nextRecurrenceDate, nowIso, ok } from "@/lib/api";

export async function POST() {
  // Find canonical routine tasks with no whenDate that have completions
  const routines = await db
    .select()
    .from(tasks)
    .where(
      and(
        isNotNull(tasks.recurrenceType),
        isNotNull(tasks.recurrenceInterval),
        isNull(tasks.whenDate),
        isNull(tasks.spawnedFromTaskId),
        isNull(tasks.parentTaskId),
        eq(tasks.isCompleted, false),
        eq(tasks.isCancelled, false),
      ),
    );

  if (routines.length === 0) return ok({ updated: 0 });

  const ids = routines.map((t) => t.id);

  const lastCompletions = await db
    .select({
      taskId: taskCompletions.taskId,
      lastAt: sql<string>`max(${taskCompletions.completedAt})`.as("last_at"),
    })
    .from(taskCompletions)
    .where(
      sql`${taskCompletions.taskId} IN (${sql.join(ids.map((id) => sql`${id}`), sql`, `)})`,
    )
    .groupBy(taskCompletions.taskId);

  const lastMap = new Map(lastCompletions.map((r) => [r.taskId, r.lastAt]));
  const now = nowIso();
  let updated = 0;

  for (const task of routines) {
    const lastAt = lastMap.get(task.id);
    if (!lastAt || !task.recurrenceType || !task.recurrenceInterval) continue;

    const nextDate = nextRecurrenceDate(
      lastAt.slice(0, 10),
      task.recurrenceType,
      task.recurrenceInterval,
    );
    await db.update(tasks).set({ whenDate: nextDate, updatedAt: now }).where(eq(tasks.id, task.id));
    updated++;
  }

  return ok({ updated });
}
