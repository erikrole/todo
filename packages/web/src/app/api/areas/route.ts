import { db, areas, projects, tasks } from "@todo/db";
import { CreateAreaSchema } from "@todo/shared";
import { and, count, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { err, nowIso, ok } from "@/lib/api";

export async function GET() {
  const rows = await db
    .select({
      id: areas.id,
      name: areas.name,
      notes: areas.notes,
      color: areas.color,
      isArchived: areas.isArchived,
      position: areas.position,
      createdAt: areas.createdAt,
      updatedAt: areas.updatedAt,
      projectCount: count(projects.id),
    })
    .from(areas)
    .leftJoin(projects, and(eq(projects.areaId, areas.id), eq(projects.isCompleted, false)))
    .groupBy(areas.id);

  return ok(rows);
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = CreateAreaSchema.safeParse(body);
  if (!parsed.success) return err(parsed.error.message);

  const now = nowIso();
  const [area] = await db
    .insert(areas)
    .values({ id: nanoid(), ...parsed.data, createdAt: now, updatedAt: now })
    .returning();

  return ok(area, 201);
}
