import { db, taskCompletions, tasks } from "@todo/db";
import { asc, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { z } from "zod";
import { err, nowIso, ok } from "@/lib/api";
import { recomputeIntervals } from "@/lib/completions";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const [task] = await db.select().from(tasks).where(eq(tasks.id, id));
  if (!task) return err("Not found", 404);

  const canonicalId = task.spawnedFromTaskId ?? task.id;

  const completionRows = await db
    .select()
    .from(taskCompletions)
    .where(eq(taskCompletions.taskId, canonicalId))
    .orderBy(asc(taskCompletions.completedAt));

  const count = completionRows.length;
  const intervals = completionRows
    .map((r) => r.intervalActual)
    .filter((v): v is number => v !== null);

  const avgDays =
    intervals.length > 0
      ? Math.round((intervals.reduce((a, b) => a + b, 0) / intervals.length) * 10) / 10
      : null;
  const shortestDays = intervals.length > 0 ? Math.round(Math.min(...intervals) * 10) / 10 : null;
  const longestDays = intervals.length > 0 ? Math.round(Math.max(...intervals) * 10) / 10 : null;
  const lastCompletedAt =
    completionRows.length > 0 ? completionRows[completionRows.length - 1].completedAt : null;

  return ok({ completions: completionRows, stats: { count, avgDays, shortestDays, longestDays, lastCompletedAt } });
}

const PostSchema = z.object({
  completedAt: z.string().min(1),
  notes: z.string().optional().nullable(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const body = await req.json().catch(() => null);
  const parsed = PostSchema.safeParse(body);
  if (!parsed.success) return err(parsed.error.message);

  const [task] = await db.select().from(tasks).where(eq(tasks.id, id));
  if (!task) return err("Not found", 404);

  const canonicalId = task.spawnedFromTaskId ?? task.id;

  const row = {
    id: nanoid(),
    taskId: canonicalId,
    completedAt: parsed.data.completedAt,
    intervalActual: null as number | null,
    notes: parsed.data.notes ?? null,
    createdAt: nowIso(),
  };

  await db.insert(taskCompletions).values(row);
  await recomputeIntervals(canonicalId);

  const [created] = await db
    .select()
    .from(taskCompletions)
    .where(eq(taskCompletions.id, row.id));

  return ok(created, 201);
}
