import { areas, db, logEntries, logs, occasions, projects, sections, subscriptions, taskCompletions, tasks } from "@todo/db";
import type { ExportPayload, Occasion, Subscription, Task } from "@todo/shared";
import { asc } from "drizzle-orm";
import { nowIso, ok } from "@/lib/api";

export async function GET() {
  const [
    areaRows,
    projectRows,
    sectionRows,
    taskRows,
    taskCompletionRows,
    logRows,
    logEntryRows,
    occasionRows,
    subscriptionRows,
  ] = await Promise.all([
    db.select().from(areas).orderBy(asc(areas.position)),
    db.select().from(projects).orderBy(asc(projects.position)),
    db.select().from(sections).orderBy(asc(sections.position)),
    db.select().from(tasks).orderBy(asc(tasks.position)),
    db.select().from(taskCompletions).orderBy(asc(taskCompletions.completedAt)),
    db.select().from(logs).orderBy(asc(logs.position)),
    db.select().from(logEntries).orderBy(asc(logEntries.loggedAt)),
    db.select().from(occasions).orderBy(asc(occasions.date)),
    db.select().from(subscriptions).orderBy(asc(subscriptions.position)),
  ]);

  const payload: ExportPayload = {
    exportedAt: nowIso(),
    areas: areaRows,
    projects: projectRows,
    sections: sectionRows,
    tasks: taskRows as Task[],
    taskCompletions: taskCompletionRows,
    logs: logRows,
    logEntries: logEntryRows,
    occasions: occasionRows as Occasion[],
    subscriptions: subscriptionRows as Subscription[],
  };

  return ok(payload);
}
