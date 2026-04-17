"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/fetch";
import type { CalendarEvent } from "@/app/api/calendar/events/route";

export type { CalendarEvent };

export function useCalendarEvents() {
  return useQuery({
    queryKey: ["calendar-events"],
    queryFn: () => api.get<{ events: CalendarEvent[] }>("/api/calendar/events").then((r) => r.events),
    staleTime: 5 * 60 * 1000,
    refetchInterval: 10 * 60 * 1000,
  });
}

export function useTodayCalendarEvents() {
  const { data: events = [], ...rest } = useCalendarEvents();
  const today = new Date().toISOString().slice(0, 10);
  const todayEvents = events.filter((e) => {
    const start = e.start.slice(0, 10);
    const end = e.end.slice(0, 10);
    return start <= today && end >= today;
  });
  return { data: todayEvents, ...rest };
}
