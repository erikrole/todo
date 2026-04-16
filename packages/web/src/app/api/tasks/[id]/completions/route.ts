import { db, taskCompletions, tasks } from "@todo/db";
import { asc, eq } from "drizzle-orm";
import { err, ok } from "@/lib/api";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  // Resolve the task and get canonical ID
  const [task] = await db
    .select()
    .from(tasks)
    .where(eq(tasks.id, id));
  if (!task) return err("Not found", 404);

  const canonicalId = task.spawnedFromTaskId ?? task.id;

  // Fetch all completions for this canonical task
  const completionRows = await db
    .select()
    .from(taskCompletions)
    .where(eq(taskCompletions.taskId, canonicalId))
    .orderBy(asc(taskCompletions.completedAt));

  // Compute stats
  const count = completionRows.length;
  const intervals = completionRows
    .map((r) => r.intervalActual)
    .filter((v): v is number => v !== null);

  const avgDays =
    intervals.length > 0
      ? Math.round((intervals.reduce((a, b) => a + b, 0) / intervals.length) * 10) / 10
      : null;
  const shortestDays =
    intervals.length > 0 ? Math.round(Math.min(...intervals) * 10) / 10 : null;
  const longestDays =
    intervals.length > 0 ? Math.round(Math.max(...intervals) * 10) / 10 : null;
  const lastCompletedAt =
    completionRows.length > 0
      ? completionRows[completionRows.length - 1].completedAt
      : null;

  return ok({
    completions: completionRows,
    stats: { count, avgDays, shortestDays, longestDays, lastCompletedAt },
  });
}
