import { db, taskCompletions, tasks } from "@todo/db";
import { and, desc, eq, isNull } from "drizzle-orm";
import { err, nextRecurrenceDate, nowIso, ok, todayStr } from "@/lib/api";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const now = nowIso();
  const today = searchParams.get("date") || todayStr();

  const [original] = await db.select().from(tasks).where(and(eq(tasks.id, id), isNull(tasks.deletedAt)));
  if (!original) return err("Not found", 404);

  // Write completion record
  const canonicalId = original.spawnedFromTaskId ?? original.id;
  const [lastCompletion] = await db
    .select()
    .from(taskCompletions)
    .where(eq(taskCompletions.taskId, canonicalId))
    .orderBy(desc(taskCompletions.completedAt))
    .limit(1);
  const intervalActual = lastCompletion
    ? Math.round(((Date.parse(now) - Date.parse(lastCompletion.completedAt)) / 86400000) * 100) / 100
    : null;
  const { nanoid: nanoidFn } = await import("nanoid");

  const completed = await db.transaction(async (tx) => {
    const [completedTask] = await tx
      .update(tasks)
      .set({ isCompleted: true, completedAt: now, updatedAt: now })
      .where(eq(tasks.id, id))
      .returning();

    await tx.insert(taskCompletions).values({
      id: nanoidFn(),
      taskId: canonicalId,
      completedAt: now,
      intervalActual,
      notes: null,
      createdAt: now,
    });

    // Spawn next recurrence instance
    if (original.recurrenceType && original.recurrenceInterval) {
      const endsAt = original.recurrenceEndsAt;
      if (!endsAt || today <= endsAt) {
        const baseDate =
          original.recurrenceMode === "after_completion"
            ? today
            : (original.whenDate ?? today);
        const nextWhenDate = nextRecurrenceDate(baseDate, original.recurrenceType, original.recurrenceInterval);

        if (!endsAt || nextWhenDate <= endsAt) {
          await tx.insert(tasks).values({
            id: nanoidFn(),
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
            spawnedFromTaskId: canonicalId,
            position: original.position,
            createdAt: now,
            updatedAt: now,
          });
        }
      }
    }

    return completedTask;
  });

  return ok(completed);
}
