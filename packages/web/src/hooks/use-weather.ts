"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/fetch";

export interface WeatherData {
  temp: number;
  condition: string;
}

export function useWeather() {
  return useQuery<WeatherData>({
    queryKey: ["weather"],
    queryFn: () => api.get<WeatherData>("/api/weather"),
    staleTime: 30 * 60 * 1000,
    retry: false,
  });
}
