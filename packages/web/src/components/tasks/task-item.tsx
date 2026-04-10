"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import type { Task } from "@todo/shared";
import { TaskCheckbox } from "./task-checkbox";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { deadlineUrgency, formatWhenDate } from "@/lib/dates";
import { useCompleteTask } from "@/hooks/use-tasks";

interface TaskItemProps {
  task: Task;
  onOpen: (task: Task) => void;
  showWhenDate?: boolean;
}

export function TaskItem({ task, onOpen, showWhenDate }: TaskItemProps) {
  const completeTask = useCompleteTask();
  const [completing, setCompleting] = useState(false);

  function handleComplete() {
    setCompleting(true);
    setTimeout(() => completeTask.mutate(task.id), 350);
  }

  return (
    <AnimatePresence>
      {!completing && (
        <motion.div
          layout
          initial={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0, marginBottom: 0 }}
          transition={{ duration: 0.3 }}
          className={cn(
            "group flex items-start gap-3 rounded-lg px-3 py-2.5 hover:bg-muted/50 cursor-pointer",
          )}
          onClick={() => onOpen(task)}
        >
          <div className="mt-0.5" onClick={(e) => e.stopPropagation()}>
            <TaskCheckbox
              checked={task.isCompleted}
              onComplete={handleComplete}
            />
          </div>

          <div className="flex flex-1 flex-col gap-0.5 min-w-0">
            <span className={cn("text-sm leading-snug truncate", task.isCompleted && "line-through text-muted-foreground")}>
              {task.title}
            </span>

            <div className="flex items-center gap-2 flex-wrap">
              {showWhenDate && task.whenDate && (
                <span className="text-xs text-muted-foreground">{formatWhenDate(task.whenDate)}</span>
              )}
              {task.deadline && (
                <DeadlineBadge deadline={task.deadline} />
              )}
              {task.notes && (
                <span className="text-xs text-muted-foreground/60">has notes</span>
              )}
            </div>
          </div>
        </motion.div>
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
