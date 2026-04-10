import { db, projects, tasks } from "@todo/db";
import { CreateProjectSchema } from "@todo/shared";
import { and, count, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { err, nowIso, ok } from "@/lib/api";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const areaId = searchParams.get("areaId");

  const rows = await db
    .select({
      id: projects.id,
      name: projects.name,
      notes: projects.notes,
      color: projects.color,
      areaId: projects.areaId,
      isCompleted: projects.isCompleted,
      completedAt: projects.completedAt,
      position: projects.position,
      createdAt: projects.createdAt,
      updatedAt: projects.updatedAt,
      taskCount: count(tasks.id),
    })
    .from(projects)
    .leftJoin(tasks, and(eq(tasks.projectId, projects.id), eq(tasks.isCompleted, false)))
    .where(areaId ? eq(projects.areaId, areaId) : undefined)
    .groupBy(projects.id);

  return ok(rows);
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = CreateProjectSchema.safeParse(body);
  if (!parsed.success) return err(parsed.error.message);

  const now = nowIso();
  const [project] = await db
    .insert(projects)
    .values({ id: nanoid(), ...parsed.data, createdAt: now, updatedAt: now })
    .returning();

  return ok(project, 201);
}
