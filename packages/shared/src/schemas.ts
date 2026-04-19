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
  parentProjectId: z.string().optional(),
  position: z.number().optional(),
});

export const UpdateProjectSchema = z.object({
  name: z.string().min(1).optional(),
  notes: z.string().nullable().optional(),
  color: z.string().nullable().optional(),
  areaId: z.string().nullable().optional(),
  parentProjectId: z.string().nullable().optional(),
  position: z.number().optional(),
});

// ─── Sections ────────────────────────────────────────────────────────────────

export const CreateSectionSchema = z.object({
  projectId: z.string().min(1),
  title: z.string().min(1),
  position: z.number().optional(),
});

export const UpdateSectionSchema = z.object({
  title: z.string().min(1).optional(),
  position: z.number().optional(),
  isCollapsed: z.boolean().optional(),
});

// ─── Tasks ───────────────────────────────────────────────────────────────────

const TimeOfDaySchema = z.enum(["morning", "day", "night"]);
const RecurrenceTypeSchema = z.enum(["daily", "weekly", "monthly", "yearly", "custom", "weekday", "appointment"]);
const RecurrenceModeSchema = z.enum(["on_schedule", "after_completion"]);

/** YYYY-MM-DD */
const DateStringSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const CreateTaskSchema = z.object({
  title: z.string().min(1),
  notes: z.string().optional(),
  whenDate: DateStringSchema.optional(),
  timeOfDay: TimeOfDaySchema.optional(),
  scheduledTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  deadline: DateStringSchema.optional(),
  isSomeday: z.boolean().optional(),
  projectId: z.string().optional(),
  areaId: z.string().optional(),
  sectionId: z.string().optional(),
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
  scheduledTime: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
  deadline: DateStringSchema.nullable().optional(),
  isSomeday: z.boolean().optional(),
  isCancelled: z.boolean().optional(),
  projectId: z.string().nullable().optional(),
  areaId: z.string().nullable().optional(),
  sectionId: z.string().nullable().optional(),
  parentTaskId: z.string().nullable().optional(),
  recurrenceType: RecurrenceTypeSchema.nullable().optional(),
  recurrenceMode: RecurrenceModeSchema.nullable().optional(),
  recurrenceInterval: z.number().int().positive().nullable().optional(),
  recurrenceEndsAt: DateStringSchema.nullable().optional(),
  position: z.number().optional(),
});

// ─── Batch task actions ───────────────────────────────────────────────────────

export const BatchTaskActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("complete"), ids: z.array(z.string()).min(1) }),
  z.object({ action: z.literal("uncomplete"), ids: z.array(z.string()).min(1) }),
  z.object({ action: z.literal("delete"), ids: z.array(z.string()).min(1) }),
  z.object({ action: z.literal("restore"), ids: z.array(z.string()).min(1) }),
  z.object({
    action: z.literal("update"),
    ids: z.array(z.string()).min(1),
    patch: UpdateTaskSchema,
  }),
]);
export type BatchTaskAction = z.infer<typeof BatchTaskActionSchema>;

// ─── Logs ────────────────────────────────────────────────────────────────────

export const CreateLogSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/),
  description: z.string().optional(),
  icon: z.string().optional(),
  color: z.string().optional(),
  position: z.number().optional(),
});

export const UpdateLogSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  icon: z.string().nullable().optional(),
  color: z.string().nullable().optional(),
  position: z.number().optional(),
});

export const CreateLogEntrySchema = z.object({
  logId: z.string().min(1),
  loggedAt: DateStringSchema,
  numericValue: z.number().nullable().optional(),
  data: z.record(z.unknown()).optional(),
  notes: z.string().optional(),
});

export const UpdateLogEntrySchema = z.object({
  loggedAt: DateStringSchema.optional(),
  numericValue: z.number().nullable().optional(),
  data: z.record(z.unknown()).optional(),
  notes: z.string().nullable().optional(),
});

// ─── Subscriptions ────────────────────────────────────────────────────────────

const BillingPeriodSchema = z.enum(["weekly", "monthly", "annual"]);

export const CreateSubscriptionSchema = z.object({
  name: z.string().min(1),
  amount: z.number().positive(),
  billingPeriod: BillingPeriodSchema,
  nextDueDate: DateStringSchema.optional(),
  category: z.string().optional(),
  autoRenew: z.boolean().optional(),
  isSplit: z.boolean().optional(),
  url: z.string().url().optional().or(z.literal("")),
  notes: z.string().optional(),
  position: z.number().optional(),
});

export const UpdateSubscriptionSchema = z.object({
  name: z.string().min(1).optional(),
  amount: z.number().positive().optional(),
  billingPeriod: BillingPeriodSchema.optional(),
  nextDueDate: DateStringSchema.nullable().optional(),
  category: z.string().nullable().optional(),
  autoRenew: z.boolean().optional(),
  isSplit: z.boolean().optional(),
  url: z.string().url().nullable().optional().or(z.literal("")).or(z.null()),
  notes: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
  position: z.number().optional(),
});

// ─── Occasions ────────────────────────────────────────────────────────────────

export const OccasionTypeSchema = z.enum(["birthday", "anniversary", "sports", "holiday", "event"]);

export const CreateOccasionSchema = z.object({
  name: z.string().min(1),
  date: DateStringSchema,
  occasionType: OccasionTypeSchema.optional(),
  personName: z.string().optional(),
  startYear: z.number().int().optional(),
  isAnnual: z.boolean().optional(),
  prepWindowDays: z.number().int().min(0).optional(),
  notes: z.string().optional(),
  emoji: z.string().optional(),
  position: z.number().optional(),
});

export const UpdateOccasionSchema = z.object({
  name: z.string().min(1).optional(),
  date: DateStringSchema.optional(),
  occasionType: OccasionTypeSchema.optional(),
  personName: z.string().nullable().optional(),
  startYear: z.number().int().nullable().optional(),
  isAnnual: z.boolean().optional(),
  prepWindowDays: z.number().int().min(0).optional(),
  notes: z.string().nullable().optional(),
  emoji: z.string().nullable().optional(),
  position: z.number().optional(),
});

// ─── Exports ─────────────────────────────────────────────────────────────────

export type CreateAreaInput = z.infer<typeof CreateAreaSchema>;
export type UpdateAreaInput = z.infer<typeof UpdateAreaSchema>;
export type CreateProjectInput = z.infer<typeof CreateProjectSchema>;
export type UpdateProjectInput = z.infer<typeof UpdateProjectSchema>;
export type CreateSectionInput = z.infer<typeof CreateSectionSchema>;
export type UpdateSectionInput = z.infer<typeof UpdateSectionSchema>;
export type CreateTaskInput = z.infer<typeof CreateTaskSchema>;
export type UpdateTaskInput = z.infer<typeof UpdateTaskSchema>;
export type CreateLogInput = z.infer<typeof CreateLogSchema>;
export type UpdateLogInput = z.infer<typeof UpdateLogSchema>;
export type CreateLogEntryInput = z.infer<typeof CreateLogEntrySchema>;
export type UpdateLogEntryInput = z.infer<typeof UpdateLogEntrySchema>;
export type CreateSubscriptionInput = z.infer<typeof CreateSubscriptionSchema>;
export type UpdateSubscriptionInput = z.infer<typeof UpdateSubscriptionSchema>;
export type CreateOccasionInput = z.infer<typeof CreateOccasionSchema>;
export type UpdateOccasionInput = z.infer<typeof UpdateOccasionSchema>;
