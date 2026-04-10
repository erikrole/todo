"use client";

import { useTasks } from "@/hooks/use-tasks";
import { TaskList } from "@/components/tasks/task-list";
import { DroppableZone } from "@/components/dnd/droppable-zone";
import { Progress } from "@/components/ui/progress";
import type { Task, TimeOfDay } from "@todo/shared";

const SECTIONS: { id: TimeOfDay | null; label: string }[] = [
  { id: "morning", label: "Morning" },
  { id: "day", label: "Day" },
  { id: "night", label: "Night" },
  { id: null, label: "Anytime" },
];

const todayStr = new Date().toISOString().slice(0, 10);

export default function TodayPage() {
  const { data: activeTasks = [], isLoading } = useTasks("today");
  const { data: completedTodayTasks = [] } = useTasks("completed_today");

  const totalForProgress = activeTasks.filter((t) => !t.isCancelled).length + completedTodayTasks.length;
  const progressPct = totalForProgress > 0 ? (completedTodayTasks.length / totalForProgress) * 100 : 0;

  function tasksBySection(sectionId: TimeOfDay | null): Task[] {
    return activeTasks.filter((t) => (t.timeOfDay ?? null) === sectionId);
  }

  function completedBySection(sectionId: TimeOfDay | null): Task[] {
    return completedTodayTasks.filter((t) => (t.timeOfDay ?? null) === sectionId);
  }

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <div className="flex flex-col gap-2">
        <h1 className="text-lg font-semibold tracking-tight">Today</h1>
        {totalForProgress > 0 && (
          <div className="flex items-center gap-3 px-4">
            <Progress value={progressPct} className="h-1.5 flex-1" />
            <span className="text-[11px] text-muted-foreground/40 font-mono shrink-0 tabular-nums">
              {completedTodayTasks.length}/{totalForProgress}
            </span>
          </div>
        )}
      </div>

      {isLoading ? (
        <TaskList tasks={[]} isLoading />
      ) : (
        SECTIONS.map(({ id, label }) => {
          const dropId = `section:today:${id ?? "anytime"}`;
          const active = tasksBySection(id);
          const completed = completedBySection(id);
          return (
            <section key={label}>
              <h2 className="text-[10px] font-semibold text-muted-foreground/40 uppercase tracking-[0.12em] mb-1 px-4">
                {label}
              </h2>
              <DroppableZone id={dropId}>
                <TaskList
                  tasks={active}
                  quickAddDefaults={{ whenDate: todayStr, timeOfDay: id ?? undefined }}
                  emptyMessage=""
                />
                {completed.map((task) => (
                  <div
                    key={task.id}
                    className="flex items-center gap-3 py-2 pl-4 pr-3 border-l-2 border-transparent opacity-40"
                  >
                    <div className="h-4 w-4 rounded-full border-2 border-primary/60 bg-primary/60 shrink-0 mt-[3px]" />
                    <span className="text-sm line-through text-muted-foreground leading-snug tracking-[-0.006em]">
                      {task.title}
                    </span>
                  </div>
                ))}
              </DroppableZone>
            </section>
          );
        })
      )}
    </div>
  );
}
