import { db, logs, logEntries } from "@todo/db";
import { CreateLogSchema } from "@todo/shared";
import { count, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { err, nowIso, ok } from "@/lib/api";

export async function GET() {
  const rows = await db
    .select({
      id: logs.id,
      name: logs.name,
      slug: logs.slug,
      description: logs.description,
      icon: logs.icon,
      color: logs.color,
      isBuiltIn: logs.isBuiltIn,
      position: logs.position,
      createdAt: logs.createdAt,
      updatedAt: logs.updatedAt,
      entryCount: count(logEntries.id),
    })
    .from(logs)
    .leftJoin(logEntries, eq(logEntries.logId, logs.id))
    .groupBy(logs.id)
    .orderBy(logs.position);

  return ok(rows);
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = CreateLogSchema.safeParse(body);
  if (!parsed.success) return err(parsed.error.message);

  const now = nowIso();
  const [log] = await db
    .insert(logs)
    .values({ id: nanoid(), ...parsed.data, createdAt: now, updatedAt: now })
    .returning();

  return ok(log, 201);
}
