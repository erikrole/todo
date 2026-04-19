import { index, integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

// ─── Areas ───────────────────────────────────────────────────────────────────

export const areas = sqliteTable("areas", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  notes: text("notes"),
  color: text("color"),
  isArchived: integer("is_archived", { mode: "boolean" }).default(false).notNull(),
  position: real("position").default(0).notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

// ─── Projects ────────────────────────────────────────────────────────────────

export const projects = sqliteTable(
  "projects",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    notes: text("notes"),
    color: text("color"),
    areaId: text("area_id").references(() => areas.id, { onDelete: "set null" }),
    parentProjectId: text("parent_project_id").references((): ReturnType<typeof text> => projects.id, { onDelete: "cascade" }),
    isCompleted: integer("is_completed", { mode: "boolean" }).default(false).notNull(),
    completedAt: text("completed_at"),
    position: real("position").default(0).notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => [
    index("idx_projects_area_id").on(t.areaId),
    index("idx_projects_is_completed").on(t.isCompleted),
    index("idx_projects_parent_project_id").on(t.parentProjectId),
  ],
);

// ─── Sections ────────────────────────────────────────────────────────────────

export const sections = sqliteTable(
  "sections",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    position: real("position").default(0).notNull(),
    isCollapsed: integer("is_collapsed", { mode: "boolean" }).default(false).notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => [
    index("idx_sections_project_id").on(t.projectId),
  ],
);

// ─── Tasks ───────────────────────────────────────────────────────────────────

export const tasks = sqliteTable(
  "tasks",
  {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    notes: text("notes"),
    whenDate: text("when_date"),
    timeOfDay: text("time_of_day"),
    scheduledTime: text("scheduled_time"),
    deadline: text("deadline"),
    projectId: text("project_id").references(() => projects.id, { onDelete: "set null" }),
    areaId: text("area_id").references(() => areas.id, { onDelete: "set null" }),
    sectionId: text("section_id").references(() => sections.id, { onDelete: "set null" }),
    parentTaskId: text("parent_task_id"),
    spawnedFromTaskId: text("spawned_from_task_id"),
    isSomeday: integer("is_someday", { mode: "boolean" }).default(false).notNull(),
    isCompleted: integer("is_completed", { mode: "boolean" }).default(false).notNull(),
    completedAt: text("completed_at"),
    isCancelled: integer("is_cancelled", { mode: "boolean" }).default(false).notNull(),
    deletedAt: text("deleted_at"),
    recurrenceType: text("recurrence_type"),
    recurrenceMode: text("recurrence_mode"),
    recurrenceInterval: integer("recurrence_interval"),
    recurrenceEndsAt: text("recurrence_ends_at"),
    position: real("position").default(0).notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => [
    index("idx_tasks_project_id").on(t.projectId),
    index("idx_tasks_area_id").on(t.areaId),
    index("idx_tasks_section_id").on(t.sectionId),
    index("idx_tasks_parent_task_id").on(t.parentTaskId),
    index("idx_tasks_when_date").on(t.whenDate),
    index("idx_tasks_is_completed").on(t.isCompleted),
    index("idx_tasks_is_someday").on(t.isSomeday),
    index("idx_tasks_is_cancelled").on(t.isCancelled),
    index("idx_tasks_deleted_at").on(t.deletedAt),
  ],
);

// ─── Task Completions ────────────────────────────────────────────────────────

export const taskCompletions = sqliteTable(
  "task_completions",
  {
    id: text("id").primaryKey(),
    taskId: text("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
    completedAt: text("completed_at").notNull(),
    intervalActual: real("interval_actual"),
    notes: text("notes"),
    createdAt: text("created_at").notNull(),
  },
  (t) => [
    index("idx_task_completions_task_id").on(t.taskId),
    index("idx_task_completions_completed_at").on(t.completedAt),
  ],
);

// ─── Logs ────────────────────────────────────────────────────────────────────

export const logs = sqliteTable("logs", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  icon: text("icon"),
  color: text("color"),
  isBuiltIn: integer("is_built_in", { mode: "boolean" }).default(false).notNull(),
  position: real("position").default(0).notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const logEntries = sqliteTable(
  "log_entries",
  {
    id: text("id").primaryKey(),
    logId: text("log_id").notNull().references(() => logs.id, { onDelete: "cascade" }),
    loggedAt: text("logged_at").notNull(),
    numericValue: real("numeric_value"),
    data: text("data"),
    notes: text("notes"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => [
    index("idx_log_entries_log_id").on(t.logId),
    index("idx_log_entries_logged_at").on(t.loggedAt),
  ],
);

// ─── Subscriptions ────────────────────────────────────────────────────────────

export const subscriptions = sqliteTable(
  "subscriptions",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    amount: real("amount").notNull(),
    billingPeriod: text("billing_period").notNull(),
    nextDueDate: text("next_due_date"),
    category: text("category"),
    autoRenew: integer("auto_renew", { mode: "boolean" }).default(true).notNull(),
    isSplit: integer("is_split", { mode: "boolean" }).default(false).notNull(),
    url: text("url"),
    notes: text("notes"),
    isActive: integer("is_active", { mode: "boolean" }).default(true).notNull(),
    position: real("position").default(0).notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => [
    index("idx_subscriptions_next_due_date").on(t.nextDueDate),
    index("idx_subscriptions_is_active").on(t.isActive),
  ],
);

// ─── Occasions ────────────────────────────────────────────────────────────────

export const occasions = sqliteTable(
  "occasions",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    date: text("date").notNull(),
    isAnnual: integer("is_annual", { mode: "boolean" }).default(true).notNull(),
    prepWindowDays: integer("prep_window_days").default(0).notNull(),
    notes: text("notes"),
    emoji: text("emoji"),
    occasionType: text("occasion_type").default("event").notNull(),
    personName: text("person_name"),
    startYear: integer("start_year"),
    position: real("position").default(0).notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => [
    index("idx_occasions_date").on(t.date),
  ],
);

export type Area = typeof areas.$inferSelect;
export type NewArea = typeof areas.$inferInsert;
export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
export type Section = typeof sections.$inferSelect;
export type NewSection = typeof sections.$inferInsert;
export type Task = typeof tasks.$inferSelect;
export type NewTask = typeof tasks.$inferInsert;
export type TaskCompletion = typeof taskCompletions.$inferSelect;
export type NewTaskCompletion = typeof taskCompletions.$inferInsert;
export type Log = typeof logs.$inferSelect;
export type NewLog = typeof logs.$inferInsert;
export type LogEntry = typeof logEntries.$inferSelect;
export type NewLogEntry = typeof logEntries.$inferInsert;
export type Subscription = typeof subscriptions.$inferSelect;
export type NewSubscription = typeof subscriptions.$inferInsert;
export type Occasion = typeof occasions.$inferSelect;
export type NewOccasion = typeof occasions.$inferInsert;
