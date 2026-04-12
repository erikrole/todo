"use client";

import { useState, useCallback, useMemo, useRef } from "react";
import type { Task, Section } from "@todo/shared";
import { TaskItem } from "./task-item";
import { TaskQuickAdd, TaskQuickAddHandle } from "./task-quick-add";
import { Skeleton } from "@/components/ui/skeleton";
import { useProjects } from "@/hooks/use-projects";
import type { ProjectWithCounts } from "@todo/shared";
import { useRegisterTaskList, useFocusedTask, useShortcutAction } from "@/components/keyboard/keyboard-provider";
import {
  useCompleteTask,
  useDeleteTask,
  useRestoreTask,
  useUncompleteTask,
  useUpdateTask,
} from "@/hooks/use-tasks";
import { notify } from "@/lib/toast";

interface TaskListProps {
  tasks: Task[];
  isLoading?: boolean;
  showWhenDate?: boolean;
  quickAddDefaults?: Partial<Pick<Task, "whenDate" | "timeOfDay" | "projectId" | "areaId" | "sectionId">>;
  activeSections?: Section[];
  emptyMessage?: string;
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export function TaskList({ tasks, isLoading, showWhenDate, quickAddDefaults, activeSections, emptyMessage }: TaskListProps) {
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const { data: allProjects = [] } = useProjects();
  const activeProjects = allProjects.filter((p) => !p.isCompleted) as ProjectWithCounts[];
  const { focusedTaskId, setFocusedTaskId } = useFocusedTask();
  const quickAddRef = useRef<TaskQuickAddHandle>(null);

  // Register ordered task IDs for j/k navigation
  const taskIds = useMemo(() => tasks.map((t) => t.id), [tasks]);
  useRegisterTaskList(taskIds);

  // Clicking a task sets focus AND toggles expand/collapse
  const handleToggle = useCallback((id: string) => {
    setFocusedTaskId(id);
    setExpandedTaskId((prev) => (prev === id ? null : id));
  }, [setFocusedTaskId]);

  const completeTask = useCompleteTask();
  const uncompleteTask = useUncompleteTask();
  const deleteTask = useDeleteTask();
  const restoreTask = useRestoreTask();
  const updateTask = useUpdateTask();

  useShortcutAction("task-complete", () => {
    const id = focusedTaskId;
    if (!id) return;
    completeTask.mutate(id, {
      onSuccess: () => notify.undoable("Task completed", () => uncompleteTask.mutate(id)),
    });
  });

  useShortcutAction("task-delete", () => {
    const id = focusedTaskId;
    if (!id) return;
    setFocusedTaskId(null);
    setExpandedTaskId(null);
    deleteTask.mutate(id, {
      onSuccess: () => notify.undoable("Task deleted", () => restoreTask.mutate(id)),
    });
  });

  useShortcutAction("task-move-today", () => {
    const id = focusedTaskId;
    if (!id) return;
    const focused = tasks.find((t) => t.id === id);
    if (!focused) return;
    const prev = { whenDate: focused.whenDate, timeOfDay: focused.timeOfDay, isSomeday: focused.isSomeday };
    updateTask.mutate(
      { id, whenDate: todayStr(), timeOfDay: null, isSomeday: false },
      { onSuccess: () => notify.undoable("Moved to Today", () => updateTask.mutate({ id, ...prev })) },
    );
  });

  useShortcutAction("task-move-inbox", () => {
    const id = focusedTaskId;
    if (!id) return;
    const focused = tasks.find((t) => t.id === id);
    if (!focused) return;
    const prev = { whenDate: focused.whenDate, timeOfDay: focused.timeOfDay, isSomeday: focused.isSomeday };
    updateTask.mutate(
      { id, whenDate: null, timeOfDay: null, isSomeday: false },
      { onSuccess: () => notify.undoable("Moved to Inbox", () => updateTask.mutate({ id, ...prev })) },
    );
  });

  useShortcutAction("task-move-someday", () => {
    const id = focusedTaskId;
    if (!id) return;
    const focused = tasks.find((t) => t.id === id);
    if (!focused) return;
    const prev = { whenDate: focused.whenDate, timeOfDay: focused.timeOfDay, isSomeday: focused.isSomeday };
    updateTask.mutate(
      { id, isSomeday: true, whenDate: null, timeOfDay: null },
      { onSuccess: () => notify.undoable("Moved to Someday", () => updateTask.mutate({ id, ...prev })) },
    );
  });

  useShortcutAction("task-expand", () => {
    if (!focusedTaskId) return;
    setExpandedTaskId((prev) => (prev === focusedTaskId ? null : focusedTaskId));
  });

  useShortcutAction("task-close", () => {
    if (expandedTaskId) {
      setExpandedTaskId(null); // collapse but keep focus
    } else {
      setFocusedTaskId(null); // deselect
    }
  });

  // task-edit: expand the task — TaskItem auto-focuses the title input when isExpanded becomes true
  useShortcutAction("task-edit", () => {
    if (!focusedTaskId) return;
    setExpandedTaskId(focusedTaskId);
  });

  useShortcutAction("task-new", () => {
    quickAddRef.current?.focus();
  });

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
      <TaskQuickAdd ref={quickAddRef} defaults={quickAddDefaults} />
    </div>
  );
}
