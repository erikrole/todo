"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ProjectWithCounts, CreateProjectInput, UpdateProjectInput } from "@todo/shared";
import { api } from "@/lib/fetch";
import { notify } from "@/lib/toast";

export function useProjects(areaId?: string, options?: { enabled?: boolean }) {
  const params = areaId ? `?areaId=${areaId}` : "";
  return useQuery({
    queryKey: ["projects", areaId],
    queryFn: () => api.get<ProjectWithCounts[]>(`/api/projects${params}`),
    ...options,
  });
}

export function useCreateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateProjectInput) => api.post<ProjectWithCounts>("/api/projects", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projects"] });
      notify.success("Project created");
    },
    onError: (err) => notify.error("Failed to create project", err),
  });
}

export function useUpdateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: UpdateProjectInput & { id: string }) =>
      api.patch<ProjectWithCounts>(`/api/projects/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["projects"] }),
    onError: (err) => notify.error("Failed to update project", err),
  });
}

export function useCompleteProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, completeAllTasks }: { id: string; completeAllTasks?: boolean }) =>
      api.post<ProjectWithCounts>(`/api/projects/${id}/complete`, { completeAllTasks }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projects"] });
      qc.invalidateQueries({ queryKey: ["tasks"] });
      notify.success("Project completed");
    },
    onError: (err) => notify.error("Failed to complete project", err),
  });
}

export function useDeleteProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<ProjectWithCounts>(`/api/projects/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projects"] });
      notify.success("Project deleted");
    },
    onError: (err) => notify.error("Failed to delete project", err),
  });
}
