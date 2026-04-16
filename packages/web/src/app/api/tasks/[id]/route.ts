import { db, tasks } from "@todo/db";
import { UpdateTaskSchema } from "@todo/shared";
import { and, eq, isNull } from "drizzle-orm";
import { err, nowIso, ok } from "@/lib/api";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const [task] = await db.select().from(tasks).where(and(eq(tasks.id, id), isNull(tasks.deletedAt)));
  if (!task) return err("Not found", 404);

  const subtasks = await db.select().from(tasks).where(eq(tasks.parentTaskId, id));
  return ok({ ...task, subtasks });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = UpdateTaskSchema.safeParse(body);
  if (!parsed.success) return err(parsed.error.message);

  const update = { ...parsed.data };
  // Assigning a real date exits Someday automatically
  if (update.whenDate !== undefined && update.whenDate !== null) {
    update.isSomeday = false;
  }

  const [task] = await db
    .update(tasks)
    .set({ ...update, updatedAt: nowIso() })
    .where(and(eq(tasks.id, id), isNull(tasks.deletedAt)))
    .returning();
  if (!task) return err("Not found", 404);

  return ok(task);
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);

  if (searchParams.get("permanent") === "true") {
    // Hard-delete subtasks first to avoid orphans
    await db.delete(tasks).where(eq(tasks.parentTaskId, id));
    const [task] = await db.delete(tasks).where(eq(tasks.id, id)).returning();
    if (!task) return err("Not found", 404);
    return ok(task);
  }

  const now = nowIso();
  // Cascade soft-delete to subtasks
  await db.update(tasks).set({ deletedAt: now, updatedAt: now }).where(eq(tasks.parentTaskId, id));
  const [task] = await db
    .update(tasks)
    .set({ deletedAt: now, updatedAt: now })
    .where(eq(tasks.id, id))
    .returning();
  if (!task) return err("Not found", 404);
  return ok(task);
}
