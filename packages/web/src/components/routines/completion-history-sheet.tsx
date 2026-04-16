"use client";

import { useState } from "react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/fetch";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Pencil, Trash2, Check, X } from "lucide-react";
import { toLocalDateStr } from "@/lib/dates";
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

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

interface EditRowProps {
  completion: TaskCompletion;
  taskId: string;
  onDone: () => void;
}

function EditRow({ completion, taskId, onDone }: EditRowProps) {
  const qc = useQueryClient();
  const [notes, setNotes] = useState(completion.notes ?? "");
  const [date, setDate] = useState<Date>(new Date(completion.completedAt));
  const [calOpen, setCalOpen] = useState(false);

  const save = useMutation({
    mutationFn: () =>
      api.patch(`/api/tasks/${taskId}/completions/${completion.id}`, {
        notes: notes.trim() || null,
        completedAt: toLocalDateStr(date) + "T" + new Date(completion.completedAt).toTimeString().slice(0, 8),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["task-completions"] });
      onDone();
    },
  });

  const remove = useMutation({
    mutationFn: () => api.delete(`/api/tasks/${taskId}/completions/${completion.id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["task-completions"] });
      onDone();
    },
  });

  return (
    <div className="flex flex-col gap-2 py-2 px-3 rounded-lg bg-muted/50 border">
      {/* Date picker */}
      <Popover open={calOpen} onOpenChange={setCalOpen}>
        <PopoverTrigger asChild>
          <button className="flex items-center gap-1.5 text-[12px] text-left hover:text-foreground transition-colors">
            <CalendarIcon className="h-3 w-3 text-muted-foreground" />
            <span>{date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</span>
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={date}
            onSelect={(d) => { if (d) { setDate(d); setCalOpen(false); } }}
            disabled={(d) => d > new Date()}
            initialFocus
          />
        </PopoverContent>
      </Popover>

      <Textarea
        className="text-xs resize-none h-14"
        placeholder="Notes (optional)"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
      />

      <div className="flex items-center justify-between gap-2">
        <button
          className="flex items-center gap-1 text-[11px] text-destructive/70 hover:text-destructive transition-colors"
          onClick={() => remove.mutate()}
          disabled={remove.isPending}
        >
          <Trash2 className="h-3 w-3" />
          Delete
        </button>
        <div className="flex gap-1.5">
          <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={onDone}>
            <X className="h-3 w-3" />
          </Button>
          <Button size="sm" className="h-6 px-2 text-xs" onClick={() => save.mutate()} disabled={save.isPending}>
            <Check className="h-3 w-3 mr-1" />
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}

export function CompletionHistorySheet({ task, open, onOpenChange }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["task-completions", task?.id],
    queryFn: () => api.get<CompletionStats>(`/api/tasks/${task!.id}/completions`),
    enabled: !!task && open,
  });

  const completions = data?.completions ?? [];
  const stats = data?.stats;
  const sorted = [...completions].reverse();
  const maxInterval = Math.max(...completions.map((c) => c.intervalActual ?? 0), 1);
  const avgDays = stats?.avgDays ?? null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-96 flex flex-col gap-0 pb-0">
        <SheetHeader className="pb-3 border-b">
          <SheetTitle className="text-base font-semibold leading-tight">{task?.title ?? ""}</SheetTitle>
          <SheetDescription className="sr-only">Completion history</SheetDescription>
        </SheetHeader>

        {/* Stats grid */}
        {stats && stats.count > 0 && (
          <div className="grid grid-cols-4 gap-px bg-border border-b">
            {[
              { label: "total", value: stats.count },
              { label: "avg", value: avgDays !== null ? `${avgDays}d` : "—" },
              { label: "best", value: stats.shortestDays !== null ? `${stats.shortestDays}d` : "—" },
              { label: "longest", value: stats.longestDays !== null ? `${stats.longestDays}d` : "—" },
            ].map((s) => (
              <div key={s.label} className="flex flex-col items-center py-3 bg-background gap-0.5">
                <span className="text-sm font-semibold tabular-nums">{s.value}</span>
                <span className="text-[10px] text-muted-foreground/50 uppercase tracking-wider">{s.label}</span>
              </div>
            ))}
          </div>
        )}

        {/* Mini consistency sparkline — dots for last 12 completions */}
        {completions.length > 1 && avgDays !== null && (
          <div className="px-4 py-3 border-b flex flex-col gap-1.5">
            <span className="text-[10px] text-muted-foreground/50 uppercase tracking-wider">Interval history</span>
            <div className="flex items-end gap-1 h-8">
              {completions.slice(-16).map((c) => {
                const ratio = c.intervalActual !== null ? c.intervalActual / (avgDays * 1.5) : 0;
                const h = Math.max(Math.min(ratio * 100, 100), 8);
                const isLong = c.intervalActual !== null && c.intervalActual > avgDays * 1.2;
                const isShort = c.intervalActual !== null && c.intervalActual < avgDays * 0.8;
                return (
                  <div
                    key={c.id}
                    className={cn(
                      "flex-1 rounded-sm min-w-[4px]",
                      isLong ? "bg-amber-500/50" : isShort ? "bg-emerald-500/50" : "bg-primary/30",
                    )}
                    style={{ height: `${h}%` }}
                    title={c.intervalActual !== null ? `${c.intervalActual}d` : "first"}
                  />
                );
              })}
            </div>
          </div>
        )}

        {/* Timeline */}
        <div className="flex-1 overflow-y-auto py-4 -mx-6 px-6">
          {isLoading ? (
            <div className="text-sm text-muted-foreground">Loading...</div>
          ) : sorted.length === 0 ? (
            <div className="text-sm text-muted-foreground">No completions yet.</div>
          ) : (
            <div className="flex flex-col">
              {sorted.map((c, i) => (
                <div key={c.id} className="flex gap-3 group">
                  {/* Spine */}
                  <div className="flex flex-col items-center shrink-0">
                    <div
                      className={cn(
                        "h-2 w-2 rounded-full mt-1 shrink-0 ring-2 ring-background",
                        c.intervalActual !== null ? "bg-primary/50" : "bg-muted-foreground/30",
                      )}
                    />
                    {i < sorted.length - 1 && <div className="flex-1 w-px bg-border/60 my-0.5" />}
                  </div>

                  {/* Content */}
                  <div className={cn("pb-4 min-w-0 flex-1", i === sorted.length - 1 && "pb-0")}>
                    {editingId === c.id ? (
                      <EditRow
                        completion={c}
                        taskId={task!.id}
                        onDone={() => setEditingId(null)}
                      />
                    ) : (
                      <>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[12px] font-medium text-foreground/80">{formatDate(c.completedAt)}</span>
                          <div className="flex items-center gap-1.5">
                            {c.intervalActual !== null && (
                              <span className="text-[11px] text-muted-foreground/45 tabular-nums">
                                {c.intervalActual}d
                              </span>
                            )}
                            <button
                              className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-accent"
                              onClick={() => setEditingId(c.id)}
                            >
                              <Pencil className="h-3 w-3 text-muted-foreground/60" />
                            </button>
                          </div>
                        </div>

                        {c.intervalActual !== null && (
                          <div className="mt-1 h-[2px] rounded-full bg-muted overflow-hidden max-w-[160px]">
                            <div
                              className={cn(
                                "h-full rounded-full",
                                c.intervalActual > (avgDays ?? 0) * 1.2 ? "bg-amber-500/40" : "bg-primary/35",
                              )}
                              style={{ width: `${Math.min((c.intervalActual / maxInterval) * 100, 100)}%` }}
                            />
                          </div>
                        )}

                        {c.notes && (
                          <p className="mt-1 text-[11px] text-muted-foreground/55 italic leading-snug">{c.notes}</p>
                        )}
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
