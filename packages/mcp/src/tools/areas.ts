import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { db, areas, projects, tasks } from "@todo/db";
import { eq, and, count } from "drizzle-orm";

export function registerAreaTools(server: McpServer) {
  server.tool(
    "list_areas",
    "List all active (non-archived) areas with project and task counts",
    {},
    async () => {
      const rows = await db
        .select({
          id: areas.id,
          name: areas.name,
          notes: areas.notes,
          color: areas.color,
          isArchived: areas.isArchived,
          position: areas.position,
          projectCount: count(projects.id),
        })
        .from(areas)
        .leftJoin(projects, and(eq(projects.areaId, areas.id), eq(projects.isCompleted, false)))
        .where(eq(areas.isArchived, false))
        .groupBy(areas.id);

      return { content: [{ type: "text", text: JSON.stringify(rows, null, 2) }] };
    },
  );
}
