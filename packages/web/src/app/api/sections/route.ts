import { db, sections } from "@todo/db";
import { CreateSectionSchema } from "@todo/shared";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { err, nowIso, ok } from "@/lib/api";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId");
  if (!projectId) return err("projectId is required");

  const rows = await db
    .select()
    .from(sections)
    .where(eq(sections.projectId, projectId))
    .orderBy(sections.position);

  return ok(rows);
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = CreateSectionSchema.safeParse(body);
  if (!parsed.success) return err(parsed.error.message);

  const now = nowIso();
  const position = parsed.data.position ?? 0;
  const [section] = await db
    .insert(sections)
    .values({ id: nanoid(), ...parsed.data, position, createdAt: now, updatedAt: now })
    .returning();

  return ok(section, 201);
}
