import { db, logEntries, logs } from "@todo/db";
import { and, desc, eq, sql } from "drizzle-orm";
import { ok } from "@/lib/api";
import { GAS_LOG_SLUG, OIL_CHANGE_INTERVAL_MILES } from "@/lib/routine-links";

export type VehicleIntelligence = {
  currentOdometer: number | null;
  lastOilChangeMileage: number | null;
  lastOilChangeDate: string | null;
  milesDriven: number | null;
  intervalMiles: number;
  percentComplete: number | null;
  milesUntilDue: number | null;
};

export async function GET() {
  // ── Gas log → current odometer ───────────────────────────────────────────────
  const [gasLog] = await db
    .select({ id: logs.id })
    .from(logs)
    .where(eq(logs.slug, GAS_LOG_SLUG));

  let currentOdometer: number | null = null;
  if (gasLog) {
    const [row] = await db
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
    currentOdometer = row?.maxOdometer ?? null;
  }

  // ── Maintenance log → last oil change ────────────────────────────────────────
  const [maintenanceLog] = await db
    .select({ id: logs.id })
    .from(logs)
    .where(eq(logs.slug, "maintenance"));

  let lastOilChangeMileage: number | null = null;
  let lastOilChangeDate: string | null = null;

  if (maintenanceLog) {
    const [row] = await db
      .select({
        loggedAt: logEntries.loggedAt,
        data: logEntries.data,
      })
      .from(logEntries)
      .where(
        and(
          eq(logEntries.logId, maintenanceLog.id),
          sql`json_extract(${logEntries.data}, '$.type') = 'oil_change'`,
        ),
      )
      .orderBy(desc(logEntries.loggedAt))
      .limit(1);

    if (row) {
      lastOilChangeDate = row.loggedAt;
      try {
        const parsed = JSON.parse(row.data ?? "{}") as { odometer?: number };
        lastOilChangeMileage = parsed.odometer ?? null;
      } catch {
        // ignore malformed data
      }
    }
  }

  const milesDriven =
    currentOdometer !== null && lastOilChangeMileage !== null
      ? currentOdometer - lastOilChangeMileage
      : null;

  const percentComplete =
    milesDriven !== null ? Math.round((milesDriven / OIL_CHANGE_INTERVAL_MILES) * 100) : null;

  const milesUntilDue =
    milesDriven !== null ? OIL_CHANGE_INTERVAL_MILES - milesDriven : null;

  return ok({
    currentOdometer,
    lastOilChangeMileage,
    lastOilChangeDate,
    milesDriven,
    intervalMiles: OIL_CHANGE_INTERVAL_MILES,
    percentComplete,
    milesUntilDue,
  });
}
