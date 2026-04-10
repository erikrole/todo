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

export type Area = typeof areas.$inferSelect;
export type NewArea = typeof areas.$inferInsert;
export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
export type Section = typeof sections.$inferSelect;
export type NewSection = typeof sections.$inferInsert;
export type Task = typeof tasks.$inferSelect;
export type NewTask = typeof tasks.$inferInsert;
