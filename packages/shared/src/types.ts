export interface Task {
  id: string;
  title: string;
  notes: string | null;
  dueDate: string | null;
  projectId: string | null;
  isCompleted: boolean;
  completedAt: string | null;
  position: number;
  createdAt: string;
  updatedAt: string;
}

export interface Project {
  id: string;
  name: string;
  notes: string | null;
  color: string | null;
  isCompleted: boolean;
  completedAt: string | null;
  position: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectWithCounts extends Project {
  taskCount: number;
}

export type TaskFilter = "inbox" | "today" | "upcoming" | "completed" | "all";

export interface ApiResponse<T> {
  data: T;
}
