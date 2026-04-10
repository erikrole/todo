"use client";

import { useTasks } from "@/hooks/use-tasks";
import { TaskList } from "@/components/tasks/task-list";
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
      <h1 className="text-xl font-semibold">Today</h1>

      {isLoading ? (
        <TaskList tasks={[]} isLoading />
      ) : (
        SECTIONS.map(({ id, label }) => {
          const sectionTasks = tasksBySection(id);
          if (sectionTasks.length === 0 && id !== null) return null;
          return (
            <section key={label}>
              <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">{label}</h2>
              <TaskList
                tasks={sectionTasks}
                quickAddDefaults={{ whenDate: todayStr, timeOfDay: id ?? undefined }}
                emptyMessage=""
              />
            </section>
          );
        })
      )}
    </div>
  );
}
