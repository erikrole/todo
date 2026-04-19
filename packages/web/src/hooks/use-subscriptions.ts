"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Subscription } from "@todo/db";
import type { CreateSubscriptionInput, UpdateSubscriptionInput } from "@todo/shared";
import { api } from "@/lib/fetch";
import { notify } from "@/lib/toast";

export function useSubscriptions(activeOnly = true) {
  return useQuery({
    queryKey: ["subscriptions", activeOnly],
    queryFn: () => api.get<Subscription[]>(`/api/subscriptions?active=${activeOnly}`),
  });
}

export function useCreateSubscription() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateSubscriptionInput) => api.post<Subscription>("/api/subscriptions", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["subscriptions"] });
      notify.success("Subscription added");
    },
    onError: (err) => notify.error("Failed to add subscription", err),
  });
}

export function useUpdateSubscription() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: UpdateSubscriptionInput & { id: string }) =>
      api.patch<Subscription>(`/api/subscriptions/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["subscriptions"] }),
    onError: (err) => notify.error("Failed to update subscription", err),
  });
}

export function useDeleteSubscription() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/api/subscriptions/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["subscriptions"] });
      notify.success("Subscription deleted");
    },
    onError: (err) => notify.error("Failed to delete subscription", err),
  });
}
