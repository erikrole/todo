"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AreaWithCounts, CreateAreaInput, UpdateAreaInput } from "@todo/shared";
import { api } from "@/lib/fetch";

export function useAreas(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ["areas"],
    queryFn: () => api.get<AreaWithCounts[]>("/api/areas"),
    ...options,
  });
}

export function useCreateArea() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateAreaInput) => api.post<AreaWithCounts>("/api/areas", data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["areas"] }),
  });
}

export function useUpdateArea() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: UpdateAreaInput & { id: string }) =>
      api.patch<AreaWithCounts>(`/api/areas/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["areas"] }),
  });
}

export function useDeleteArea() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<AreaWithCounts>(`/api/areas/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["areas"] });
      qc.invalidateQueries({ queryKey: ["projects"] });
    },
  });
}
