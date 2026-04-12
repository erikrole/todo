import { z } from "zod";

export const SectionPlanSchema = z.object({
  tempId: z.string().describe("Temporary ID used to reference this section in task.sectionTempId"),
  title: z.string().min(1).describe("Section title"),
  position: z.number().describe("Display order, starting at 1"),
});

export const TaskPlanSchema = z.object({
  tempId: z.string().describe("Temporary ID used to reference this task in parentTaskTempId"),
  title: z.string().min(1).describe("Task title"),
  notes: z.string().optional().describe("Additional notes or details"),
  whenDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("Schedule date YYYY-MM-DD"),
  timeOfDay: z.enum(["morning", "day", "night"]).optional(),
  deadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("Hard deadline YYYY-MM-DD — only set if explicitly mentioned"),
  sectionTempId: z.string().optional().describe("tempId of the section this task belongs to"),
  parentTaskTempId: z.string().optional().describe("tempId of the parent task (for subtasks)"),
});

export const ProjectPlanSchema = z.object({
  project: z.object({
    name: z.string().min(1).describe("Project name"),
    notes: z.string().optional(),
    color: z.string().optional().describe("Hex color code e.g. #3b82f6"),
    areaId: z.string().optional().describe("Area ID to assign project to — only set if provided"),
  }),
  sections: z.array(SectionPlanSchema).describe("Sections to create within the project (can be empty)"),
  tasks: z.array(TaskPlanSchema).describe("Tasks to create — top-level tasks and subtasks"),
});

export type ProjectPlan = z.infer<typeof ProjectPlanSchema>;
export type SectionPlan = z.infer<typeof SectionPlanSchema>;
export type TaskPlan = z.infer<typeof TaskPlanSchema>;
