"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/fetch";
import type { VehicleIntelligence } from "@/app/api/intelligence/vehicle/route";
import type { AppointmentSuggestion } from "@/app/api/intelligence/appointment/route";
import { cn } from "@/lib/utils";
import { toLocalDateStr } from "@/lib/dates";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ChevronDown, Check, Settings2, Sparkles, CalendarDays } from "lucide-react";
import type { Task } from "@todo/shared";
import { CompletionHistorySheet } from "./completion-history-sheet";
import { StatusRing } from "./status-ring";
import { OIL_CHANGE_TASK_TITLE } from "@/lib/routine-links";

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
  onEdit?: () => void;
  onRowClick?: () => void;
}

// ── Appointment prompt ────────────────────────────────────────────────────────

function AppointmentPrompt({ task, onDismiss }: { task: Task; onDismiss: () => void }) {
  const qc = useQueryClient();
  const [calOpen, setCalOpen] = useState(false);
  const [pickedDate, setPickedDate] = useState<Date | null>(null);

  const { data: suggestion, isLoading } = useQuery({
    queryKey: ["appointment-suggestion", task.id],
    queryFn: () => api.get<AppointmentSuggestion>(`/api/intelligence/appointment?taskId=${task.id}`),
    staleTime: Infinity,
    retry: false,
  });

  const scheduleMutation = useMutation({
    mutationFn: (whenDate: string) =>
      api.patch(`/api/routines/${task.id}`, { whenDate }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["routines"] });
      qc.invalidateQueries({ queryKey: ["tasks"] });
      onDismiss();
    },
  });

  const displayDate = pickedDate ?? (suggestion ? new Date(suggestion.suggestedDate + "T00:00:00") : null);
  const dateStr = displayDate ? toLocalDateStr(displayDate) : null;

  return (
    <div className="mt-2 mx-1 rounded-xl border border-primary/20 bg-primary/5 p-3 flex flex-col gap-2">
      <div className="flex items-center gap-1.5">
        <Sparkles className="h-3.5 w-3.5 text-primary/70 shrink-0" />
        <span className="text-xs font-semibold text-primary/80">Schedule next {task.title.toLowerCase()}?</span>
      </div>

      {isLoading ? (
        <p className="text-xs text-muted-foreground/60 animate-pulse">Getting suggestion…</p>
      ) : suggestion ? (
        <div className="flex flex-col gap-1">
          <p className="text-xs text-muted-foreground/80 italic">{suggestion.reasoning}</p>
          <Popover open={calOpen} onOpenChange={setCalOpen}>
            <PopoverTrigger asChild>
              <button className="flex items-center gap-1.5 text-xs font-semibold text-primary hover:text-primary/80 transition-colors w-fit">
                <CalendarDays className="h-3 w-3" />
                {displayDate
                  ? displayDate.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })
                  : "Pick date"}
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={displayDate ?? undefined}
                onSelect={(d) => { if (d) { setPickedDate(d); setCalOpen(false); } }}
                disabled={(d) => d < new Date()}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>
      ) : (
        <Popover open={calOpen} onOpenChange={setCalOpen}>
          <PopoverTrigger asChild>
            <button className="flex items-center gap-1.5 text-xs font-semibold text-primary hover:text-primary/80 transition-colors w-fit">
              <CalendarDays className="h-3 w-3" />
              {displayDate
                ? displayDate.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })
                : "Pick date"}
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={displayDate ?? undefined}
              onSelect={(d) => { if (d) { setPickedDate(d); setCalOpen(false); } }}
              disabled={(d) => d < new Date()}
              initialFocus
            />
          </PopoverContent>
        </Popover>
      )}

      <div className="flex items-center gap-2 mt-0.5">
        {dateStr && (
          <Button
            size="sm"
            className="h-6 px-3 text-xs"
            onClick={() => scheduleMutation.mutate(dateStr)}
            disabled={scheduleMutation.isPending}
          >
            Set {displayDate?.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
          </Button>
        )}
        <button
          className="text-xs text-muted-foreground/50 hover:text-muted-foreground transition-colors"
          onClick={onDismiss}
        >
          Skip
        </button>
      </div>
    </div>
  );
}

