"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/fetch";
import { cn } from "@/lib/utils";
import { toLocalDateStr } from "@/lib/dates";
import { Check } from "lucide-react";
import type { Task } from "@todo/shared";

interface Props {
  task: Task;
}

export function TodayRoutineRow({ task }: Props) {
  const qc = useQueryClient();
  const today = toLocalDateStr(new Date());

  const logMutation = useMutation({
    mutationFn: () =>
      api.post(`/api/tasks/${task.id}/completions`, {
        completedAt: today + "T12:00:00",
        notes: null,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
    },
  });

  const daysToGo =
    task.whenDate !== null
      ? Math.round(
          (Date.parse(task.whenDate + "T00:00:00") - Date.parse(today + "T00:00:00")) / 86400000,
        )
      : null;

  const isOverdue = daysToGo !== null && daysToGo < 0;
  const isDueToday = daysToGo === 0;

  return (
    <div className="group relative flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-accent/40 transition-colors">
      {/* Status dot */}
      <div
        className={cn(
          "h-2.5 w-2.5 rounded-full shrink-0",
          isOverdue ? "bg-destructive/70" : isDueToday ? "bg-amber-500/80" : "bg-primary/40",
        )}
      />

      <span className="flex-1 text-sm truncate">{task.title}</span>

      {isOverdue && daysToGo !== null && (
        <span className="text-xs text-destructive/70 tabular-nums shrink-0 group-hover:opacity-0 transition-opacity">
          {Math.abs(daysToGo)}d overdue
        </span>
      )}

      {/* Log today button — visible on hover */}
      <button
        type="button"
        aria-label="Log today"
        disabled={logMutation.isPending}
        onClick={(e) => {
          e.stopPropagation();
          logMutation.mutate();
        }}
        className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity flex items-center gap-1 rounded-full border border-border bg-card px-2.5 py-0.5 text-xs text-muted-foreground hover:text-foreground hover:border-foreground/30 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Check className="h-3 w-3" />
        Log
      </button>
    </div>
  );
}
