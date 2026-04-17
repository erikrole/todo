import { db, taskCompletions } from "@todo/db";
import { asc, eq } from "drizzle-orm";

export async function recomputeIntervals(canonicalId: string) {
  const all = await db
    .select()
    .from(taskCompletions)
    .where(eq(taskCompletions.taskId, canonicalId))
    .orderBy(asc(taskCompletions.completedAt));

  for (let i = 0; i < all.length; i++) {
    const prev = all[i - 1];
    const curr = all[i];
    const intervalActual =
      i === 0 || !prev
        ? null
        : Math.round(
            ((Date.parse(curr.completedAt) - Date.parse(prev.completedAt)) / 86400000) * 100,
          ) / 100;
    if (intervalActual !== curr.intervalActual) {
      await db
        .update(taskCompletions)
        .set({ intervalActual })
        .where(eq(taskCompletions.id, curr.id));
    }
  }
}
