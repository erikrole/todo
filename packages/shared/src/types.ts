// ─── Areas ───────────────────────────────────────────────────────────────────

export interface Area {
  id: string;
  name: string;
  notes: string | null;
  color: string | null;
  isArchived: boolean;
  position: number;
  createdAt: string;
  updatedAt: string;
}

export interface AreaWithCounts extends Area {
  projectCount: number;
  taskCount: number;
}

// ─── Projects ────────────────────────────────────────────────────────────────

export interface Project {
  id: string;
  name: string;
  notes: string | null;
  color: string | null;
  areaId: string | null;
  parentProjectId: string | null;
  isCompleted: boolean;
  completedAt: string | null;
  position: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectWithCounts extends Project {
  taskCount: number;
}

// ─── Sections ────────────────────────────────────────────────────────────────

export interface Section {
  id: string;
  projectId: string;
  title: string;
  position: number;
  isCollapsed: boolean;
  createdAt: string;
  updatedAt: string;
}

// ─── Tasks ───────────────────────────────────────────────────────────────────

export type TimeOfDay = "morning" | "day" | "night";
export type RecurrenceType = "daily" | "weekly" | "monthly" | "yearly" | "custom" | "weekday" | "appointment";
/**
 * on_schedule: next when_date rolls forward from the original when_date (strict calendar schedule)
 * after_completion: next when_date = completion date + interval (Things 3 "after completion")
 */
export type RecurrenceMode = "on_schedule" | "after_completion";

export interface Task {
  id: string;
  title: string;
  notes: string | null;
  /** YYYY-MM-DD. Routes task to Today (= today) or Upcoming (> today). Null = Inbox (if unassigned). */
  whenDate: string | null;
  /** Groups within Today view. Null means unscheduled within Today. */
  timeOfDay: TimeOfDay | null;
  /** HH:MM in 24h format. Null = no scheduled time. */
  scheduledTime: string | null;
  /** YYYY-MM-DD. Separate from whenDate — drives deadline warning badges. */
  deadline: string | null;
  projectId: string | null;
  areaId: string | null;
  sectionId: string | null;
  parentTaskId: string | null;
  /** When true, task is in Someday and hidden from Inbox. Cleared when whenDate is set. */
  isSomeday: boolean;
  isCompleted: boolean;
  completedAt: string | null;
  isCancelled: boolean;
  deletedAt: string | null;
  recurrenceType: RecurrenceType | null;
  recurrenceMode: RecurrenceMode | null;
  /** Multiplier for recurrenceType, e.g. 2 = "every 2 weeks" */
  recurrenceInterval: number | null;
  /** Optional end date for recurrence series (YYYY-MM-DD) */
  recurrenceEndsAt: string | null;
  position: number;
  createdAt: string;
  updatedAt: string;
}

export interface TaskWithSubtasks extends Task {
  subtasks: Task[];
}

// ─── API ─────────────────────────────────────────────────────────────────────

export type TaskFilter = "inbox" | "today" | "today_all" | "upcoming" | "someday" | "completed" | "completed_today" | "overdue" | "trash" | "all" | "routines";

export interface ApiResponse<T> {
  data: T;
}

export interface ApiError {
  error: string;
}

// ─── Logs ────────────────────────────────────────────────────────────────────

export interface Log {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  isBuiltIn: boolean;
  position: number;
  createdAt: string;
  updatedAt: string;
}

export interface LogEntry {
  id: string;
  logId: string;
  loggedAt: string;
  numericValue: number | null;
  data: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

// ─── Occasions ───────────────────────────────────────────────────────────────

export interface Occasion {
  id: string;
  name: string;
  date: string;
  isAnnual: boolean;
  prepWindowDays: number;
  notes: string | null;
  emoji: string | null;
  occasionType: string;
  personName: string | null;
  startYear: number | null;
  position: number;
  createdAt: string;
  updatedAt: string;
}

// ─── Subscriptions ───────────────────────────────────────────────────────────

export interface Subscription {
  id: string;
  name: string;
  amount: number;
  billingPeriod: string;
  nextDueDate: string | null;
  category: string | null;
  autoRenew: boolean;
  isSplit: boolean;
  url: string | null;
  notes: string | null;
  isActive: boolean;
  position: number;
  createdAt: string;
  updatedAt: string;
}

// ─── Task Completions ────────────────────────────────────────────────────────

export interface TaskCompletion {
  id: string;
  taskId: string;
  completedAt: string;
  intervalActual: number | null;
  notes: string | null;
  createdAt: string;
}
