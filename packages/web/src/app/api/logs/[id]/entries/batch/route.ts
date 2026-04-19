import { db, logEntries, logs } from "@todo/db";
import { eq, inArray } from "drizzle-orm";
import { nanoid } from "nanoid";
import { err, nowIso, ok } from "@/lib/api";
import { z } from "zod";

const BatchEntrySchema = z.object({
  loggedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  numericValue: z.number().nullable().optional(),
  data: z.record(z.unknown()).optional(),
  notes: z.string().optional(),
});

const BatchSchema = z.object({
  entries: z.array(BatchEntrySchema).min(1),
  skipExisting: z.boolean().optional().default(true),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [log] = await db.select().from(logs).where(eq(logs.id, id)).limit(1);
  if (!log) return err("Log not found", 404);

  const body = await request.json().catch(() => null);
  const parsed = BatchSchema.safeParse(body);
  if (!parsed.success) return err(parsed.error.message);

  const { entries, skipExisting } = parsed.data;

  let skipped = 0;
  const toInsert = entries;

  if (skipExisting) {
    const existing = await db
      .select({ loggedAt: logEntries.loggedAt })
      .from(logEntries)
      .where(eq(logEntries.logId, id));
    const existingDates = new Set(existing.map((e) => e.loggedAt));
    const filtered = entries.filter((e) => !existingDates.has(e.loggedAt));
    skipped = entries.length - filtered.length;
    if (filtered.length === 0) return ok({ inserted: 0, skipped, total: entries.length });
    const now = nowIso();
    const rows = filtered.map((e) => ({
      id: nanoid(),
      logId: id,
      loggedAt: e.loggedAt,
      numericValue: e.numericValue ?? null,
      data: e.data ? JSON.stringify(e.data) : null,
      notes: e.notes ?? null,
      createdAt: now,
      updatedAt: now,
    }));
    await db.insert(logEntries).values(rows);
    return ok({ inserted: rows.length, skipped, total: entries.length }, 201);
  }

  const now = nowIso();
  const rows = toInsert.map((e) => ({
    id: nanoid(),
    logId: id,
    loggedAt: e.loggedAt,
    numericValue: e.numericValue ?? null,
    data: e.data ? JSON.stringify(e.data) : null,
    notes: e.notes ?? null,
    createdAt: now,
    updatedAt: now,
  }));
  await db.insert(logEntries).values(rows);
  return ok({ inserted: rows.length, skipped: 0, total: entries.length }, 201);
}
