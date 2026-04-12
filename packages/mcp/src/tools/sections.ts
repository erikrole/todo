import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { db, sections, tasks } from "@todo/db";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";

function nowIso() {
  return new Date().toISOString();
}

export function registerSectionTools(server: McpServer) {
  // ─── list_sections ─────────────────────────────────────────────────────────
  server.tool(
    "list_sections",
    "List all sections in a project, ordered by position",
    { projectId: z.string().describe("Project ID") },
    async ({ projectId }) => {
      const rows = await db.select().from(sections).where(eq(sections.projectId, projectId));
      rows.sort((a, b) => a.position - b.position);
      return { content: [{ type: "text", text: JSON.stringify(rows, null, 2) }] };
    },
  );

  // ─── create_section ────────────────────────────────────────────────────────
  server.tool(
    "create_section",
    "Create a new section within a project",
    {
      projectId: z.string().describe("Project ID"),
      title: z.string().min(1).describe("Section title"),
      position: z.number().optional().describe("Fractional position (defaults to 0)"),
    },
    async ({ projectId, title, position }) => {
      const now = nowIso();
      const [section] = await db
        .insert(sections)
        .values({ id: nanoid(), projectId, title, position: position ?? 0, createdAt: now, updatedAt: now })
        .returning();
      return { content: [{ type: "text", text: JSON.stringify(section, null, 2) }] };
    },
  );

  // ─── update_section ────────────────────────────────────────────────────────
  server.tool(
    "update_section",
    "Update a section's title, position, or collapsed state",
    {
      id: z.string().describe("Section ID"),
      title: z.string().optional(),
      position: z.number().optional(),
      isCollapsed: z.boolean().optional(),
    },
    async ({ id, ...fields }) => {
      const [section] = await db
        .update(sections)
        .set({ ...fields, updatedAt: nowIso() })
        .where(eq(sections.id, id))
        .returning();
      if (!section) return { content: [{ type: "text", text: `Section ${id} not found` }], isError: true };
      return { content: [{ type: "text", text: JSON.stringify(section, null, 2) }] };
    },
  );

  // ─── delete_section ────────────────────────────────────────────────────────
  server.tool(
    "delete_section",
    "Delete a section (tasks in the section are unassigned from it, not deleted)",
    { id: z.string().describe("Section ID") },
    async ({ id }) => {
      await db.update(tasks).set({ sectionId: null }).where(eq(tasks.sectionId, id));
      const [section] = await db.delete(sections).where(eq(sections.id, id)).returning();
      if (!section) return { content: [{ type: "text", text: `Section ${id} not found` }], isError: true };
      return { content: [{ type: "text", text: `Deleted section ${id}` }] };
    },
  );
}
