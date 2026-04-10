import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { db, projects, tasks } from "@todo/db";
import { eq, and, count } from "drizzle-orm";
import { nanoid } from "nanoid";

function nowIso() {
  return new Date().toISOString();
}

export function registerProjectTools(server: McpServer) {
  // ─── list_projects ─────────────────────────────────────────────────────────
  server.tool(
    "list_projects",
    "List all active projects with task counts, optionally filtered by area",
    { areaId: z.string().optional().describe("Filter by area ID") },
    async ({ areaId }) => {
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
          taskCount: count(tasks.id),
        })
        .from(projects)
        .leftJoin(tasks, and(eq(tasks.projectId, projects.id), eq(tasks.isCompleted, false)))
        .where(areaId ? eq(projects.areaId, areaId) : undefined)
        .groupBy(projects.id);
      return { content: [{ type: "text", text: JSON.stringify(rows, null, 2) }] };
    },
  );

  // ─── create_project ────────────────────────────────────────────────────────
  server.tool(
    "create_project",
    "Create a new project",
    {
      name: z.string().min(1),
      notes: z.string().optional(),
      color: z.string().optional(),
      areaId: z.string().optional(),
    },
    async (input) => {
      const now = nowIso();
      const [project] = await db
        .insert(projects)
        .values({ id: nanoid(), ...input, createdAt: now, updatedAt: now })
        .returning();
      return { content: [{ type: "text", text: JSON.stringify(project, null, 2) }] };
    },
  );

  // ─── complete_project ──────────────────────────────────────────────────────
  server.tool(
    "complete_project",
    "Mark a project complete. Optionally complete all its open tasks too.",
    {
      id: z.string(),
      completeAllTasks: z.boolean().default(false).describe("Also complete all open tasks in this project"),
    },
    async ({ id, completeAllTasks }) => {
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

      if (!project) return { content: [{ type: "text", text: `Project ${id} not found` }], isError: true };
      return { content: [{ type: "text", text: JSON.stringify(project, null, 2) }] };
    },
  );
}
