import { db, tasks } from "@todo/db";
import { UpdateTaskSchema } from "@todo/shared";
import { eq } from "drizzle-orm";
import { err, nowIso, ok } from "@/lib/api";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const [task] = await db.select().from(tasks).where(eq(tasks.id, id));
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

  const [task] = await db
    .update(tasks)
    .set({ ...parsed.data, updatedAt: nowIso() })
    .where(eq(tasks.id, id))
    .returning();
  if (!task) return err("Not found", 404);

  return ok(task);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const [task] = await db.delete(tasks).where(eq(tasks.id, id)).returning();
  if (!task) return err("Not found", 404);
  return ok(task);
}
