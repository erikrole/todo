import { db, tasks } from "@todo/db";
import { and, eq, gt, isNull, lte } from "drizzle-orm";
import { err, nowIso, ok } from "@/lib/api";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const now = nowIso();

  const [original] = await db.select().from(tasks).where(eq(tasks.id, id));
  if (!original) return err("Not found", 404);
  if (!original.isCompleted) return err("Task is not completed", 400);

  // Heuristic cleanup: if the task was recurring, find and delete the child
  // instance spawned at completion time (created within 5s, same recurrence fields).
  if (original.recurrenceType && original.recurrenceInterval && original.completedAt) {
    const completedAt = new Date(original.completedAt);
    // Tasks spawned within this window of the completion timestamp are recurrence candidates
    const RECURRENCE_SPAWN_WINDOW_MS = 5_000;
    const windowStart = new Date(completedAt.getTime() - RECURRENCE_SPAWN_WINDOW_MS).toISOString();
    const windowEnd = new Date(completedAt.getTime() + RECURRENCE_SPAWN_WINDOW_MS).toISOString();

    const candidates = await db
      .select()
      .from(tasks)
      .where(
        and(
          isNull(tasks.deletedAt),
          eq(tasks.recurrenceType, original.recurrenceType),
          original.projectId ? eq(tasks.projectId, original.projectId) : isNull(tasks.projectId),
          gt(tasks.createdAt, windowStart),
          lte(tasks.createdAt, windowEnd),
        ),
      );

    // Only delete if exactly one candidate — avoid clobbering unrelated tasks
    const children = candidates.filter((c) => c.id !== id);
    if (children.length === 1 && children[0]) {
      await db.delete(tasks).where(eq(tasks.id, children[0].id));
    }
  }

  const [task] = await db
    .update(tasks)
    .set({ isCompleted: false, completedAt: null, updatedAt: now })
    .where(eq(tasks.id, id))
    .returning();

  return ok(task);
}
