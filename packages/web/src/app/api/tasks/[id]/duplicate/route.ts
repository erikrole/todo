import { db, tasks } from "@todo/db";
import { and, asc, eq, gt, isNull } from "drizzle-orm";
import { err, nowIso, ok } from "@/lib/api";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const [original] = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.id, id), isNull(tasks.deletedAt)));
  if (!original) return err("Not found", 404);

  // Find next sibling position for fractional indexing
  const [nextSibling] = await db
    .select({ position: tasks.position })
    .from(tasks)
    .where(
      and(
        gt(tasks.position, original.position),
        isNull(tasks.deletedAt),
        original.projectId
          ? eq(tasks.projectId, original.projectId)
          : isNull(tasks.projectId),
        original.sectionId
          ? eq(tasks.sectionId, original.sectionId)
          : isNull(tasks.sectionId),
      ),
    )
    .orderBy(asc(tasks.position))
    .limit(1);

  const newPosition = nextSibling
    ? (original.position + nextSibling.position) / 2
    : original.position + 1.0;

  const now = nowIso();
  const { nanoid } = await import("nanoid");
  const [clone] = await db
    .insert(tasks)
    .values({
      id: nanoid(),
      title: original.title,
      notes: original.notes,
      whenDate: original.whenDate,
      timeOfDay: original.timeOfDay,
      scheduledTime: original.scheduledTime,
      deadline: original.deadline,
      projectId: original.projectId,
      areaId: original.areaId,
      sectionId: original.sectionId,
      isSomeday: original.isSomeday,
      recurrenceType: original.recurrenceType,
      recurrenceMode: original.recurrenceMode,
      recurrenceInterval: original.recurrenceInterval,
      recurrenceEndsAt: original.recurrenceEndsAt,
      position: newPosition,
      isCompleted: false,
      isCancelled: false,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  return ok(clone, 201);
}
