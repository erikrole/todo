"use client";

import { useState } from "react";
import { useUpdateTask } from "@/hooks/use-tasks";
import { useProjects } from "@/hooks/use-projects";
import { todayStr, tomorrowStr, nextSaturdayStr, toLocalDateStr } from "@/lib/dates";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";

interface InboxDispatchControlsProps {
  taskId: string;
}

export function InboxDispatchControls({ taskId }: InboxDispatchControlsProps) {
  const updateTask = useUpdateTask();
  const { data: projects = [] } = useProjects();
  const activeProjects = projects.filter((p) => !p.isCompleted);

  const [overflowOpen, setOverflowOpen] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);

  function dispatch(patch: Parameters<typeof updateTask.mutate>[0]) {
    updateTask.mutate(patch);
  }

  function pill(label: string, onClick: () => void) {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
        disabled={updateTask.isPending}
        className="rounded-full border border-border bg-card px-2.5 py-0.5 text-xs text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {label}
      </button>
    );
  }

  return (
    <div
      className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity"
      onClick={(e) => e.stopPropagation()}
    >
      {pill("Today", () => dispatch({ id: taskId, whenDate: todayStr(), isSomeday: false }))}
      {pill("Tomorrow", () => dispatch({ id: taskId, whenDate: tomorrowStr(), isSomeday: false }))}

      {/* ··· overflow popover */}
      <Popover open={overflowOpen} onOpenChange={setOverflowOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label="More options"
            disabled={updateTask.isPending}
            className="rounded-full border border-border bg-card px-2.5 py-0.5 text-xs text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={(e) => e.stopPropagation()}
          >
            ···
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-52 p-2" align="end" onClick={(e) => e.stopPropagation()}>
          {/* Schedule section */}
          <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">
            Schedule
          </p>
          <button
            type="button"
            disabled={updateTask.isPending}
            className="w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={() => {
              dispatch({ id: taskId, whenDate: nextSaturdayStr(), isSomeday: false });
              setOverflowOpen(false);
            }}
          >
            This weekend
          </button>

          {/* Pick a date — opens nested Calendar */}
          <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                disabled={updateTask.isPending}
                className="w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Pick a date…
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="single"
                disabled={(d) => {
                  const today = new Date();
                  today.setHours(0, 0, 0, 0);
                  return d < today;
                }}
                onSelect={(date) => {
                  if (!date) return;
                  dispatch({ id: taskId, whenDate: toLocalDateStr(date), isSomeday: false });
                  setCalendarOpen(false);
                  setOverflowOpen(false);
                }}
              />
            </PopoverContent>
          </Popover>

          {/* Move to project section */}
          {activeProjects.length > 0 && (
            <>
              <div className="my-1.5 border-t border-border" />
              <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">
                Move to
              </p>
              <div className="max-h-48 overflow-y-auto">
                {activeProjects.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    disabled={updateTask.isPending}
                    className="w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted transition-colors truncate disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={() => {
                      dispatch({ id: taskId, projectId: p.id });
                      setOverflowOpen(false);
                    }}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            </>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}
