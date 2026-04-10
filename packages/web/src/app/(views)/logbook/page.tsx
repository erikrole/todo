"use client";

import { useTasks } from "@/hooks/use-tasks";
import { TaskItem } from "@/components/tasks/task-item";
import { TaskDetail } from "@/components/tasks/task-detail";
import { Skeleton } from "@/components/ui/skeleton";
import { useState } from "react";
import type { Task } from "@todo/shared";

export default function LogbookPage() {
  const { data: tasks = [], isLoading } = useTasks("completed");
  const [selected, setSelected] = useState<Task | null>(null);

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
      <h1 className="text-xl font-semibold">Logbook</h1>

      {isLoading ? (
        <div className="flex flex-col gap-2">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-10 w-full rounded-lg" />)}
        </div>
      ) : sortedDates.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center">No completed tasks yet.</p>
      ) : (
        sortedDates.map((date) => (
          <section key={date}>
            <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
              {new Date(date + "T00:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
            </h2>
            <div className="flex flex-col">
              {(groups.get(date) ?? []).map((task) => (
                <TaskItem key={task.id} task={task} onOpen={setSelected} showWhenDate />
              ))}
            </div>
          </section>
        ))
      )}

      {selected && (
        <TaskDetail task={selected} open={!!selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}
