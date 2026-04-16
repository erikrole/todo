import { db, tasks } from "@todo/db";
import { and, isNotNull, lte } from "drizzle-orm";
import { ok } from "@/lib/api";

/** Permanently delete tasks that have been in the trash for more than 30 days. */
export async function POST() {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);
  const result = await db
    .delete(tasks)
    .where(and(isNotNull(tasks.deletedAt), lte(tasks.deletedAt, cutoff.toISOString())))
    .returning({ id: tasks.id });
  return ok({ purged: result.length });
}
