"use client";

import { useTasks } from "@/hooks/use-tasks";
import { TaskList } from "@/components/tasks/task-list";
import { DroppableZone } from "@/components/dnd/droppable-zone";
import { formatWhenDate } from "@/lib/dates";
import type { Task } from "@todo/shared";

export default function UpcomingPage() {
  const { data: tasks = [], isLoading } = useTasks("upcoming");

  // Group by whenDate
  const groups = tasks.reduce<Map<string, Task[]>>((acc, task) => {
    const key = task.whenDate ?? "No date";
    if (!acc.has(key)) acc.set(key, []);
    acc.get(key)!.push(task);
    return acc;
  }, new Map());

  const sortedDates = [...groups.keys()].sort();

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <h1 className="text-xl font-semibold">Upcoming</h1>

      {isLoading ? (
        <TaskList tasks={[]} isLoading />
      ) : sortedDates.length === 0 ? (
        <DroppableZone id="section:upcoming">
          <p className="text-sm text-muted-foreground py-6 text-center">Nothing coming up.</p>
        </DroppableZone>
      ) : (
        sortedDates.map((date) => (
          <section key={date}>
            <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
              {date === "No date" ? date : formatWhenDate(date)}
            </h2>
            <DroppableZone id="section:upcoming">
              <TaskList tasks={groups.get(date) ?? []} quickAddDefaults={{ whenDate: date }} />
            </DroppableZone>
          </section>
        ))
      )}
    </div>
  );
}
