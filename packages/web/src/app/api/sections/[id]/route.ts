import { db, sections, tasks } from "@todo/db";
import { UpdateSectionSchema } from "@todo/shared";
import { eq } from "drizzle-orm";
import { err, nowIso, ok } from "@/lib/api";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = UpdateSectionSchema.safeParse(body);
  if (!parsed.success) return err(parsed.error.message);

  const [section] = await db
    .update(sections)
    .set({ ...parsed.data, updatedAt: nowIso() })
    .where(eq(sections.id, id))
    .returning();
  if (!section) return err("Not found", 404);

  return ok(section);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  // Unsection all tasks in this section before deleting
  await db.update(tasks).set({ sectionId: null }).where(eq(tasks.sectionId, id));

  const [section] = await db.delete(sections).where(eq(sections.id, id)).returning();
  if (!section) return err("Not found", 404);

  return ok(section);
}
