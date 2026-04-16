import { db, taskCompletions, tasks } from "@todo/db";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { err, nowIso, ok } from "@/lib/api";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const body = await req.json().catch(() => null);
  if (!body || !Array.isArray(body.completions) || body.completions.length === 0) {
    return err("completions must be a non-empty array");
  }

  const completions: Array<{ completedAt: string; notes?: string }> = body.completions;

  // Resolve the task and get canonical ID
  const [task] = await db
    .select()
    .from(tasks)
    .where(eq(tasks.id, id));
  if (!task) return err("Not found", 404);

  const canonicalId = task.spawnedFromTaskId ?? task.id;

  // Delete existing completions for this canonical task (clean slate)
  await db.delete(taskCompletions).where(eq(taskCompletions.taskId, canonicalId));

  // Build rows with computed intervalActual
  const now = nowIso();
  const rows = completions.map((curr, i) => {
    const prev = completions[i - 1];
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

  await db.insert(taskCompletions).values(rows);

  return ok({ inserted: rows.length }, 201);
}
