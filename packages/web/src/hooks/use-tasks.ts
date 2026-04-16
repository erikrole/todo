"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Task, TaskFilter, CreateTaskInput, UpdateTaskInput, BatchTaskAction } from "@todo/shared";
import { api } from "@/lib/fetch";
import { notify } from "@/lib/toast";
import { toLocalDateStr } from "@/lib/dates";

function localDateStr() {
  return toLocalDateStr(new Date());
}

function taskKeys(filter?: TaskFilter, projectId?: string, areaId?: string) {
  return ["tasks", filter, projectId, areaId] as const;
}

export function useTasks(filter: TaskFilter = "all", projectId?: string, areaId?: string, options?: { enabled?: boolean }) {
  const params = new URLSearchParams({ filter, date: localDateStr() });
  if (projectId) params.set("projectId", projectId);
  if (areaId) params.set("areaId", areaId);

  return useQuery({
    queryKey: taskKeys(filter, projectId, areaId),
    queryFn: () => api.get<Task[]>(`/api/tasks?${params}`),
    ...options,
  });
}

export function useTask(id: string) {
  return useQuery({
    queryKey: ["task", id],
    queryFn: () => api.get<Task & { subtasks: Task[] }>(`/api/tasks/${id}`),
    enabled: !!id,
  });
}

export interface TaskCounts {
  inbox: number;
  today: number;
  overdue: number;
}

export function useTaskCounts() {
  return useQuery({
    queryKey: ["task-counts"] as const,
    queryFn: () => api.get<TaskCounts>(`/api/tasks/counts?date=${localDateStr()}`),
    staleTime: 60_000,
  });
}

export function useCreateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateTaskInput) => api.post<Task>("/api/tasks", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
      notify.success("Task created");
    },
    onError: (err) => notify.error("Failed to create task", err),
  });
}

export function useUpdateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: UpdateTaskInput & { id: string }) =>
      api.patch<Task>(`/api/tasks/${id}`, data),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["task", vars.id] });
    },
    onError: (err) => notify.error("Failed to update task", err),
  });
}

export interface CompleteTaskInput {
  id: string;
  notes?: string;
  completedAt?: string;
}

export function useCompleteTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, notes, completedAt }: CompleteTaskInput) =>
      api.post<Task>(`/api/tasks/${id}/complete?date=${localDateStr()}`, { notes, completedAt }),
    onMutate: async ({ id }) => {
      await qc.cancelQueries({ queryKey: ["tasks"] });
      const snapshots = qc.getQueriesData<Task[]>({ queryKey: ["tasks"] });
      const now = new Date().toISOString();
      snapshots.forEach(([key, data]) => {
        const filter = (key as unknown[])[1];
        if (filter === "today_all") {
          qc.setQueryData(key, data?.map((t) => (t.id === id ? { ...t, isCompleted: true, completedAt: now } : t)));
        } else {
          qc.setQueryData(key, data?.filter((t) => t.id !== id));
        }
      });
      return { snapshots };
    },
    onError: (_err, _vars, ctx) => {
      ctx?.snapshots.forEach(([key, data]) => qc.setQueryData(key, data));
    },
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["task", id] });
      qc.invalidateQueries({ queryKey: ["task-completions"] });
    },
  });
}

export function useUncompleteTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post<Task>(`/api/tasks/${id}/uncomplete`, {}),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ["tasks"] });
      const snapshots = qc.getQueriesData<Task[]>({ queryKey: ["tasks"] });
      // today_all shows active + completed tasks — update in-place; other filters can rely on invalidation
      snapshots.forEach(([key, data]) => {
        const filter = (key as unknown[])[1];
        if (filter === "today_all") {
          qc.setQueryData(key, data?.map((t) => (t.id === id ? { ...t, isCompleted: false, completedAt: null } : t)));
        }
      });
      return { snapshots };
    },
    onError: (err, _id, ctx) => {
      ctx?.snapshots.forEach(([key, data]) => qc.setQueryData(key, data));
      notify.error("Failed to undo completion", err);
    },
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["task", id] });
    },
  });
}

export function useDeleteTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<Task>(`/api/tasks/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
    onError: (err) => notify.error("Failed to delete task", err),
  });
}

export function useRestoreTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post<Task>(`/api/tasks/${id}/restore`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
      notify.success("Task restored");
    },
    onError: (err) => notify.error("Failed to restore task", err),
  });
}

export function useDeleteTaskPermanent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<Task>(`/api/tasks/${id}?permanent=true`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
      notify.success("Deleted forever");
    },
    onError: (err) => notify.error("Failed to delete task", err),
  });
}

export function useDuplicateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post<Task>(`/api/tasks/${id}/duplicate`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
    onError: (err) => notify.error("Failed to duplicate task", err),
  });
}

export function useBatchTaskAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (action: BatchTaskAction) => api.post<{ updated: number }>("/api/tasks/batch", action),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
    onError: (err) => notify.error("Bulk action failed", err),
  });
}

export function usePurgeTrashedTasks() {
  return useMutation({
    mutationFn: () => api.post<{ purged: number }>("/api/tasks/purge", {}),
  });
}
