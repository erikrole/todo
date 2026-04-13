import { db, tasks } from "@todo/db";
import { BatchTaskActionSchema } from "@todo/shared";
import { and, inArray, isNull } from "drizzle-orm";
import { err, nowIso, ok } from "@/lib/api";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = BatchTaskActionSchema.safeParse(body);
  if (!parsed.success) return err(parsed.error.message);

  const { action, ids } = parsed.data;
  const now = nowIso();
  const activeWhere = and(inArray(tasks.id, ids), isNull(tasks.deletedAt));

  switch (action) {
    case "complete":
      await db.update(tasks).set({ isCompleted: true, completedAt: now, updatedAt: now }).where(activeWhere);
      break;
    case "uncomplete":
      await db.update(tasks).set({ isCompleted: false, completedAt: null, updatedAt: now }).where(activeWhere);
      break;
    case "delete":
      await db.update(tasks).set({ deletedAt: now, updatedAt: now }).where(activeWhere);
      break;
    case "restore":
      await db.update(tasks).set({ deletedAt: null, updatedAt: now }).where(inArray(tasks.id, ids));
      break;
    case "update": {
      const { patch } = parsed.data;
      await db.update(tasks).set({ ...patch, updatedAt: now }).where(activeWhere);
      break;
    }
  }

  return ok({ updated: ids.length });
}
