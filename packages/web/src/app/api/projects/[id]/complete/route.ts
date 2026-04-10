import { db, projects, tasks } from "@todo/db";
import { and, eq } from "drizzle-orm";
import { err, nowIso, ok } from "@/lib/api";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const completeAllTasks = body.completeAllTasks === true;
  const now = nowIso();

  if (completeAllTasks) {
    await db
      .update(tasks)
      .set({ isCompleted: true, completedAt: now, updatedAt: now })
      .where(and(eq(tasks.projectId, id), eq(tasks.isCompleted, false)));
  }

  const [project] = await db
    .update(projects)
    .set({ isCompleted: true, completedAt: now, updatedAt: now })
    .where(eq(projects.id, id))
    .returning();
  if (!project) return err("Not found", 404);

  return ok(project);
}