// ── Routine item ──────────────────────────────────────────────────────────────

export function RoutineItem({ task, index = 0, onEdit, onRowClick }: Props) {
  const [historyOpen, setHistoryOpen] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const [logDate, setLogDate] = useState<Date>(() => new Date());
  const [logNotes, setLogNotes] = useState("");
  const [showAppointmentPrompt, setShowAppointmentPrompt] = useState(false);
  const qc = useQueryClient();
  const today = toLocalDateStr(new Date());
  const isOilChange = task.title === OIL_CHANGE_TASK_TITLE;
  const isAppointment = task.recurrenceType === "appointment";

  const { data: vehicle } = useQuery({
    queryKey: ["vehicle-intelligence"],
    queryFn: () => api.get<VehicleIntelligence>("/api/intelligence/vehicle"),
    enabled: isOilChange,
    staleTime: 5 * 60_000,
  });

  const { data } = useQuery({
    queryKey: ["task-completions", task.id],
    queryFn: () => api.get<CompletionStats>(`/api/tasks/${task.id}/completions`),
  });

  const logMutation = useMutation({
    mutationFn: ({ completedAt, notes }: { completedAt: string; notes: string | null }) =>
      api.post(`/api/tasks/${task.id}/completions`, { completedAt, notes }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["task-completions", task.id] });
      qc.invalidateQueries({ queryKey: ["routines"] });
      qc.invalidateQueries({ queryKey: ["tasks"] });
      setLogOpen(false);
      setLogNotes("");
      setLogDate(new Date());
      if (isAppointment) setShowAppointmentPrompt(true);
    },
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

  function intervalToDays(type: string | null, interval: number | null): number | null {
    if (!type || !interval) return null;
    if (type === "daily") return interval;
    if (type === "weekly" || type === "weekday") return interval * 7;
    if (type === "monthly") return interval * 30;
    if (type === "yearly") return interval * 365;
    return null;
  }

  const noDateAppointment = isAppointment && !task.whenDate;
  const cycleDays = avgDays ?? intervalToDays(task.recurrenceType, task.recurrenceInterval);
  const rawProgress = (!noDateAppointment && daysAgo !== null && cycleDays !== null) ? daysAgo / cycleDays : 0;
  const barPct = Math.min(rawProgress * 100, 100);

  const isOverdue = daysToGo !== null && daysToGo < 0;
  const isDueSoon = daysToGo !== null && daysToGo >= 0 && daysToGo <= 2;
  const isHealthy = !isOverdue && !isDueSoon;

  function formatMetric(): { text: string; sub: string; cls: string } {
    if (isAppointment && !task.whenDate) return { text: "—", sub: "no date", cls: "text-muted-foreground/40" };
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
        onClick={() => onRowClick ? onRowClick() : setHistoryOpen(true)}
      >
        {(isOverdue || isDueSoon) && (
          <div
            className={cn(
              "absolute left-0 top-2 bottom-2 w-0.5 rounded-full",
              isOverdue ? "bg-destructive/70" : "bg-amber-500/70",
            )}
          />
        )}

        <div className="flex items-center gap-4 pl-4 pr-3 py-3 rounded-xl hover:bg-accent/50 transition-colors">
          <StatusRing progressPct={barPct} isOverdue={isOverdue} isDueSoon={isDueSoon} />

          <div className="flex-1 min-w-0">
            <div className="flex items-baseline justify-between gap-4">
              <span className="text-sm font-semibold truncate leading-snug">{task.title}</span>

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

            <div className="mt-0.5 flex items-center gap-1.5 tabular-nums text-xs text-muted-foreground/65">
              {daysAgo !== null && <span>{daysAgo}d ago</span>}
              {daysAgo !== null && (count > 0 || avgDays !== null) && <span>·</span>}
              {count > 0 && <span>{count}×</span>}
              {count > 0 && avgDays !== null && <span>·</span>}
              {avgDays !== null && !isAppointment && <span>{Math.round(avgDays)}d avg</span>}
            </div>

            {isOilChange && vehicle?.milesDriven != null ? (
              <div className="mt-2">
                <div className="flex justify-between items-center mb-0.5">
                  <span className="text-[10px] text-muted-foreground/60">
                    {vehicle.milesDriven.toLocaleString()} / {vehicle.intervalMiles.toLocaleString()} mi
                  </span>
                  {vehicle.milesUntilDue != null && vehicle.milesUntilDue > 0 && (
                    <span className="text-[10px] text-muted-foreground/60">
                      {vehicle.milesUntilDue.toLocaleString()} left
                    </span>
                  )}
                </div>
                <div className="h-1 rounded-full bg-border/60 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${Math.min((vehicle.percentComplete ?? 0), 100)}%`,
                      background:
                        (vehicle.percentComplete ?? 0) >= 100
                          ? "oklch(58% 0.22 25)"
                          : (vehicle.percentComplete ?? 0) >= 80
                          ? "oklch(65% 0.17 75)"
                          : "oklch(55% 0.18 140)",
                    }}
                  />
                </div>
              </div>
            ) : (
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
            )}
          </div>

          <div
            className="opacity-0 group-hover:opacity-100 transition-opacity flex shrink-0 items-center gap-1.5"
            onClick={(e) => e.stopPropagation()}
          >
            {onEdit && (
              <button
                aria-label="Edit routine"
                className="flex items-center justify-center w-7 h-7 rounded-lg text-muted-foreground/50 hover:text-muted-foreground hover:bg-accent/60 transition-colors"
                onClick={onEdit}
              >
                <Settings2 className="h-3.5 w-3.5" />
              </button>
            )}
            <div className="flex rounded-lg overflow-hidden border border-primary/20">
              <button
                aria-label="Log today"
                className="flex items-center gap-1 px-2 py-1.5 text-xs font-semibold text-primary/80 hover:text-primary hover:bg-primary/10 transition-colors"
                onClick={() => logMutation.mutate({ completedAt: toLocalDateStr(new Date()) + "T12:00:00", notes: null })}
                disabled={logMutation.isPending}
              >
                <Check className="h-3 w-3" />
                Today
              </button>
              <Popover open={logOpen} onOpenChange={setLogOpen}>
                <PopoverTrigger asChild>
                  <button
                    aria-label="Log past date"
                    className="flex items-center px-1.5 py-1.5 text-primary/50 hover:text-primary hover:bg-primary/10 border-l border-primary/20 transition-colors"
                    onClick={() => setLogOpen(true)}
                    disabled={logMutation.isPending}
                  >
                    <ChevronDown className="h-3 w-3" />
                  </button>
                </PopoverTrigger>
                <PopoverContent
                  className="w-auto p-0"
                  align="end"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="p-3 border-b">
                    <p className="text-xs font-semibold text-muted-foreground/70 uppercase tracking-wider">Log completion</p>
                  </div>
                  <Calendar
                    mode="single"
                    selected={logDate}
                    onSelect={(d) => { if (d) setLogDate(d); }}
                    disabled={(d) => d > new Date()}
                    initialFocus
                  />
                  <div className="p-3 border-t flex flex-col gap-2">
                    <Input
                      className="h-8 text-xs"
                      placeholder="Notes (optional)"
                      value={logNotes}
                      onChange={(e) => setLogNotes(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") logMutation.mutate({ completedAt: toLocalDateStr(logDate) + "T12:00:00", notes: logNotes.trim() || null }); }}
                    />
                    <Button
                      size="sm"
                      className="w-full h-8"
                      onClick={() => logMutation.mutate({ completedAt: toLocalDateStr(logDate) + "T12:00:00", notes: logNotes.trim() || null })}
                      disabled={logMutation.isPending}
                    >
                      Log {logDate.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </div>

        {showAppointmentPrompt && (
          <AppointmentPrompt
            task={task}
            onDismiss={() => setShowAppointmentPrompt(false)}
          />
        )}
      </div>

      <CompletionHistorySheet task={task} open={historyOpen} onOpenChange={setHistoryOpen} />
    </>
  );
}
