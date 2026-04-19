import { db, taskCompletions, tasks } from "@todo/db";
import { and, eq, isNotNull } from "drizzle-orm";
import { nanoid } from "nanoid";
import { err, nowIso, ok } from "@/lib/api";
import { z } from "zod";

const RoutineCompletionSchema = z.object({
  taskTitle: z.string().min(1),
  completedAt: z.string(), // YYYY-MM-DD
  notes: z.string().optional(),
});

const ImportRoutinesSchema = z.object({
  completions: z.array(RoutineCompletionSchema).min(1),
  createMissing: z.boolean().optional().default(true),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = ImportRoutinesSchema.safeParse(body);
  if (!parsed.success) return err(parsed.error.message);

  const { completions, createMissing } = parsed.data;

  // Load all recurring tasks
  const recurringTasks = await db
    .select({ id: tasks.id, title: tasks.title })
    .from(tasks)
    .where(isNotNull(tasks.recurrenceType));

  const taskMap = new Map(recurringTasks.map((t) => [t.title.toLowerCase(), t.id]));

  const now = nowIso();
  let tasksCreated = 0;
  let completionsInserted = 0;
  let skipped = 0;

  // Group completions by task title
  const byTitle = new Map<string, typeof completions>();
  for (const c of completions) {
    const key = c.taskTitle;
    if (!byTitle.has(key)) byTitle.set(key, []);
    byTitle.get(key)!.push(c);
  }

  for (const [title, titleCompletions] of byTitle) {
    let taskId = taskMap.get(title.toLowerCase());

    if (!taskId) {
      if (!createMissing) {
        skipped += titleCompletions.length;
        continue;
      }
      // Create a new recurring task for this routine
      const [created] = await db
        .insert(tasks)
        .values({
          id: nanoid(),
          title,
          recurrenceType: "custom",
          recurrenceMode: "after_completion",
          recurrenceInterval: 1,
          isSomeday: false,
          isCompleted: false,
          isCancelled: false,
          position: 0,
          createdAt: now,
          updatedAt: now,
        })
        .returning({ id: tasks.id });
      taskId = created.id;
      tasksCreated++;
    }

    // Load existing completions for this task to dedup
    const existing = await db
      .select({ completedAt: taskCompletions.completedAt })
      .from(taskCompletions)
      .where(eq(taskCompletions.taskId, taskId));
    const existingDates = new Set(existing.map((e) => e.completedAt.slice(0, 10)));

    const toInsert = titleCompletions.filter((c) => !existingDates.has(c.completedAt.slice(0, 10)));
    skipped += titleCompletions.length - toInsert.length;

    if (toInsert.length > 0) {
      await db.insert(taskCompletions).values(
        toInsert.map((c) => ({
          id: nanoid(),
          taskId: taskId!,
          // Normalize date-only strings to noon local so UTC parsing can't shift the day
          completedAt: c.completedAt.length === 10 ? c.completedAt + "T12:00:00" : c.completedAt,
          notes: c.notes ?? null,
          createdAt: now,
        })),
      );
      completionsInserted += toInsert.length;
    }
  }

  return ok({ tasksCreated, completionsInserted, skipped, total: completions.length }, 201);
}
