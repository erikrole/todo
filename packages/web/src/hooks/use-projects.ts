"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ProjectWithCounts, CreateProjectInput, UpdateProjectInput } from "@todo/shared";
import { api } from "@/lib/fetch";

export function useProjects(areaId?: string) {
  const params = areaId ? `?areaId=${areaId}` : "";
  return useQuery({
    queryKey: ["projects", areaId],
    queryFn: () => api.get<ProjectWithCounts[]>(`/api/projects${params}`),
  });
}

export function useCreateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateProjectInput) => api.post<ProjectWithCounts>("/api/projects", data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["projects"] }),
  });
}

export function useUpdateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: UpdateProjectInput & { id: string }) =>
      api.patch<ProjectWithCounts>(`/api/projects/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["projects"] }),
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
    },
  });
}

export function useDeleteProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<ProjectWithCounts>(`/api/projects/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["projects"] }),
  });
}
