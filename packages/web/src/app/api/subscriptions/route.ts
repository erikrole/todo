import { db, subscriptions } from "@todo/db";
import { CreateSubscriptionSchema } from "@todo/shared";
import { asc, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { err, nowIso, ok } from "@/lib/api";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const activeOnly = searchParams.get("active") !== "false";

  const rows = await db
    .select()
    .from(subscriptions)
    .where(activeOnly ? eq(subscriptions.isActive, true) : undefined)
    .orderBy(asc(subscriptions.position));

  return ok(rows);
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = CreateSubscriptionSchema.safeParse(body);
  if (!parsed.success) return err(parsed.error.message);

  const now = nowIso();
  const [sub] = await db
    .insert(subscriptions)
    .values({ id: nanoid(), ...parsed.data, createdAt: now, updatedAt: now })
    .returning();

  return ok(sub, 201);
}
