"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Log, LogEntry } from "@todo/db";
import type { CreateLogEntryInput, UpdateLogEntryInput } from "@todo/shared";
import { api } from "@/lib/fetch";
import { notify } from "@/lib/toast";

export function useLogs() {
  return useQuery({
    queryKey: ["logs"],
    queryFn: () => api.get<(Log & { entryCount: number })[]>("/api/logs"),
  });
}

export function useLog(id: string) {
  return useQuery({
    queryKey: ["logs", id],
    queryFn: () => api.get<Log>(`/api/logs/${id}`),
  });
}

export function useLogEntries(logId: string) {
  return useQuery({
    queryKey: ["log-entries", logId],
    queryFn: () => api.get<LogEntry[]>(`/api/logs/${logId}/entries`),
  });
}

export function useCreateLogEntry(logId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Omit<CreateLogEntryInput, "logId">) =>
      api.post<LogEntry>(`/api/logs/${logId}/entries`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["log-entries", logId] });
      qc.invalidateQueries({ queryKey: ["logs"] });
    },
    onError: (err) => notify.error("Failed to save entry", err),
  });
}

export function useDeleteLogEntry(logId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (entryId: string) => api.delete(`/api/log-entries/${entryId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["log-entries", logId] });
      qc.invalidateQueries({ queryKey: ["logs"] });
    },
    onError: (err) => notify.error("Failed to delete entry", err),
  });
}

export function useUpdateLogEntry(logId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ entryId, ...data }: { entryId: string } & UpdateLogEntryInput) =>
      api.patch<LogEntry>(`/api/log-entries/${entryId}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["log-entries", logId] });
      qc.invalidateQueries({ queryKey: ["logs"] });
    },
    onError: (err) => notify.error("Failed to update entry", err),
  });
}
