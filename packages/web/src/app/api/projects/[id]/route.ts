import { db, projects } from "@todo/db";
import { UpdateProjectSchema } from "@todo/shared";
import { eq } from "drizzle-orm";
import { err, nowIso, ok } from "@/lib/api";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = UpdateProjectSchema.safeParse(body);
  if (!parsed.success) return err(parsed.error.message);

  const [project] = await db
    .update(projects)
    .set({ ...parsed.data, updatedAt: nowIso() })
    .where(eq(projects.id, id))
    .returning();
  if (!project) return err("Not found", 404);

  return ok(project);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const [project] = await db.delete(projects).where(eq(projects.id, id)).returning();
  if (!project) return err("Not found", 404);
  return ok(project);
}
