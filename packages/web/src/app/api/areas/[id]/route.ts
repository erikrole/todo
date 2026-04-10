import { db, areas } from "@todo/db";
import { UpdateAreaSchema } from "@todo/shared";
import { eq } from "drizzle-orm";
import { err, nowIso, ok } from "@/lib/api";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = UpdateAreaSchema.safeParse(body);
  if (!parsed.success) return err(parsed.error.message);

  const [area] = await db
    .update(areas)
    .set({ ...parsed.data, updatedAt: nowIso() })
    .where(eq(areas.id, id))
    .returning();
  if (!area) return err("Not found", 404);

  return ok(area);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const [area] = await db.delete(areas).where(eq(areas.id, id)).returning();
  if (!area) return err("Not found", 404);
  return ok(area);
}
