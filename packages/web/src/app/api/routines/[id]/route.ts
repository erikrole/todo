import { db, tasks } from "@todo/db";
import { eq } from "drizzle-orm";
import { err, nowIso, ok } from "@/lib/api";
import { z } from "zod";

const PatchRoutineSchema = z.object({
  title: z.string().min(1).optional(),
  notes: z.string().nullable().optional(),
  whenDate: z.string().nullable().optional(),
  areaId: z.string().nullable().optional(),
  recurrenceType: z.string().nullable().optional(),
  recurrenceInterval: z.number().int().positive().nullable().optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = PatchRoutineSchema.safeParse(body);
  if (!parsed.success) return err(parsed.error.message);

  const [task] = await db
    .update(tasks)
    .set({ ...parsed.data, updatedAt: nowIso() })
    .where(eq(tasks.id, id))
    .returning();

  if (!task) return err("Not found", 404);
  return ok(task);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await db.delete(tasks).where(eq(tasks.id, id));
  return ok({ deleted: true });
}
