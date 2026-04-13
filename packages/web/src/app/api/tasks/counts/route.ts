import { db, tasks } from "@todo/db";
import { and, count, eq, isNull, lt, lte } from "drizzle-orm";
import { ok, todayStr } from "@/lib/api";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const today = searchParams.get("date") || todayStr();

  const [inboxRow] = await db
    .select({ count: count() })
    .from(tasks)
    .where(
      and(
        isNull(tasks.whenDate),
        isNull(tasks.projectId),
        isNull(tasks.areaId),
        isNull(tasks.parentTaskId),
        eq(tasks.isCompleted, false),
        eq(tasks.isCancelled, false),
        eq(tasks.isSomeday, false),
        isNull(tasks.deletedAt),
      ),
    );

  const [todayRow] = await db
    .select({ count: count() })
    .from(tasks)
    .where(
      and(
        lte(tasks.whenDate, today),
        isNull(tasks.parentTaskId),
        eq(tasks.isCompleted, false),
        eq(tasks.isCancelled, false),
        isNull(tasks.deletedAt),
      ),
    );

  const [overdueRow] = await db
    .select({ count: count() })
    .from(tasks)
    .where(
      and(
        lt(tasks.whenDate, today),
        isNull(tasks.parentTaskId),
        eq(tasks.isCompleted, false),
        eq(tasks.isCancelled, false),
        isNull(tasks.deletedAt),
      ),
    );

  return ok({
    inbox: inboxRow.count,
    today: todayRow.count,
    overdue: overdueRow.count,
  });
}
