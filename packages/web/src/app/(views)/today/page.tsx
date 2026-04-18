"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronDown, ChevronRight, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { toLocalDateStr, taskAge } from "@/lib/dates";
import { useTasks } from "@/hooks/use-tasks";
import { TaskList } from "@/components/tasks/task-list";
import { DroppableZone } from "@/components/dnd/droppable-zone";
import { TodayProgress } from "@/components/today/today-progress";
import { TodayRoutineRow } from "@/components/today/today-routine-row";
import { TodaySnoozeControls } from "@/components/today/snooze-controls";
import type { Task, TimeOfDay } from "@todo/shared";

const SECTIONS: { id: TimeOfDay | null; label: string; key: string }[] = [
  { id: "morning", label: "Morning", key: "morning" },
  { id: "day", label: "Day", key: "day" },
  { id: "night", label: "Night", key: "night" },
  { id: null, label: "Anytime", key: "anytime" },
];

const STORAGE_KEY = "todo-today-sections-collapsed";

function loadCollapsed(): Record<string, boolean> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, boolean>) : {};
  } catch {
    return {};
  }
}

export default function TodayPage() {
  const today = toLocalDateStr(new Date());
  const { data: allTasks = [], isLoading } = useTasks("today_all");
  const { data: routineTasks = [] } = useTasks("routines");

  const overdueTasks = allTasks.filter(
    (t) => !t.isCompleted && t.whenDate !== null && t.whenDate < today,
  );
  const dueRoutines = routineTasks.filter(
    (t) => t.whenDate !== null && t.whenDate <= today,
  );

  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setCollapsed(loadCollapsed());
  }, []);

  function toggleSection(key: string) {
    setCollapsed((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  }

  const completedCount = allTasks.filter((t) => t.isCompleted && !t.isCancelled).length;
  const totalForProgress = allTasks.filter((t) => !t.isCancelled).length;
  const allDone = totalForProgress > 0 && completedCount === totalForProgress;

  function tasksBySection(sectionId: TimeOfDay | null): Task[] {
    return allTasks
      .filter((t) => t.isCompleted || (t.whenDate !== null && t.whenDate >= today))
      .filter((t) => (t.timeOfDay ?? null) === sectionId)
      .sort((a, b) => {
        if (a.isCompleted !== b.isCompleted) return a.isCompleted ? 1 : -1;
        if (!a.isCompleted) {
          if (!a.scheduledTime && !b.scheduledTime) return 0;
          if (!a.scheduledTime) return 1;
          if (!b.scheduledTime) return -1;
          return a.scheduledTime.localeCompare(b.scheduledTime);
        }
        return (b.completedAt ?? "").localeCompare(a.completedAt ?? "");
      });
  }

  const snoozeControls = useCallback(
    (task: Task) => <TodaySnoozeControls taskId={task.id} />,
    [],
  );

  const overdueRowSuffix = useCallback(
    (task: Task) => (
      <>
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground/35 tabular-nums opacity-100 group-hover:opacity-0 transition-opacity">
          {taskAge(task.createdAt)}
        </span>
        <TodaySnoozeControls taskId={task.id} />
      </>
    ),
    [],
  );

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <div className="flex flex-col gap-2">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Today</h1>
          <p className="text-sm text-muted-foreground/70 mt-0.5">
            {new Date().toLocaleDateString("en-US", {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
          </p>
        </div>
        <TodayProgress completed={completedCount} total={totalForProgress} />
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-1">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-10 rounded-lg bg-muted/40 animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          {dueRoutines.length > 0 && (
            <section>
              <div className="flex items-center justify-between px-4 mb-1">
                <h2 className="text-xs font-semibold text-muted-foreground/70 uppercase tracking-[0.12em]">
                  Routines
                  <span className="ml-1.5 text-muted-foreground/50 normal-case font-normal">
                    {dueRoutines.length} due
                  </span>
                </h2>
                <button
                  onClick={() => toggleSection("routines")}
                  aria-label={collapsed["routines"] ? "Expand Routines" : "Collapse Routines"}
                  className="text-muted-foreground/55 hover:text-muted-foreground/80 transition-colors"
                >
                  {collapsed["routines"] ? (
                    <span className="flex items-center gap-1 text-xs tabular-nums">
                      {dueRoutines.length}
                      <ChevronRight className="h-3 w-3" />
                    </span>
                  ) : (
                    <ChevronDown className="h-3 w-3" />
                  )}
                </button>
              </div>
              <div
                className={cn(
                  "grid transition-[grid-template-rows,opacity] duration-200 ease-in-out",
                  collapsed["routines"]
                    ? "grid-rows-[0fr] opacity-0"
                    : "grid-rows-[1fr] opacity-100",
                )}
              >
                <div className="overflow-hidden">
                  {dueRoutines.map((r) => (
                    <TodayRoutineRow key={r.id} task={r} />
                  ))}
                </div>
              </div>
            </section>
          )}

          {overdueTasks.length > 0 && (
            <section>
              <h2 className="text-xs font-semibold text-destructive/80 uppercase tracking-[0.12em] mb-1 px-4">
                Overdue
              </h2>
              <DroppableZone id="section:today:overdue">
                <TaskList
                  tasks={overdueTasks}
                  showWhenDate
                  emptyMessage=""
                  renderRowSuffix={overdueRowSuffix}
                />
              </DroppableZone>
            </section>
          )}

          {SECTIONS.map(({ id, label, key }) => {
            const dropId = `section:today:${key}`;
            const sectionTasks = tasksBySection(id);
            const hasContent = sectionTasks.length > 0;
            if (!hasContent) return null;

            const isCollapsed = !!collapsed[key];
            const taskCount = sectionTasks.length;

            return (
              <section key={label}>
                <div className="flex items-center justify-between px-4 mb-1">
                  <h2 className="text-xs font-semibold text-muted-foreground/70 uppercase tracking-[0.12em]">
                    {label}
                  </h2>
                  <button
                    onClick={() => toggleSection(key)}
                    aria-label={isCollapsed ? `Expand ${label}` : `Collapse ${label}`}
                    className="text-muted-foreground/55 hover:text-muted-foreground/80 transition-colors"
                  >
                    {isCollapsed ? (
                      <span className="flex items-center gap-1 text-xs tabular-nums">
                        {taskCount}
                        <ChevronRight className="h-3 w-3" />
                      </span>
                    ) : (
                      <ChevronDown className="h-3 w-3" />
                    )}
                  </button>
                </div>
                <div
                  className={cn(
                    "grid transition-[grid-template-rows,opacity] duration-200 ease-in-out",
                    isCollapsed ? "grid-rows-[0fr] opacity-0" : "grid-rows-[1fr] opacity-100",
                  )}
                >
                  <div className="overflow-hidden">
                    <DroppableZone id={dropId}>
                      <TaskList
                        tasks={sectionTasks}
                        quickAddDefaults={{ whenDate: today, timeOfDay: id ?? undefined }}
                        emptyMessage=""
                        renderRowSuffix={snoozeControls}
                      />
                    </DroppableZone>
                  </div>
                </div>
              </section>
            );
          })}

          {allDone && (
            <div className="flex flex-col items-center gap-2 py-12 text-center">
              <Sparkles className="h-6 w-6 text-muted-foreground/25" />
              <p className="text-sm font-medium text-muted-foreground/40">All done for today</p>
              <p className="text-xs text-muted-foreground/30">Come back tomorrow.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
