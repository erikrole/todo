import { db, logs } from "@todo/db";
import { UpdateLogSchema } from "@todo/shared";
import { eq } from "drizzle-orm";
import { err, nowIso, ok } from "@/lib/api";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [log] = await db.select().from(logs).where(eq(logs.id, id));
  if (!log) return err("Not found", 404);
  return ok(log);
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = UpdateLogSchema.safeParse(body);
  if (!parsed.success) return err(parsed.error.message);

  const [log] = await db
    .update(logs)
    .set({ ...parsed.data, updatedAt: nowIso() })
    .where(eq(logs.id, id))
    .returning();

  if (!log) return err("Not found", 404);
  return ok(log);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [log] = await db.select().from(logs).where(eq(logs.id, id));
  if (!log) return err("Not found", 404);
  if (log.isBuiltIn) return err("Cannot delete built-in logs", 403);

  await db.delete(logs).where(eq(logs.id, id));
  return ok({ deleted: true });
}
