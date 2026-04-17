"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/fetch";
import { cn } from "@/lib/utils";
import { toLocalDateStr } from "@/lib/dates";
import type { Task } from "@todo/shared";
import { CompletionHistorySheet } from "./completion-history-sheet";
import { StatusRing } from "./status-ring";

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
  index?: number;
}

export function RoutineItem({ task, index = 0 }: Props) {
  const [historyOpen, setHistoryOpen] = useState(false);
  const today = toLocalDateStr(new Date());

  const { data } = useQuery({
    queryKey: ["task-completions", task.id],
    queryFn: () => api.get<CompletionStats>(`/api/tasks/${task.id}/completions`),
  });

  const lastCompletedAt = data?.stats.lastCompletedAt ?? null;
  const avgDays = data?.stats.avgDays ?? null;
  const count = data?.stats.count ?? 0;

  const daysToGo = task.whenDate
    ? Math.round(
        (Date.parse(task.whenDate + "T00:00:00") - Date.parse(today + "T00:00:00")) / 86400000,
      )
    : null;

  const daysAgo = lastCompletedAt
    ? Math.round(
        (Date.parse(today + "T00:00:00") -
          Date.parse(lastCompletedAt.slice(0, 10) + "T00:00:00")) /
          86400000,
      )
    : null;

  const cycleDays = avgDays ?? task.recurrenceInterval ?? 7;
  const rawProgress = daysAgo !== null ? daysAgo / cycleDays : 0;
  const barPct = Math.min(rawProgress * 100, 100);

  const isOverdue = daysToGo !== null && daysToGo < 0;
  const isDueSoon = daysToGo !== null && daysToGo >= 0 && daysToGo <= 2;
  const isHealthy = !isOverdue && !isDueSoon;

  function formatMetric(): { text: string; sub: string; cls: string } {
    if (daysToGo === null) return { text: "—", sub: "", cls: "text-muted-foreground/50" };
    if (daysToGo < 0) return { text: `${Math.abs(daysToGo)}d`, sub: "overdue", cls: "text-destructive" };
    if (daysToGo === 0) return { text: "today", sub: "due", cls: "text-amber-500" };
    if (daysToGo <= 2) return { text: `${daysToGo}d`, sub: "to go", cls: "text-amber-500" };
    return { text: `${daysToGo}d`, sub: "to go", cls: "text-muted-foreground/60" };
  }

  const { text: metricText, sub: metricSub, cls: metricCls } = formatMetric();

  return (
    <>
      <div
        className="group relative cursor-pointer select-none"
        style={{ animationDelay: `${index * 30}ms` }}
        onClick={() => setHistoryOpen(true)}
      >
        {/* Left accent line for urgent states */}
        {(isOverdue || isDueSoon) && (
          <div
            className={cn(
              "absolute left-0 top-2 bottom-2 w-0.5 rounded-full",
              isOverdue ? "bg-destructive/70" : "bg-amber-500/70",
            )}
          />
        )}

        <div className="flex items-center gap-4 pl-4 pr-3 py-3 rounded-xl hover:bg-accent/50 transition-colors">
          {/* Status ring — 24px */}
          <StatusRing progressPct={barPct} isOverdue={isOverdue} isDueSoon={isDueSoon} />

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline justify-between gap-4">
              <span className="text-sm font-semibold truncate leading-snug">{task.title}</span>

              {/* Hero metric */}
              <div className="shrink-0 text-right">
                <span className={cn("text-xl font-bold tabular-nums leading-none", metricCls)}>
                  {metricText}
                </span>
                {metricSub && (
                  <p className={cn(
                    "text-[10px] leading-tight mt-0.5",
                    isOverdue ? "text-destructive/60" : "text-muted-foreground/50",
                  )}>
                    {metricSub}
                  </p>
                )}
              </div>
            </div>

            {/* Meta: days-ago · count · avg */}
            <div className="mt-0.5 flex items-center gap-1.5 tabular-nums text-xs text-muted-foreground/65">
              {daysAgo !== null && <span>{daysAgo}d ago</span>}
              {daysAgo !== null && (count > 0 || avgDays !== null) && <span>·</span>}
              {count > 0 && <span>{count}×</span>}
              {count > 0 && avgDays !== null && <span>·</span>}
              {avgDays !== null && <span>{Math.round(avgDays)}d avg</span>}
            </div>

            {/* Progress bar — 4px */}
            <div className="mt-2 h-1 rounded-full bg-border/60 overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  isOverdue && "bg-destructive/60",
                  isDueSoon && "bg-amber-500/60",
                  isHealthy && "bg-primary/40",
                )}
                style={{ width: `${barPct}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      <CompletionHistorySheet task={task} open={historyOpen} onOpenChange={setHistoryOpen} />
    </>
  );
}
