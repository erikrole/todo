import { db, subscriptions } from "@todo/db";
import { UpdateSubscriptionSchema } from "@todo/shared";
import { eq } from "drizzle-orm";
import { err, nowIso, ok } from "@/lib/api";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [sub] = await db.select().from(subscriptions).where(eq(subscriptions.id, id));
  if (!sub) return err("Not found", 404);
  return ok(sub);
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = UpdateSubscriptionSchema.safeParse(body);
  if (!parsed.success) return err(parsed.error.message);

  const [sub] = await db
    .update(subscriptions)
    .set({ ...parsed.data, updatedAt: nowIso() })
    .where(eq(subscriptions.id, id))
    .returning();

  if (!sub) return err("Not found", 404);
  return ok(sub);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await db.delete(subscriptions).where(eq(subscriptions.id, id));
  return ok({ deleted: true });
}
