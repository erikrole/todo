import { db, taskCompletions, tasks } from "@todo/db";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { z } from "zod";
import { err, nowIso, ok } from "@/lib/api";

const ImportSchema = z.object({
  completions: z
    .array(
      z.object({
        completedAt: z.string().min(1),
        notes: z.string().optional(),
      }),
    )
    .min(1),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const body = await req.json().catch(() => null);
  const parsed = ImportSchema.safeParse(body);
  if (!parsed.success) {
    return err(parsed.error.message);
  }

  // Resolve the task and get canonical ID
  const [task] = await db.select().from(tasks).where(eq(tasks.id, id));
  if (!task) return err("Not found", 404);

  const canonicalId = task.spawnedFromTaskId ?? task.id;

  // Sort completions chronologically before computing intervals
  const sorted = [...parsed.data.completions].sort(
    (a, b) => Date.parse(a.completedAt) - Date.parse(b.completedAt),
  );

  // Build rows with computed intervalActual
  const now = nowIso();
  const rows = sorted.map((curr, i) => {
    const prev = sorted[i - 1];
    const intervalActual =
      i === 0 || !prev
        ? null
        : Math.round(
            ((Date.parse(curr.completedAt) - Date.parse(prev.completedAt)) / 86400000) * 100,
          ) / 100;

    return {
      id: nanoid(),
      taskId: canonicalId,
      completedAt: curr.completedAt,
      intervalActual,
      notes: curr.notes ?? null,
      createdAt: now,
    };
  });

  // Delete existing completions and insert new ones atomically
  await db.transaction(async (tx) => {
    await tx.delete(taskCompletions).where(eq(taskCompletions.taskId, canonicalId));
    await tx.insert(taskCompletions).values(rows);
  });

  return ok({ inserted: rows.length }, 201);
}
