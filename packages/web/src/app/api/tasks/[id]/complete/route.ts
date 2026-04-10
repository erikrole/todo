import { db, tasks } from "@todo/db";
import { and, eq, isNull } from "drizzle-orm";
import { err, nextRecurrenceDate, nowIso, ok, todayStr } from "@/lib/api";

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
      const nextWhenDate = nextRecurrenceDate(baseDate, original.recurrenceType, original.recurrenceInterval);

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
          position: original.position,
          createdAt: now,
          updatedAt: now,
        });
      }
    }
  }

  return ok(completed);
}
