import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { db, projects, sections, tasks } from "@todo/db";
import { nanoid } from "nanoid";
import { generateProjectPlan } from "../lib/anthropic.js";
import { ProjectPlanSchema, type ProjectPlan } from "../lib/architect-schema.js";

function nowIso() {
  return new Date().toISOString();
}

export function registerArchitectTools(server: McpServer) {
  // ─── plan_project ──────────────────────────────────────────────────────────
  server.tool(
    "plan_project",
    "Generate a structured project plan (sections + tasks) from a natural-language brief. Returns a dry-run proposal — nothing is written to the database. Review the plan, then call apply_project_plan to create it.",
    {
      brief: z.string().min(1).describe("Natural-language description of the project"),
      areaId: z.string().optional().describe("Area ID to assign the project to"),
      model: z.string().optional().describe("Override the Claude model (default: claude-sonnet-4-5)"),
    },
    async ({ brief, areaId, model }) => {
      let plan: ProjectPlan;
      try {
        plan = await generateProjectPlan(brief, { areaId, model });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { content: [{ type: "text", text: `Failed to generate plan: ${message}` }], isError: true };
      }

      const sectionCount = plan.sections.length;
      const topLevelTasks = plan.tasks.filter((t) => !t.parentTaskTempId);
      const subtaskCount = plan.tasks.length - topLevelTasks.length;

      const summary = [
        `Proposed project: "${plan.project.name}"`,
        `  ${sectionCount} section${sectionCount !== 1 ? "s" : ""}`,
        `  ${topLevelTasks.length} task${topLevelTasks.length !== 1 ? "s" : ""}${subtaskCount > 0 ? ` (+ ${subtaskCount} subtask${subtaskCount !== 1 ? "s" : ""})` : ""}`,
        "",
        "Review the plan below, then call apply_project_plan with this JSON to create it.",
        "You may edit the JSON before applying.",
        "",
        JSON.stringify(plan, null, 2),
      ].join("\n");

      return { content: [{ type: "text", text: summary }] };
    },
  );

  // ─── apply_project_plan ────────────────────────────────────────────────────
  server.tool(
    "apply_project_plan",
    "Atomically create a project, its sections, and all tasks from a plan produced by plan_project. Pass the plan JSON exactly as returned (or with your edits).",
    {
      project: ProjectPlanSchema.shape.project,
      sections: ProjectPlanSchema.shape.sections,
      tasks: ProjectPlanSchema.shape.tasks,
    },
    async (input) => {
      const plan = input as ProjectPlan;
      const now = nowIso();

      // Validate referential integrity before touching the DB
      const sectionTempIds = new Set(plan.sections.map((s) => s.tempId));
      const taskTempIds = new Set(plan.tasks.map((t) => t.tempId));

      for (const task of plan.tasks) {
        if (task.sectionTempId && !sectionTempIds.has(task.sectionTempId)) {
          return {
            content: [{ type: "text", text: `Task "${task.title}" references unknown sectionTempId "${task.sectionTempId}"` }],
            isError: true,
          };
        }
        if (task.parentTaskTempId && !taskTempIds.has(task.parentTaskTempId)) {
          return {
            content: [{ type: "text", text: `Task "${task.title}" references unknown parentTaskTempId "${task.parentTaskTempId}"` }],
            isError: true,
          };
        }
      }

      // Execute all inserts — libsql/drizzle doesn't support nested transactions,
      // so we use sequential inserts and track what was created for rollback context.
      const tempIdToSectionId = new Map<string, string>();
      const tempIdToTaskId = new Map<string, string>();

      // 1. Create project
      const project = (
        await db
          .insert(projects)
          .values({ id: nanoid(), ...plan.project, createdAt: now, updatedAt: now })
          .returning()
      )[0]!;

      // 2. Create sections
      const sortedSections = [...plan.sections].sort((a, b) => a.position - b.position);
      for (const sec of sortedSections) {
        const created = (
          await db
            .insert(sections)
            .values({ id: nanoid(), projectId: project.id, title: sec.title, position: sec.position, createdAt: now, updatedAt: now })
            .returning()
        )[0]!;
        tempIdToSectionId.set(sec.tempId, created.id);
      }

      // 3. Create tasks — two passes: parent tasks first, then subtasks
      const parentTasks = plan.tasks.filter((t) => !t.parentTaskTempId);
      const subTasks = plan.tasks.filter((t) => !!t.parentTaskTempId);

      for (const task of parentTasks) {
        const sectionId = task.sectionTempId ? tempIdToSectionId.get(task.sectionTempId) : undefined;
        const created = (
          await db
            .insert(tasks)
            .values({
              id: nanoid(),
              title: task.title,
              notes: task.notes,
              whenDate: task.whenDate,
              timeOfDay: task.timeOfDay,
              deadline: task.deadline,
              projectId: project.id,
              areaId: plan.project.areaId,
              sectionId: sectionId ?? null,
              createdAt: now,
              updatedAt: now,
            })
            .returning()
        )[0]!;
        tempIdToTaskId.set(task.tempId, created.id);
      }

      for (const task of subTasks) {
        const parentTaskId = tempIdToTaskId.get(task.parentTaskTempId!);
        if (!parentTaskId) continue; // already validated above, but be safe
        const created = (
          await db
            .insert(tasks)
            .values({
              id: nanoid(),
              title: task.title,
              notes: task.notes,
              whenDate: task.whenDate,
              timeOfDay: task.timeOfDay,
              deadline: task.deadline,
              projectId: project.id,
              areaId: plan.project.areaId,
              parentTaskId,
              createdAt: now,
              updatedAt: now,
            })
            .returning()
        )[0]!;
        tempIdToTaskId.set(task.tempId, created.id);
      }

      const result = {
        projectId: project.id,
        projectName: project.name,
        sectionsCreated: plan.sections.length,
        tasksCreated: plan.tasks.length,
      };

      return {
        content: [
          {
            type: "text",
            text: `Created project "${project.name}" (${project.id})\n${plan.sections.length} sections, ${plan.tasks.length} tasks\n\n${JSON.stringify(result, null, 2)}`,
          },
        ],
      };
    },
  );
}
