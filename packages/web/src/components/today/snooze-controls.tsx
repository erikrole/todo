"use client";

import { useUpdateTask } from "@/hooks/use-tasks";
import { tomorrowStr, nextSaturdayStr } from "@/lib/dates";
import { PillButton } from "@/components/ui/pill-button";

interface TodaySnoozeControlsProps {
  taskId: string;
}

export function TodaySnoozeControls({ taskId }: TodaySnoozeControlsProps) {
  const updateTask = useUpdateTask();

  return (
    <div
      className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity"
      onClick={(e) => e.stopPropagation()}
    >
      <PillButton label="Tomorrow" disabled={updateTask.isPending} onClick={() => updateTask.mutate({ id: taskId, whenDate: tomorrowStr(), isSomeday: false })} />
      <PillButton label="Someday" disabled={updateTask.isPending} onClick={() => updateTask.mutate({ id: taskId, whenDate: null, isSomeday: true })} />
      <PillButton label="Weekend" disabled={updateTask.isPending} onClick={() => updateTask.mutate({ id: taskId, whenDate: nextSaturdayStr(), isSomeday: false })} />
    </div>
  );
}
