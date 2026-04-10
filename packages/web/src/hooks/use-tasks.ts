"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Task, TaskFilter, CreateTaskInput, UpdateTaskInput } from "@todo/shared";
import { api } from "@/lib/fetch";

function taskKeys(filter?: TaskFilter, projectId?: string, areaId?: string) {
  return ["tasks", filter, projectId, areaId] as const;
}

export function useTasks(filter: TaskFilter = "all", projectId?: string, areaId?: string) {
  const params = new URLSearchParams({ filter });
  if (projectId) params.set("projectId", projectId);
  if (areaId) params.set("areaId", areaId);

  return useQuery({
    queryKey: taskKeys(filter, projectId, areaId),
    queryFn: () => api.get<Task[]>(`/api/tasks?${params}`),
  });
}

export function useTask(id: string) {
  return useQuery({
    queryKey: ["task", id],
    queryFn: () => api.get<Task & { subtasks: Task[] }>(`/api/tasks/${id}`),
    enabled: !!id,
  });
}

export function useCreateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateTaskInput) => api.post<Task>("/api/tasks", data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
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
  });
}

export function useCompleteTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post<Task>(`/api/tasks/${id}/complete`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  });
}

export function useDeleteTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<Task>(`/api/tasks/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  });
}
