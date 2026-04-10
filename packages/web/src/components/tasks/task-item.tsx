"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { useDraggable } from "@dnd-kit/core";
import type { Task } from "@todo/shared";
import { TaskCheckbox } from "./task-checkbox";
import { Badge } from "@/components/ui/badge";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { cn } from "@/lib/utils";
import { deadlineUrgency, formatWhenDate } from "@/lib/dates";
import { useCompleteTask, useDeleteTask, useUpdateTask } from "@/hooks/use-tasks";
import { useProjects } from "@/hooks/use-projects";

interface TaskItemProps {
  task: Task;
  onOpen: (task: Task) => void;
  showWhenDate?: boolean;
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function tomorrowStr() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

export function TaskItem({ task, onOpen, showWhenDate }: TaskItemProps) {
  const completeTask = useCompleteTask();
  const deleteTask = useDeleteTask();
  const updateTask = useUpdateTask();
  const { data: projects = [] } = useProjects();
  const [completing, setCompleting] = useState(false);

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
    data: { task },
  });

  const dragStyle = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  function handleComplete() {
    setCompleting(true);
    setTimeout(() => completeTask.mutate(task.id), 350);
  }

  const activeProjects = projects.filter((p) => !p.isCompleted);

  return (
    <AnimatePresence>
      {!completing && (
        <ContextMenu>
          <ContextMenuTrigger asChild>
            <motion.div
              ref={(el) => setNodeRef(el as HTMLElement | null)}
              layout
              initial={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0, marginBottom: 0 }}
              transition={{ duration: 0.3 }}
              style={{ ...dragStyle, opacity: isDragging ? 0.4 : 1 }}
              className={cn(
                "group flex items-start gap-3 rounded-lg px-3 py-2.5 hover:bg-muted/50",
                isDragging ? "cursor-grabbing" : "cursor-pointer",
              )}
              onClick={() => !isDragging && onOpen(task)}
              {...attributes}
              {...listeners}
            >
              <div className="mt-0.5" onClick={(e) => e.stopPropagation()}>
                <TaskCheckbox checked={task.isCompleted} onComplete={handleComplete} />
              </div>

              <div className="flex flex-1 flex-col gap-0.5 min-w-0">
                <span className={cn("text-sm leading-snug truncate", task.isCompleted && "line-through text-muted-foreground")}>
                  {task.title}
                </span>
                <div className="flex items-center gap-2 flex-wrap">
                  {showWhenDate && task.whenDate && (
                    <span className="text-xs text-muted-foreground">{formatWhenDate(task.whenDate)}</span>
                  )}
                  {task.deadline && <DeadlineBadge deadline={task.deadline} />}
                  {task.notes && <span className="text-xs text-muted-foreground/60">has notes</span>}
                </div>
              </div>
            </motion.div>
          </ContextMenuTrigger>

          <ContextMenuContent>
            <ContextMenuItem onSelect={() => updateTask.mutate({ id: task.id, whenDate: todayStr(), timeOfDay: null })}>
              Move to Today
            </ContextMenuItem>
            <ContextMenuItem onSelect={() => updateTask.mutate({ id: task.id, whenDate: null, timeOfDay: null })}>
              Move to Inbox
            </ContextMenuItem>
            <ContextMenuItem onSelect={() => updateTask.mutate({ id: task.id, whenDate: tomorrowStr() })}>
              Move to Upcoming
            </ContextMenuItem>
            {activeProjects.length > 0 && (
              <ContextMenuSub>
                <ContextMenuSubTrigger>Move to Project</ContextMenuSubTrigger>
                <ContextMenuSubContent>
                  {activeProjects.map((p) => (
                    <ContextMenuItem key={p.id} onSelect={() => updateTask.mutate({ id: task.id, projectId: p.id })}>
                      <span className="flex items-center gap-2">
                        {p.color && <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ backgroundColor: p.color }} />}
                        {p.name}
                      </span>
                    </ContextMenuItem>
                  ))}
                </ContextMenuSubContent>
              </ContextMenuSub>
            )}
            <ContextMenuSeparator />
            <ContextMenuItem onSelect={handleComplete}>Complete</ContextMenuItem>
            <ContextMenuItem
              className="text-destructive focus:text-destructive"
              onSelect={() => deleteTask.mutate(task.id)}
            >
              Delete
            </ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
      )}
    </AnimatePresence>
  );
}

function DeadlineBadge({ deadline }: { deadline: string }) {
  const urgency = deadlineUrgency(deadline);
  return (
    <Badge
      variant="outline"
      className={cn(
        "text-xs px-1.5 py-0",
        urgency === "overdue" && "border-destructive text-destructive",
        urgency === "soon" && "border-amber-500 text-amber-600 dark:text-amber-400",
      )}
    >
      {formatWhenDate(deadline)}
    </Badge>
  );
}
