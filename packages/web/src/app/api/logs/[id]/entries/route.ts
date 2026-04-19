import { db, logEntries } from "@todo/db";
import { CreateLogEntrySchema } from "@todo/shared";
import { desc, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { err, nowIso, ok } from "@/lib/api";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const entries = await db
    .select()
    .from(logEntries)
    .where(eq(logEntries.logId, id))
    .orderBy(desc(logEntries.loggedAt));

  return ok(entries);
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = CreateLogEntrySchema.safeParse({ ...body, logId: id });
  if (!parsed.success) return err(parsed.error.message);

  const { data: entryData, ...rest } = parsed.data;
  const now = nowIso();
  const [entry] = await db
    .insert(logEntries)
    .values({
      id: nanoid(),
      ...rest,
      data: entryData ? JSON.stringify(entryData) : null,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  return ok(entry, 201);
}
