"use client";

import { useState, useCallback, useMemo } from "react";
import type { Task, Section } from "@todo/shared";
import { TaskItem } from "./task-item";
import { TaskQuickAdd } from "./task-quick-add";
import { Skeleton } from "@/components/ui/skeleton";
import { useProjects } from "@/hooks/use-projects";
import type { ProjectWithCounts } from "@todo/shared";
import { useRegisterTaskList, useFocusedTask } from "@/components/keyboard/keyboard-provider";

interface TaskListProps {
  tasks: Task[];
  isLoading?: boolean;
  showWhenDate?: boolean;
  quickAddDefaults?: Partial<Pick<Task, "whenDate" | "timeOfDay" | "projectId" | "areaId" | "sectionId">>;
  activeSections?: Section[];
  emptyMessage?: string;
}

export function TaskList({ tasks, isLoading, showWhenDate, quickAddDefaults, activeSections, emptyMessage }: TaskListProps) {
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const { data: allProjects = [] } = useProjects();
  const activeProjects = allProjects.filter((p) => !p.isCompleted) as ProjectWithCounts[];
  const { setFocusedTaskId } = useFocusedTask();

  // Register ordered task IDs for j/k navigation
  const taskIds = useMemo(() => tasks.map((t) => t.id), [tasks]);
  useRegisterTaskList(taskIds);

  // Clicking a task sets focus AND toggles expand/collapse
  const handleToggle = useCallback((id: string) => {
    setFocusedTaskId(id);
    setExpandedTaskId((prev) => (prev === id ? null : id));
  }, [setFocusedTaskId]);

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
    <div className="flex flex-col">
      {tasks.length === 0 && emptyMessage && (
        <p className="text-sm text-muted-foreground py-6 text-center">{emptyMessage}</p>
      )}
      {tasks.map((task) => (
        <TaskItem
          key={task.id}
          task={task}
          isExpanded={expandedTaskId === task.id}
          onToggle={handleToggle}
          activeProjects={activeProjects}
          activeSections={activeSections}
          showWhenDate={showWhenDate}
        />
      ))}
      <TaskQuickAdd defaults={quickAddDefaults} />
    </div>
  );
}
