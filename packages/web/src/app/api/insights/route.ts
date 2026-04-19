import { db, logEntries, logs, tasks } from "@todo/db";
import { and, desc, eq, isNotNull, isNull, lt, lte, sql } from "drizzle-orm";
import { ok, todayStr } from "@/lib/api";
import { GAS_LOG_SLUG, OIL_CHANGE_INTERVAL_MILES, OIL_CHANGE_TASK_TITLE } from "@/lib/routine-links";

export type Insight = {
  id: string;
  icon: string;
  title: string;
  detail: string;
  severity: "info" | "warning" | "alert";
  href?: string;
};

export async function GET() {
  const today = todayStr();
  const insights: Insight[] = [];

  // ── Oil change mileage insight ────────────────────────────────────────────────
  const [gasLog] = await db.select({ id: logs.id }).from(logs).where(eq(logs.slug, GAS_LOG_SLUG));

  if (gasLog) {
    const [gasRow] = await db
      .select({
        maxOdometer: sql<number>`max(cast(json_extract(${logEntries.data}, '$.odometer') as real))`,
      })
      .from(logEntries)
      .where(
        and(
          eq(logEntries.logId, gasLog.id),
          sql`json_extract(${logEntries.data}, '$.odometer') IS NOT NULL`,
        ),
      );

    const currentOdometer = gasRow?.maxOdometer ?? null;

    if (currentOdometer !== null) {
      const [maintenanceLog] = await db
        .select({ id: logs.id })
        .from(logs)
        .where(eq(logs.slug, "maintenance"));

      let lastOilChangeMileage: number | null = null;

      if (maintenanceLog) {
        const [oilRow] = await db
          .select({ data: logEntries.data })
          .from(logEntries)
          .where(
            and(
              eq(logEntries.logId, maintenanceLog.id),
              sql`json_extract(${logEntries.data}, '$.type') = 'oil_change'`,
            ),
          )
          .orderBy(desc(logEntries.loggedAt))
          .limit(1);

        if (oilRow) {
          try {
            const parsed = JSON.parse(oilRow.data ?? "{}") as { odometer?: number };
            lastOilChangeMileage = parsed.odometer ?? null;
          } catch {
            // ignore malformed data
          }
        }
      }

      if (lastOilChangeMileage !== null) {
        const milesDriven = currentOdometer - lastOilChangeMileage;
        const pct = milesDriven / OIL_CHANGE_INTERVAL_MILES;
        if (pct >= 0.8) {
          const milesLeft = OIL_CHANGE_INTERVAL_MILES - milesDriven;
          insights.push({
            id: "oil-change-mileage",
            icon: "🔧",
            title: OIL_CHANGE_TASK_TITLE,
            detail:
              pct >= 1
                ? `${Math.round(milesDriven - OIL_CHANGE_INTERVAL_MILES).toLocaleString()} mi overdue`
                : `${Math.round(milesLeft).toLocaleString()} mi remaining`,
            severity: pct >= 1 ? "alert" : "warning",
            href: "/routines",
          });
        }
      }
    }
  }

  // ── Overdue routines ──────────────────────────────────────────────────────────
  const overdueDate = today;
  const overdue = await db
    .select({ id: tasks.id, title: tasks.title, whenDate: tasks.whenDate })
    .from(tasks)
    .where(
      and(
        isNotNull(tasks.recurrenceType),
        lt(tasks.whenDate, overdueDate),
        eq(tasks.isCompleted, false),
        eq(tasks.isCancelled, false),
        isNull(tasks.parentTaskId),
        isNull(tasks.deletedAt),
      ),
    );

  for (const t of overdue) {
    if (t.title === OIL_CHANGE_TASK_TITLE) continue; // handled by mileage insight
    insights.push({
      id: `overdue-${t.id}`,
      icon: "⚠️",
      title: t.title,
      detail: `overdue since ${t.whenDate}`,
      severity: "alert",
      href: "/routines",
    });
  }

  // ── Approaching routines (within 7 days) ─────────────────────────────────────
  const sevenDaysOut = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
  const approaching = await db
    .select({ id: tasks.id, title: tasks.title, whenDate: tasks.whenDate })
    .from(tasks)
    .where(
      and(
        isNotNull(tasks.recurrenceType),
        lte(tasks.whenDate, sevenDaysOut),
        sql`${tasks.whenDate} >= ${today}`,
        eq(tasks.isCompleted, false),
        eq(tasks.isCancelled, false),
        isNull(tasks.parentTaskId),
        isNull(tasks.deletedAt),
      ),
    );

  for (const t of approaching) {
    const daysUntil = Math.round(
      (Date.parse(t.whenDate! + "T00:00:00") - Date.parse(today + "T00:00:00")) / 86400000,
    );
    insights.push({
      id: `approaching-${t.id}`,
      icon: "📅",
      title: t.title,
      detail: daysUntil === 0 ? "due today" : daysUntil === 1 ? "due tomorrow" : `due in ${daysUntil}d`,
      severity: "info",
      href: "/routines",
    });
  }

  return ok(insights);
}
