import { db, occasions } from "@todo/db";
import { UpdateOccasionSchema } from "@todo/shared";
import { eq } from "drizzle-orm";
import { err, nowIso, ok } from "@/lib/api";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [occasion] = await db.select().from(occasions).where(eq(occasions.id, id));
  if (!occasion) return err("Not found", 404);
  return ok(occasion);
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = UpdateOccasionSchema.safeParse(body);
  if (!parsed.success) return err(parsed.error.message);

  const [occasion] = await db
    .update(occasions)
    .set({ ...parsed.data, updatedAt: nowIso() })
    .where(eq(occasions.id, id))
    .returning();

  if (!occasion) return err("Not found", 404);
  return ok(occasion);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await db.delete(occasions).where(eq(occasions.id, id));
  return ok({ deleted: true });
}
