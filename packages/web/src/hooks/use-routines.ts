"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/fetch";
import { notify } from "@/lib/toast";
import type { Task } from "@todo/db";

export type Routine = Task & {
  lastCompletedAt: string | null;
  areaName: string | null;
  areaColor: string | null;
};

export function useRoutines() {
  return useQuery({
    queryKey: ["routines"],
    queryFn: () => api.get<Routine[]>("/api/routines"),
  });
}

export function useUpdateRoutine() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Record<string, unknown>) =>
      api.patch<Task>(`/api/routines/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["routines"] }),
    onError: (err) => notify.error("Failed to update routine", err),
  });
}

export function useDeleteRoutine() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/api/routines/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["routines"] });
      notify.success("Routine deleted");
    },
    onError: (err) => notify.error("Failed to delete routine", err),
  });
}

export function useCreateRoutine() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => api.post<Task>("/api/tasks", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["routines"] });
      qc.invalidateQueries({ queryKey: ["tasks"] });
      notify.success("Routine created");
    },
    onError: (err) => notify.error("Failed to create routine", err),
  });
}
