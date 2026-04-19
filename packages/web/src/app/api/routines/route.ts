import { db, tasks, areas, logs, logEntries, taskCompletions } from "@todo/db";
import { and, eq, isNotNull, isNull, sql } from "drizzle-orm";
import { ok } from "@/lib/api";
import { LINKED_LOG_SOURCES, LINKED_ROUTINE_TITLES } from "@/lib/routine-links";

export async function GET() {
  // All active recurring tasks — includes spawned instances (the current live recurrence)
  // Excludes subtasks (parentTaskId) but NOT spawnedFromTaskId, since spawns ARE the active routine
  const routineTasks = await db
    .select()
    .from(tasks)
    .where(
      and(
        isNotNull(tasks.recurrenceType),
        eq(tasks.isCompleted, false),
        eq(tasks.isCancelled, false),
        isNull(tasks.parentTaskId),
      ),
    )
    .orderBy(tasks.whenDate);

  if (routineTasks.length === 0) return ok([]);

  // ── Canonical IDs for task_completions lookup ────────────────────────────────
  // task_completions uses spawnedFromTaskId ?? id as the canonical key
  const canonicalIds = routineTasks.map((t) => t.spawnedFromTaskId ?? t.id);
  const uniqueCanonical = [...new Set(canonicalIds)];

  const completionRows = await db
    .select({
      taskId: taskCompletions.taskId,
      lastAt: sql<string>`max(${taskCompletions.completedAt})`.as("last_at"),
    })
    .from(taskCompletions)
    .where(
      sql`${taskCompletions.taskId} IN (${sql.join(
        uniqueCanonical.map((id) => sql`${id}`),
        sql`, `,
      )})`,
    )
    .groupBy(taskCompletions.taskId);

  const completionMap = new Map(completionRows.map((r) => [r.taskId, r.lastAt]));

  // ── Resolve log IDs for linked routines ──────────────────────────────────────
  const neededSlugs = [...new Set(LINKED_LOG_SOURCES.map((s) => s.logSlug))];
  const logRows = await db
    .select({ id: logs.id, slug: logs.slug })
    .from(logs)
    .where(sql`${logs.slug} IN (${sql.join(neededSlugs.map((s) => sql`${s}`), sql`, `)})`);
  const logIdBySlug = new Map(logRows.map((r) => [r.slug, r.id]));

  // Pull max(loggedAt) from log_entries for each linked source
  const logLastMap = new Map<string, string>(); // routineTitle → lastLoggedAt
  for (const src of LINKED_LOG_SOURCES) {
    const logId = logIdBySlug.get(src.logSlug);
    if (!logId) continue;

    const condition = src.typeFilter
      ? and(eq(logEntries.logId, logId), sql`json_extract(${logEntries.data}, '$.type') = ${src.typeFilter}`)
      : eq(logEntries.logId, logId);

    const [row] = await db
      .select({ lastAt: sql<string>`max(${logEntries.loggedAt})`.as("last_at") })
      .from(logEntries)
      .where(condition);

    if (row?.lastAt) logLastMap.set(src.routineTitle, row.lastAt);
  }

  // ── Load areas ───────────────────────────────────────────────────────────────
  const allAreas = await db.select({ id: areas.id, name: areas.name, color: areas.color }).from(areas);
  const areaMap = new Map(allAreas.map((a) => [a.id, a]));

  const linkedTitles = LINKED_ROUTINE_TITLES;

  const result = routineTasks.map((t, i) => {
    const canonicalId = canonicalIds[i];

    // Linked routines: use log_entries as source of truth
    // All others: use task_completions
    const lastCompletedAt = linkedTitles.has(t.title)
      ? (logLastMap.get(t.title) ?? null)
      : (completionMap.get(canonicalId) ?? null);

    return {
      ...t,
      lastCompletedAt,
      areaName: t.areaId ? (areaMap.get(t.areaId)?.name ?? null) : null,
      areaColor: t.areaId ? (areaMap.get(t.areaId)?.color ?? null) : null,
    };
  });

  return ok(result);
}
