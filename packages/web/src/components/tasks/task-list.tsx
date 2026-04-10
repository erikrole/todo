"use client";

import { useState } from "react";
import type { Task } from "@todo/shared";
import { TaskItem } from "./task-item";
import { TaskDetail } from "./task-detail";
import { TaskQuickAdd } from "./task-quick-add";
import { Skeleton } from "@/components/ui/skeleton";

interface TaskListProps {
  tasks: Task[];
  isLoading?: boolean;
  showWhenDate?: boolean;
  /** Context for quick-add pre-filling */
  quickAddDefaults?: Partial<Pick<Task, "whenDate" | "timeOfDay" | "projectId" | "areaId">>;
  emptyMessage?: string;
}

export function TaskList({ tasks, isLoading, showWhenDate, quickAddDefaults, emptyMessage }: TaskListProps) {
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-2">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-10 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col">
        {tasks.length === 0 && emptyMessage && (
          <p className="text-sm text-muted-foreground py-6 text-center">{emptyMessage}</p>
        )}
        {tasks.map((task) => (
          <TaskItem
            key={task.id}
            task={task}
            onOpen={setSelectedTask}
            showWhenDate={showWhenDate}
          />
        ))}
        <TaskQuickAdd defaults={quickAddDefaults} />
      </div>

      {selectedTask && (
        <TaskDetail
          task={selectedTask}
          open={!!selectedTask}
          onClose={() => setSelectedTask(null)}
        />
      )}
    </>
  );
}
