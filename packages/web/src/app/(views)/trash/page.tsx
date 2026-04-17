"use client";

import { useEffect } from "react";
import { useTasks, useRestoreTask, useDeleteTaskPermanent, usePurgeTrashedTasks } from "@/hooks/use-tasks";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { Task } from "@todo/shared";

export default function TrashPage() {
  const { data: tasks = [], isLoading } = useTasks("trash");
  const purge = usePurgeTrashedTasks();
  // Fire-and-forget purge of tasks older than 30 days when the trash view opens.
  // Moved out of the GET handler so reads stay idempotent.
  useEffect(() => { purge.mutate(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const restoreTask = useRestoreTask();
  const deleteForever = useDeleteTaskPermanent();

  const groups = tasks.reduce<Map<string, Task[]>>((acc, task) => {
    const key = task.deletedAt?.slice(0, 10) ?? "Unknown";
    if (!acc.has(key)) acc.set(key, []);
    acc.get(key)!.push(task);
    return acc;
  }, new Map());

  const sortedDates = [...groups.keys()].sort().reverse();

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <div className="flex items-baseline gap-3">
        <h1 className="text-3xl font-bold tracking-tight">Trash</h1>
        <span className="text-xs text-muted-foreground/40">Items are deleted after 30 days.</span>
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-2">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-10 w-full rounded-lg" />
          ))}
        </div>
      ) : sortedDates.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center">Trash is empty.</p>
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
            <div className="flex flex-col gap-1">
              {(groups.get(date) ?? []).map((task) => (
                <div
                  key={task.id}
                  className="flex items-center justify-between px-4 py-2.5 rounded-lg border border-border/40 bg-card/50"
                >
                  <span className="text-sm text-muted-foreground/50 line-through truncate mr-4">
                    {task.title}
                  </span>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs px-2"
                      onClick={() => restoreTask.mutate(task.id)}
                      disabled={restoreTask.isPending && restoreTask.variables === task.id}
                    >
                      Restore
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs px-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => deleteForever.mutate(task.id)}
                      disabled={deleteForever.isPending && deleteForever.variables === task.id}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
