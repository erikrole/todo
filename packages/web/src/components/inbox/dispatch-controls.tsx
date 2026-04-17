"use client";

import { useState } from "react";
import { useUpdateTask } from "@/hooks/use-tasks";
import { useProjects } from "@/hooks/use-projects";
import { todayStr, tomorrowStr, nextSaturdayStr } from "@/lib/dates";
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
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
        className="rounded-full border border-border bg-card px-2.5 py-0.5 text-xs text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
      >
        {label}
      </button>
    );
  }

  return (
    <div
      className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
      onClick={(e) => e.stopPropagation()}
    >
      {pill("Today", () => dispatch({ id: taskId, whenDate: todayStr(), isSomeday: false }))}
      {pill("Tomorrow", () => dispatch({ id: taskId, whenDate: tomorrowStr(), isSomeday: false }))}

      {/* ··· overflow popover */}
      <Popover open={overflowOpen} onOpenChange={setOverflowOpen}>
        <PopoverTrigger asChild>
          <button
            className="rounded-full border border-border bg-card px-2.5 py-0.5 text-xs text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
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
            className="w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted transition-colors"
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
              <button className="w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted transition-colors">
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
                  const y = date.getFullYear();
                  const m = String(date.getMonth() + 1).padStart(2, "0");
                  const day = String(date.getDate()).padStart(2, "0");
                  dispatch({ id: taskId, whenDate: `${y}-${m}-${day}`, isSomeday: false });
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
                    className="w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted transition-colors truncate"
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
