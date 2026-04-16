"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/fetch";
import type { Task } from "@todo/shared";

export interface RoutineStats {
  lastCompletedAt: string | null;
  avgDays: number | null;
}

export interface RoutineTask extends Task {
  stats: RoutineStats;
}

export function useRoutines() {
  // Fetch all root recurring tasks (filter=routines)
  const tasksQuery = useQuery({
    queryKey: ["tasks", "routines"],
    queryFn: () => api.get<Task[]>("/api/tasks?filter=routines"),
  });

  return tasksQuery;
}
