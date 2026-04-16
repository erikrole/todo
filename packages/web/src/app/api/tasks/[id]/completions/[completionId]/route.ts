import { db, taskCompletions, tasks } from "@todo/db";
import { asc, eq } from "drizzle-orm";
import { z } from "zod";
import { err, ok } from "@/lib/api";

const PatchSchema = z.object({
  completedAt: z.string().min(1).optional(),
  notes: z.string().optional().nullable(),
});

async function recomputeIntervals(canonicalId: string) {
  const all = await db
    .select()
    .from(taskCompletions)
    .where(eq(taskCompletions.taskId, canonicalId))
    .orderBy(asc(taskCompletions.completedAt));

  for (let i = 0; i < all.length; i++) {
    const prev = all[i - 1];
    const curr = all[i];
    const intervalActual =
      i === 0 || !prev
        ? null
        : Math.round(
            ((Date.parse(curr.completedAt) - Date.parse(prev.completedAt)) / 86400000) * 100,
          ) / 100;
    if (intervalActual !== curr.intervalActual) {
      await db
        .update(taskCompletions)
        .set({ intervalActual })
        .where(eq(taskCompletions.id, curr.id));
    }
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; completionId: string }> },
) {
  const { id, completionId } = await params;

  const body = await req.json().catch(() => null);
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) return err(parsed.error.message);

  const [task] = await db.select().from(tasks).where(eq(tasks.id, id));
  if (!task) return err("Not found", 404);
  const canonicalId = task.spawnedFromTaskId ?? task.id;

  const [existing] = await db
    .select()
    .from(taskCompletions)
    .where(eq(taskCompletions.id, completionId));
  if (!existing) return err("Completion not found", 404);

  const patch: Record<string, unknown> = {};
  if (parsed.data.completedAt !== undefined) patch.completedAt = parsed.data.completedAt;
  if (parsed.data.notes !== undefined) patch.notes = parsed.data.notes ?? null;

  await db.update(taskCompletions).set(patch).where(eq(taskCompletions.id, completionId));
  await recomputeIntervals(canonicalId);

  const [updated] = await db
    .select()
    .from(taskCompletions)
    .where(eq(taskCompletions.id, completionId));

  return ok(updated);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; completionId: string }> },
) {
  const { id, completionId } = await params;

  const [task] = await db.select().from(tasks).where(eq(tasks.id, id));
  if (!task) return err("Not found", 404);
  const canonicalId = task.spawnedFromTaskId ?? task.id;

  const [existing] = await db
    .select()
    .from(taskCompletions)
    .where(eq(taskCompletions.id, completionId));
  if (!existing) return err("Completion not found", 404);

  await db.delete(taskCompletions).where(eq(taskCompletions.id, completionId));
  await recomputeIntervals(canonicalId);

  return ok({ deleted: completionId });
}
