import { db, tasks } from "@todo/db";
import { eq } from "drizzle-orm";
import { err, nowIso, ok } from "@/lib/api";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const [task] = await db
    .update(tasks)
    .set({ deletedAt: null, updatedAt: nowIso() })
    .where(eq(tasks.id, id))
    .returning();
  if (!task) return err("Not found", 404);
  return ok(task);
}
