"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Occasion } from "@todo/db";
import type { CreateOccasionInput, UpdateOccasionInput } from "@todo/shared";
import { api } from "@/lib/fetch";
import { notify } from "@/lib/toast";

export function useOccasions() {
  return useQuery({
    queryKey: ["occasions"],
    queryFn: () => api.get<Occasion[]>("/api/occasions"),
  });
}

export function useCreateOccasion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateOccasionInput) => api.post<Occasion>("/api/occasions", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["occasions"] });
      notify.success("Occasion added");
    },
    onError: (err) => notify.error("Failed to add occasion", err),
  });
}

export function useUpdateOccasion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: UpdateOccasionInput & { id: string }) =>
      api.patch<Occasion>(`/api/occasions/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["occasions"] }),
    onError: (err) => notify.error("Failed to update occasion", err),
  });
}

export function useDeleteOccasion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/api/occasions/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["occasions"] });
      notify.success("Occasion deleted");
    },
    onError: (err) => notify.error("Failed to delete occasion", err),
  });
}
