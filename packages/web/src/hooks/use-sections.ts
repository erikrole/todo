"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Section, CreateSectionInput, UpdateSectionInput } from "@todo/shared";
import { api } from "@/lib/fetch";
import { notify } from "@/lib/toast";

export function useSections(projectId: string | undefined) {
  return useQuery({
    queryKey: ["sections", projectId],
    queryFn: () => api.get<Section[]>(`/api/sections?projectId=${projectId}`),
    enabled: !!projectId,
  });
}

export function useCreateSection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateSectionInput) => api.post<Section>("/api/sections", data),
    onSuccess: (section) => {
      qc.invalidateQueries({ queryKey: ["sections", section.projectId] });
      notify.success("Section created");
    },
    onError: (err) => notify.error("Failed to create section", err),
  });
}

export function useUpdateSection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, projectId, ...data }: UpdateSectionInput & { id: string; projectId: string }) =>
      api.patch<Section>(`/api/sections/${id}`, data),
    onSuccess: (section) => qc.invalidateQueries({ queryKey: ["sections", section.projectId] }),
    onError: (err) => notify.error("Failed to update section", err),
  });
}

export function useDeleteSection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: string; projectId: string }) =>
      api.delete<Section>(`/api/sections/${id}`),
    onSuccess: (_result, { projectId }) => {
      qc.invalidateQueries({ queryKey: ["sections", projectId] });
      qc.invalidateQueries({ queryKey: ["tasks"] });
      notify.success("Section deleted");
    },
    onError: (err) => notify.error("Failed to delete section", err),
  });
}
