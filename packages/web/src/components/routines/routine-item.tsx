"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/fetch";
import { cn } from "@/lib/utils";
import { toLocalDateStr } from "@/lib/dates";
import type { Task } from "@todo/shared";

interface CompletionStats {
  completions: unknown[];
  stats: {
    count: number;
    avgDays: number | null;
    shortestDays: number | null;
    longestDays: number | null;
    lastCompletedAt: string | null;
  };
}

interface Props {
  task: Task;
}

export function RoutineItem({ task }: Props) {
  const today = toLocalDateStr(new Date());

  const { data } = useQuery({
    queryKey: ["task-completions", task.id],
    queryFn: () => api.get<CompletionStats>(`/api/tasks/${task.id}/completions`),
  });

  const lastCompletedAt = data?.stats.lastCompletedAt ?? null;
  const avgDays = data?.stats.avgDays ?? null;

  // "Xd to go" calculation
  const daysToGo = task.whenDate
    ? Math.round(
        (Date.parse(task.whenDate + "T00:00:00") - Date.parse(today + "T00:00:00")) / 86400000,
      )
    : null;

  // "Xd ago" calculation
  const daysAgo = lastCompletedAt
    ? Math.round(
        (Date.parse(today + "T00:00:00") -
          Date.parse(lastCompletedAt.slice(0, 10) + "T00:00:00")) /
          86400000,
      )
    : null;

  function formatDaysToGo(days: number | null): { text: string; color: string } {
    if (days === null) return { text: "No date", color: "text-muted-foreground/50" };
    if (days < 0) return { text: `${Math.abs(days)}d overdue`, color: "text-destructive/70" };
    if (days === 0) return { text: "Due today", color: "text-amber-500/80" };
    if (days <= 3) return { text: `${days}d to go`, color: "text-amber-500/70" };
    return { text: `${days}d to go`, color: "text-muted-foreground/50" };
  }

  function formatDaysAgo(days: number | null): string {
    if (days === null) return "Never done";
    if (days === 0) return "Done today";
    if (days === 1) return "1d ago";
    return `${days}d ago`;
  }

  const { text: daysToGoText, color: daysToGoColor } = formatDaysToGo(daysToGo);

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 hover:bg-accent/40 rounded-lg cursor-default group">
      {/* Title */}
      <span className="flex-1 text-sm truncate">{task.title}</span>

      {/* Metadata */}
      <div className="flex items-center gap-2 shrink-0 text-[11px] font-mono">
        <span className={cn("tabular-nums", daysToGoColor)}>{daysToGoText}</span>
        <span className="text-muted-foreground/30">·</span>
        <span className="text-muted-foreground/50 tabular-nums">{formatDaysAgo(daysAgo)}</span>
        {avgDays !== null && (
          <>
            <span className="text-muted-foreground/30">·</span>
            <span className="text-muted-foreground/40 tabular-nums">{avgDays}d avg</span>
          </>
        )}
      </div>
    </div>
  );
}
