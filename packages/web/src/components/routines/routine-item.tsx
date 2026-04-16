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

  function formatDaysToGo(): { text: string; cls: string } {
    if (daysToGo === null) return { text: "—", cls: "text-muted-foreground/40" };
    if (daysToGo < 0) return { text: `${Math.abs(daysToGo)}d overdue`, cls: "text-destructive/80" };
    if (daysToGo === 0) return { text: "today", cls: "text-amber-500" };
    if (daysToGo <= 2) return { text: `${daysToGo}d`, cls: "text-amber-500/80" };
    return { text: `${daysToGo}d`, cls: "text-muted-foreground/50" };
  }

  const { text: dtoText, cls: dtoCls } = formatDaysToGo();

  return (
    <>
      <div
        className="group relative flex flex-col cursor-pointer select-none"
        style={{ animationDelay: `${index * 30}ms` }}
        onClick={() => setHistoryOpen(true)}
      >
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-accent/40 transition-colors">
          {/* Status ring */}
          <StatusRing progressPct={barPct} isOverdue={isOverdue} isDueSoon={isDueSoon} />

          {/* Main content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-[13px] font-medium truncate leading-snug">{task.title}</span>
              <div className="flex items-baseline gap-2 shrink-0 text-[11px] tabular-nums">
                {daysAgo !== null && (
                  <span className="text-muted-foreground/45">{daysAgo}d ago</span>
                )}
                <span className={cn("font-semibold", dtoCls)}>{dtoText}</span>
              </div>
            </div>

            {/* Progress bar */}
            <div className="mt-1.5 h-[2px] rounded-full bg-border/50 overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  isOverdue && "bg-destructive/50",
                  isDueSoon && "bg-amber-500/50",
                  isHealthy && "bg-primary/25",
                )}
                style={{ width: `${barPct}%` }}
              />
            </div>

            {/* Sub-line */}
            {(count > 0 || avgDays !== null) && (
              <div className="mt-0.5 flex items-center gap-1.5 tabular-nums text-[10px] text-muted-foreground/40">
                {count > 0 && <span>{count}×</span>}
                {count > 0 && avgDays !== null && <span>·</span>}
                {avgDays !== null && <span>{Math.round(avgDays)}d avg</span>}
              </div>
            )}
          </div>
        </div>
      </div>

      <CompletionHistorySheet task={task} open={historyOpen} onOpenChange={setHistoryOpen} />
    </>
  );
}
