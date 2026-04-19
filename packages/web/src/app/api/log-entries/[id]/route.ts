import { db, logEntries } from "@todo/db";
import { UpdateLogEntrySchema } from "@todo/shared";
import { eq } from "drizzle-orm";
import { err, nowIso, ok } from "@/lib/api";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = UpdateLogEntrySchema.safeParse(body);
  if (!parsed.success) return err(parsed.error.message);

  const { data: entryData, ...rest } = parsed.data;
  const [entry] = await db
    .update(logEntries)
    .set({
      ...rest,
      ...(entryData !== undefined ? { data: entryData ? JSON.stringify(entryData) : null } : {}),
      updatedAt: nowIso(),
    })
    .where(eq(logEntries.id, id))
    .returning();

  if (!entry) return err("Not found", 404);
  return ok(entry);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await db.delete(logEntries).where(eq(logEntries.id, id));
  return ok({ deleted: true });
}
