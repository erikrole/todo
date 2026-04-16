import { db, tasks } from "@todo/db";
import { eq } from "drizzle-orm";
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

  // Delete the recurrence child spawned when this task was completed.
  // spawnedFromTaskId is set on insert, so this is a deterministic lookup.
  if (original.recurrenceType && original.recurrenceInterval) {
    await db.delete(tasks).where(eq(tasks.spawnedFromTaskId, id));
  }

  const [task] = await db
    .update(tasks)
    .set({ isCompleted: false, completedAt: null, updatedAt: now })
    .where(eq(tasks.id, id))
    .returning();

  return ok(task);
}
