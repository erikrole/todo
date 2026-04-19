import { db, occasions } from "@todo/db";
import { CreateOccasionSchema } from "@todo/shared";
import { asc } from "drizzle-orm";
import { nanoid } from "nanoid";
import { err, nowIso, ok } from "@/lib/api";

export async function GET() {
  const rows = await db.select().from(occasions).orderBy(asc(occasions.date));
  return ok(rows);
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = CreateOccasionSchema.safeParse(body);
  if (!parsed.success) return err(parsed.error.message);

  const now = nowIso();
  const [occasion] = await db
    .insert(occasions)
    .values({ id: nanoid(), ...parsed.data, createdAt: now, updatedAt: now })
    .returning();

  return ok(occasion, 201);
}
