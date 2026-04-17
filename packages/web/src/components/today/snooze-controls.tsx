"use client";

import { useUpdateTask } from "@/hooks/use-tasks";
import { tomorrowStr, nextSaturdayStr } from "@/lib/dates";

interface TodaySnoozeControlsProps {
  taskId: string;
}

export function TodaySnoozeControls({ taskId }: TodaySnoozeControlsProps) {
  const updateTask = useUpdateTask();

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
      {pill("Tomorrow", () => updateTask.mutate({ id: taskId, whenDate: tomorrowStr(), isSomeday: false }))}
      {pill("Someday", () => updateTask.mutate({ id: taskId, whenDate: null, isSomeday: true }))}
      {pill("Weekend", () => updateTask.mutate({ id: taskId, whenDate: nextSaturdayStr(), isSomeday: false }))}
    </div>
  );
}
