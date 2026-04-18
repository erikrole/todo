"use client";

import { useMemo, useState } from "react";
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
      <Popover open={calOpen} onOpenChange={setCalOpen}>
        <PopoverTrigger asChild>
          <button className="flex items-center gap-1.5 text-xs text-left hover:text-foreground transition-colors">
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
          className="flex items-center gap-1 text-xs text-destructive/70 hover:text-destructive transition-colors"
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
  const [addingEntry, setAddingEntry] = useState(false);
  const [entryDate, setEntryDate] = useState<Date>(() => new Date());
  const [entryNotes, setEntryNotes] = useState("");
  const [entryCalOpen, setEntryCalOpen] = useState(false);

  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["task-completions", task?.id],
    queryFn: () => api.get<CompletionStats>(`/api/tasks/${task!.id}/completions`),
    enabled: !!task && open,
  });

  const completions = data?.completions ?? [];
  const stats = data?.stats;
  const sorted = useMemo(() => [...completions].reverse(), [completions]);
  const maxInterval = useMemo(
    () => Math.max(...completions.map((c) => c.intervalActual ?? 0), 1),
    [completions],
  );
  const avgDays = stats?.avgDays ?? null;

  const addMutation = useMutation({
    mutationFn: () =>
      api.post(`/api/tasks/${task!.id}/completions`, {
        completedAt: toLocalDateStr(entryDate) + "T12:00:00",
        notes: entryNotes.trim() || null,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["task-completions", task?.id] });
      qc.invalidateQueries({ queryKey: ["tasks"] });
      setAddingEntry(false);
      setEntryNotes("");
      setEntryDate(new Date());
    },
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-96 flex flex-col gap-0 pb-0">
        <SheetHeader className="pb-4 border-b">
          <div className="flex items-start justify-between gap-2">
            <SheetTitle className="text-xl font-bold leading-tight">{task?.title ?? ""}</SheetTitle>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs shrink-0 mt-0.5"
              onClick={() => {
                setAddingEntry((v) => !v);
                setEntryDate(new Date());
                setEntryNotes("");
              }}
            >
              + Add entry
            </Button>
          </div>
          <SheetDescription className="sr-only">Completion history</SheetDescription>
        </SheetHeader>

        {stats && stats.count > 0 && (
          <div className="grid grid-cols-4 gap-px bg-border border-b">
            {[
              { label: "total", value: stats.count },
              { label: "avg", value: avgDays !== null ? `${Math.round(avgDays)}d` : "—" },
              { label: "best", value: stats.shortestDays !== null ? `${stats.shortestDays}d` : "—", highlight: true },
              { label: "longest", value: stats.longestDays !== null ? `${stats.longestDays}d` : "—" },
            ].map((s) => (
              <div key={s.label} className="flex flex-col items-center py-4 bg-background gap-1">
                <span className={cn(
                  "text-2xl font-bold tabular-nums leading-none",
                  s.highlight && "text-primary"
                )}>{s.value}</span>
                <span className="text-xs text-muted-foreground/70 uppercase tracking-wider">{s.label}</span>
              </div>
            ))}
          </div>
        )}

        {addingEntry && (
          <div className="px-4 py-3 border-b flex flex-col gap-2">
            <span className="text-xs font-semibold text-muted-foreground/70 uppercase tracking-wider">New entry</span>
            <Popover open={entryCalOpen} onOpenChange={setEntryCalOpen}>
              <PopoverTrigger asChild>
                <button className="flex items-center gap-1.5 text-xs text-left hover:text-foreground transition-colors">
                  <CalendarIcon className="h-3 w-3 text-muted-foreground" />
                  <span>{entryDate.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</span>
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={entryDate}
                  onSelect={(d) => { if (d) { setEntryDate(d); setEntryCalOpen(false); } }}
                  disabled={(d) => d > new Date()}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            <Textarea
              className="text-xs resize-none h-14"
              placeholder="Notes (optional)"
              value={entryNotes}
              onChange={(e) => setEntryNotes(e.target.value)}
            />
            <div className="flex items-center justify-end gap-2">
              <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => { setAddingEntry(false); setEntryNotes(""); setEntryDate(new Date()); }}>
                Cancel
              </Button>
              <Button size="sm" className="h-6 px-2 text-xs" onClick={() => addMutation.mutate()} disabled={addMutation.isPending}>
                Save
              </Button>
            </div>
          </div>
        )}

        {completions.length > 0 && (() => {
          const today = toLocalDateStr(new Date());
          const completionDates = new Set(completions.map((c) => toLocalDateStr(new Date(c.completedAt))));

          // Build 91-day array oldest → newest
          const cells: string[] = Array.from({ length: 91 }, (_, i) => {
            const d = new Date(today + "T00:00:00");
            d.setDate(d.getDate() - (90 - i));
            return toLocalDateStr(d);
          });

          return (
            <>
              <div className="px-4 py-3 border-b flex flex-col gap-2">
                <span className="text-xs font-semibold text-muted-foreground/70 uppercase tracking-wider">Last 90 days</span>
                <div className="grid gap-[3px]" style={{ gridTemplateColumns: "repeat(13, 1fr)" }}>
                  {cells.map((dateStr) => (
                    <div
                      key={dateStr}
                      className={cn(
                        "aspect-square rounded-sm",
                        completionDates.has(dateStr) ? "bg-primary/70" : "bg-muted/30",
                      )}
                      title={dateStr}
                    />
                  ))}
                </div>
              </div>

              {completions.length > 1 && avgDays !== null && (
                <div className="px-4 py-3 border-b flex flex-col gap-2">
                  <span className="text-xs font-semibold text-muted-foreground/70 uppercase tracking-wider">Interval history</span>
                  <div className="flex items-end gap-1 h-14">
                    {completions.slice(-16).map((c) => {
                      const ratio = c.intervalActual !== null ? c.intervalActual / (avgDays * 1.5) : 0;
                      const h = Math.max(Math.min(ratio * 100, 100), 8);
                      const isLong = c.intervalActual !== null && c.intervalActual > avgDays * 1.2;
                      const isShort = c.intervalActual !== null && c.intervalActual < avgDays * 0.8;
                      return (
                        <div
                          key={c.id}
                          className={cn(
                            "flex-1 rounded-sm min-w-[4px] transition-opacity hover:opacity-100 opacity-80",
                            isLong ? "bg-amber-500/70" : isShort ? "bg-emerald-500/70" : "bg-primary/50",
                          )}
                          style={{ height: `${h}%` }}
                          title={c.intervalActual !== null ? `${c.intervalActual}d` : "first"}
                        />
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          );
        })()}

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
                        "h-3 w-3 rounded-full mt-1 shrink-0 ring-2 ring-background",
                        c.intervalActual === null
                          ? "bg-muted-foreground/40"
                          : c.intervalActual < (avgDays ?? 99) * 0.8
                          ? "bg-emerald-500/80"
                          : c.intervalActual > (avgDays ?? 0) * 1.2
                          ? "bg-amber-500/80"
                          : "bg-primary/60",
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
                          <span className="text-sm font-semibold text-foreground">{formatDate(c.completedAt)}</span>
                          <div className="flex items-center gap-1.5">
                            {c.intervalActual !== null && (
                              <span className="text-xs text-muted-foreground/70 tabular-nums font-medium">
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
                          <div className="mt-1.5 h-[3px] rounded-full bg-muted overflow-hidden max-w-[180px]">
                            <div
                              className={cn(
                                "h-full rounded-full",
                                c.intervalActual > (avgDays ?? 0) * 1.2
                                  ? "bg-amber-500/60"
                                  : c.intervalActual < (avgDays ?? 99) * 0.8
                                  ? "bg-emerald-500/60"
                                  : "bg-primary/50",
                              )}
                              style={{ width: `${Math.min((c.intervalActual / maxInterval) * 100, 100)}%` }}
                            />
                          </div>
                        )}

                        {c.notes && (
                          <p className="mt-1 text-xs text-muted-foreground/70 italic leading-snug">{c.notes}</p>
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
