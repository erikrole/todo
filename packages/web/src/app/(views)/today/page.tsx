"use client";

import { useTasks } from "@/hooks/use-tasks";
import { TaskList } from "@/components/tasks/task-list";
import { DroppableZone } from "@/components/dnd/droppable-zone";
import type { Task, TimeOfDay } from "@todo/shared";

const SECTIONS: { id: TimeOfDay | null; label: string }[] = [
  { id: "morning", label: "Morning" },
  { id: "day", label: "Day" },
  { id: "night", label: "Night" },
  { id: null, label: "Anytime" },
];

const todayStr = new Date().toISOString().slice(0, 10);

export default function TodayPage() {
  const { data: tasks = [], isLoading } = useTasks("today");

  function tasksBySection(sectionId: TimeOfDay | null): Task[] {
    return tasks.filter((t) => (t.timeOfDay ?? null) === sectionId);
  }

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <h1 className="text-lg font-semibold tracking-tight">Today</h1>

      {isLoading ? (
        <TaskList tasks={[]} isLoading />
      ) : (
        SECTIONS.map(({ id, label }) => {
          const dropId = `section:today:${id ?? "anytime"}`;
          return (
            <section key={label}>
              <h2 className="text-[10px] font-semibold text-muted-foreground/40 uppercase tracking-[0.12em] mb-1 px-4">{label}</h2>
              <DroppableZone id={dropId}>
                <TaskList
                  tasks={tasksBySection(id)}
                  quickAddDefaults={{ whenDate: todayStr, timeOfDay: id ?? undefined }}
                  emptyMessage=""
                />
              </DroppableZone>
            </section>
          );
        })
      )}
    </div>
  );
}
