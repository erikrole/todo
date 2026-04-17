"use client";

import { useTasks } from "@/hooks/use-tasks";
import { useProjects } from "@/hooks/use-projects";
import { TaskItem } from "@/components/tasks/task-item";
import { Skeleton } from "@/components/ui/skeleton";
import { useCallback, useState } from "react";
import type { Task, ProjectWithCounts } from "@todo/shared";

export default function LogbookPage() {
  const { data: tasks = [], isLoading } = useTasks("completed");
  const { data: allProjects = [] } = useProjects();
  const activeProjects = allProjects.filter((p) => !p.isCompleted) as ProjectWithCounts[];
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const handleToggle = useCallback(
    (id: string) => setExpandedTaskId((prev) => (prev === id ? null : id)),
    [],
  );

  // Group by completion date
  const groups = tasks.reduce<Map<string, Task[]>>((acc, task) => {
    const key = task.completedAt?.slice(0, 10) ?? "Unknown";
    if (!acc.has(key)) acc.set(key, []);
    acc.get(key)!.push(task);
    return acc;
  }, new Map());

  const sortedDates = [...groups.keys()].sort().reverse();

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <h1 className="text-3xl font-bold tracking-tight">Logbook</h1>

      {isLoading ? (
        <div className="flex flex-col gap-2">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-10 w-full rounded-lg" />
          ))}
        </div>
      ) : sortedDates.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center">No completed tasks yet.</p>
      ) : (
        sortedDates.map((date) => (
          <section key={date}>
            <h2 className="text-xs font-semibold text-muted-foreground/70 uppercase tracking-[0.12em] mb-1 px-4">
              {new Date(date + "T00:00:00").toLocaleDateString("en-US", {
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
            </h2>
            <div className="flex flex-col">
              {(groups.get(date) ?? []).map((task) => (
                <TaskItem
                  key={task.id}
                  task={task}
                  isExpanded={expandedTaskId === task.id}
                  onToggle={handleToggle}
                  activeProjects={activeProjects}
                  showWhenDate
                />
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
