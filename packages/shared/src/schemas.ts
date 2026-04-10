import { z } from "zod";

// ─── Areas ───────────────────────────────────────────────────────────────────

export const CreateAreaSchema = z.object({
  name: z.string().min(1),
  notes: z.string().optional(),
  color: z.string().optional(),
  position: z.number().optional(),
});

export const UpdateAreaSchema = z.object({
  name: z.string().min(1).optional(),
  notes: z.string().nullable().optional(),
  color: z.string().nullable().optional(),
  isArchived: z.boolean().optional(),
  position: z.number().optional(),
});

// ─── Projects ────────────────────────────────────────────────────────────────

export const CreateProjectSchema = z.object({
  name: z.string().min(1),
  notes: z.string().optional(),
  color: z.string().optional(),
  areaId: z.string().optional(),
  position: z.number().optional(),
});

export const UpdateProjectSchema = z.object({
  name: z.string().min(1).optional(),
  notes: z.string().nullable().optional(),
  color: z.string().nullable().optional(),
  areaId: z.string().nullable().optional(),
  position: z.number().optional(),
});

// ─── Tasks ───────────────────────────────────────────────────────────────────

const TimeOfDaySchema = z.enum(["morning", "day", "night"]);
const RecurrenceTypeSchema = z.enum(["daily", "weekly", "monthly", "yearly", "custom"]);
const RecurrenceModeSchema = z.enum(["on_schedule", "after_completion"]);

/** YYYY-MM-DD */
const DateStringSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const CreateTaskSchema = z.object({
  title: z.string().min(1),
  notes: z.string().optional(),
  whenDate: DateStringSchema.optional(),
  timeOfDay: TimeOfDaySchema.optional(),
  deadline: DateStringSchema.optional(),
  isSomeday: z.boolean().optional(),
  projectId: z.string().optional(),
  areaId: z.string().optional(),
  parentTaskId: z.string().optional(),
  recurrenceType: RecurrenceTypeSchema.optional(),
  recurrenceMode: RecurrenceModeSchema.optional(),
  recurrenceInterval: z.number().int().positive().optional(),
  recurrenceEndsAt: DateStringSchema.optional(),
  position: z.number().optional(),
});

export const UpdateTaskSchema = z.object({
  title: z.string().min(1).optional(),
  notes: z.string().nullable().optional(),
  whenDate: DateStringSchema.nullable().optional(),
  timeOfDay: TimeOfDaySchema.nullable().optional(),
  deadline: DateStringSchema.nullable().optional(),
  isSomeday: z.boolean().optional(),
  isCancelled: z.boolean().optional(),
  projectId: z.string().nullable().optional(),
  areaId: z.string().nullable().optional(),
  parentTaskId: z.string().nullable().optional(),
  recurrenceType: RecurrenceTypeSchema.nullable().optional(),
  recurrenceMode: RecurrenceModeSchema.nullable().optional(),
  recurrenceInterval: z.number().int().positive().nullable().optional(),
  recurrenceEndsAt: DateStringSchema.nullable().optional(),
  position: z.number().optional(),
});

// ─── Exports ─────────────────────────────────────────────────────────────────

export type CreateAreaInput = z.infer<typeof CreateAreaSchema>;
export type UpdateAreaInput = z.infer<typeof UpdateAreaSchema>;
export type CreateProjectInput = z.infer<typeof CreateProjectSchema>;
export type UpdateProjectInput = z.infer<typeof UpdateProjectSchema>;
export type CreateTaskInput = z.infer<typeof CreateTaskSchema>;
export type UpdateTaskInput = z.infer<typeof UpdateTaskSchema>;
