"use client";

import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/fetch";
import type { Task } from "@todo/shared";

interface TaskCompletion {
  id: string;
  taskId: string;
  completedAt: string;
  intervalActual: number | null;
  notes: string | null;
  createdAt: string;
}

interface CompletionStats {
  completions: TaskCompletion[];
  stats: {
    count: number;
    avgDays: number | null;
    shortestDays: number | null;
    longestDays: number | null;
    lastCompletedAt: string | null;
  };
}

interface Props {
  task: Task | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CompletionHistorySheet({ task, open, onOpenChange }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ["task-completions", task?.id],
    queryFn: () => api.get<CompletionStats>(`/api/tasks/${task!.id}/completions`),
    enabled: !!task && open,
  });

  const completions = data?.completions ?? [];
  const stats = data?.stats;

  // Reverse so most recent is first
  const sorted = [...completions].reverse();

  // Max interval for bar scaling
  const maxInterval = Math.max(...completions.map((c) => c.intervalActual ?? 0), 1);

  function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-96 flex flex-col">
        <SheetHeader>
          <SheetTitle className="text-base">{task?.title ?? ""}</SheetTitle>
          <SheetDescription className="sr-only">Completion history</SheetDescription>
        </SheetHeader>

        {/* Stats row */}
        {stats && stats.count > 0 && (
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground font-mono px-0 mt-1">
            <span>{stats.count} completions</span>
            {stats.avgDays !== null && <span>{stats.avgDays}d avg</span>}
            {stats.shortestDays !== null && <span>{stats.shortestDays}d shortest</span>}
            {stats.longestDays !== null && <span>{stats.longestDays}d longest</span>}
          </div>
        )}

        {/* Timeline */}
        <div className="flex-1 overflow-y-auto mt-4 -mx-6 px-6">
          {isLoading ? (
            <div className="text-sm text-muted-foreground">Loading...</div>
          ) : sorted.length === 0 ? (
            <div className="text-sm text-muted-foreground">No completions yet.</div>
          ) : (
            <div className="flex flex-col gap-2">
              {sorted.map((c) => (
                <div key={c.id} className="flex flex-col gap-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-medium text-foreground/80">{formatDate(c.completedAt)}</span>
                    {c.intervalActual !== null && (
                      <span className="text-muted-foreground/60 font-mono tabular-nums">
                        {c.intervalActual}d
                      </span>
                    )}
                  </div>
                  {c.intervalActual !== null && (
                    <div className="h-1 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary/40"
                        style={{ width: `${Math.min((c.intervalActual / maxInterval) * 100, 100)}%` }}
                      />
                    </div>
                  )}
                  {c.notes && (
                    <p className="text-[11px] text-muted-foreground/60 italic">{c.notes}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
