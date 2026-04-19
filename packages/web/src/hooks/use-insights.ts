"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/fetch";
import type { Insight } from "@/app/api/insights/route";

export type { Insight };

export function useInsights() {
  return useQuery({
    queryKey: ["insights"],
    queryFn: () => api.get<Insight[]>("/api/insights"),
    staleTime: 60_000,
  });
}
