import type {
  Area,
  Log,
  LogEntry,
  Occasion,
  Project,
  Section,
  Subscription,
  Task,
  TaskCompletion,
} from "./types";

export interface ExportPayload {
  exportedAt: string;
  areas: Area[];
  projects: Project[];
  sections: Section[];
  tasks: Task[];
  taskCompletions: TaskCompletion[];
  logs: Log[];
  logEntries: LogEntry[];
  occasions: Occasion[];
  subscriptions: Subscription[];
}
