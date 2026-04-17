"use client";

import { useTasks } from "@/hooks/use-tasks";
import { useProjects } from "@/hooks/use-projects";
import { TaskItem } from "@/components/tasks/task-item";
import { InboxDispatchControls } from "@/components/inbox/dispatch-controls";
import { DroppableZone } from "@/components/dnd/droppable-zone";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TaskQuickAdd } from "@/components/tasks/task-quick-add";
import type { TaskQuickAddHandle } from "@/components/tasks/task-quick-add";
import { taskAge } from "@/lib/dates";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCallback, useRef, useState } from "react";
import type { Task, ProjectWithCounts } from "@todo/shared";

type SortKey = "added" | "title" | "deadline";

function sortTasks(tasks: Task[], key: SortKey): Task[] {
  if (key === "added") return tasks;
  if (key === "title") return tasks.slice().sort((a, b) => a.title.localeCompare(b.title));
  return tasks.slice().sort((a, b) => {
    if (a.deadline && b.deadline) return a.deadline.localeCompare(b.deadline);
    if (a.deadline) return -1;
    if (b.deadline) return 1;
    return 0;
  });
}

const SORT_LABELS: Record<SortKey, string> = {
  added: "Date added",
  title: "Title A → Z",
  deadline: "Deadline",
};

export default function InboxPage() {
  const { data: tasks = [], isLoading } = useTasks("inbox");
  const { data: allProjects = [] } = useProjects();
  const activeProjects = allProjects.filter((p) => !p.isCompleted) as ProjectWithCounts[];

  const [sortKey, setSortKey] = useState<SortKey>("added");
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const quickAddRef = useRef<TaskQuickAddHandle>(null);
  const handleToggle = useCallback(
    (id: string) => setExpandedTaskId((prev) => (prev === id ? null : id)),
    [],
  );

  const sorted = sortTasks(tasks, sortKey);

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Inbox</h1>
          {tasks.length > 0 && (
            <p className="text-sm text-muted-foreground/70 mt-0.5">
              {tasks.length} {tasks.length === 1 ? "item" : "items"} to process
            </p>
          )}
        </div>
        {tasks.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="rounded-md border border-border px-2.5 py-1 text-xs text-muted-foreground/60 hover:text-muted-foreground hover:border-border/80 transition-colors">
                Sort: {SORT_LABELS[sortKey]} ▾
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {(["added", "title", "deadline"] as SortKey[]).map((key) => (
                <DropdownMenuItem
                  key={key}
                  onClick={() => setSortKey(key)}
                  className={cn(sortKey === key && "font-medium")}
                >
                  {SORT_LABELS[key]}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Task list or empty state */}
      {isLoading ? (
        <div className="flex flex-col gap-1">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-10 rounded-lg bg-muted/40 animate-pulse" />
          ))}
        </div>
      ) : tasks.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-16 text-center">
          <Check className="h-8 w-8 text-muted-foreground/30" />
          <p className="text-sm font-medium text-muted-foreground/40">Inbox zero</p>
          <p className="text-xs text-muted-foreground/30">Everything's been dispatched.</p>
        </div>
      ) : (
        <DroppableZone id="section:inbox">
          <div className="flex flex-col">
            {sorted.map((task) => (
              <div key={task.id} className="group relative">
                <TaskItem
                  task={task}
                  isExpanded={expandedTaskId === task.id}
                  onToggle={handleToggle}
                  activeProjects={activeProjects}
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground/35 tabular-nums opacity-100 group-hover:opacity-0 transition-opacity">
                  {taskAge(task.createdAt)}
                </span>
                <InboxDispatchControls taskId={task.id} />
              </div>
            ))}
            <TaskQuickAdd ref={quickAddRef} />
          </div>
        </DroppableZone>
      )}
    </div>
  );
}
