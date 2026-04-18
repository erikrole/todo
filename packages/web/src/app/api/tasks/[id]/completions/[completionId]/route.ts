import { db, taskCompletions, tasks } from "@todo/db";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { err, ok } from "@/lib/api";
import { recomputeIntervals } from "@/lib/completions";

const PatchSchema = z.object({
  completedAt: z.string().min(1).optional(),
  notes: z.string().optional().nullable(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; completionId: string }> },
) {
  const { id, completionId } = await params;

  const body = await req.json().catch(() => null);
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) return err(parsed.error.message);

  const [[task], [existing]] = await Promise.all([
    db.select().from(tasks).where(eq(tasks.id, id)),
    db.select().from(taskCompletions).where(eq(taskCompletions.id, completionId)),
  ]);
  if (!task) return err("Not found", 404);
  if (!existing) return err("Completion not found", 404);

  const canonicalId = task.spawnedFromTaskId ?? task.id;

  const patch: Record<string, unknown> = {};
  if (parsed.data.completedAt !== undefined) patch.completedAt = parsed.data.completedAt;
  if (parsed.data.notes !== undefined) patch.notes = parsed.data.notes ?? null;

  const [updated] = await db
    .update(taskCompletions)
    .set(patch)
    .where(eq(taskCompletions.id, completionId))
    .returning();
  await recomputeIntervals(canonicalId);

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
