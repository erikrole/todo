"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { toLocalDateStr } from "@/lib/dates";
import { useTasks } from "@/hooks/use-tasks";
import { TaskList } from "@/components/tasks/task-list";
import { DroppableZone } from "@/components/dnd/droppable-zone";
import { Progress } from "@/components/ui/progress";
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
  const overdueTasks = allTasks.filter((t) => !t.isCompleted && t.whenDate !== null && t.whenDate < today);

  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(loadCollapsed);

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
  const progressPct = totalForProgress > 0 ? (completedCount / totalForProgress) * 100 : 0;

  function tasksBySection(sectionId: TimeOfDay | null): Task[] {
    return allTasks
      .filter((t) => t.isCompleted || (t.whenDate !== null && t.whenDate >= today))
      .filter((t) => (t.timeOfDay ?? null) === sectionId)
      .sort((a, b) => {
        // Active tasks before completed tasks
        if (a.isCompleted !== b.isCompleted) return a.isCompleted ? 1 : -1;
        // Active: sort by scheduledTime ascending
        if (!a.isCompleted) {
          if (!a.scheduledTime && !b.scheduledTime) return 0;
          if (!a.scheduledTime) return 1;
          if (!b.scheduledTime) return -1;
          return a.scheduledTime.localeCompare(b.scheduledTime);
        }
        // Completed: sort by completedAt descending (most recent first)
        return (b.completedAt ?? "").localeCompare(a.completedAt ?? "");
      });
  }

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <div className="flex flex-col gap-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Today</h1>
          <p className="text-xs text-muted-foreground/50 mt-0.5">
            {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
          </p>
        </div>
        {totalForProgress > 0 && (
          <div className="flex items-center gap-3 px-4">
            <Progress value={progressPct} className="h-1.5 flex-1" />
            <span className="text-[11px] text-muted-foreground/40 shrink-0 tabular-nums">
              {completedCount}/{totalForProgress}
            </span>
          </div>
        )}
      </div>

      {isLoading ? (
        <TaskList tasks={[]} isLoading />
      ) : (
        <>
          {overdueTasks.length > 0 && (
            <section>
              <h2 className="text-[10px] font-semibold text-destructive/60 uppercase tracking-[0.12em] mb-1 px-4">
                Overdue
              </h2>
              <DroppableZone id="section:today:overdue">
                <TaskList tasks={overdueTasks} showWhenDate emptyMessage="" />
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
                  <h2 className="text-[10px] font-semibold text-muted-foreground/40 uppercase tracking-[0.12em]">
                    {label}
                  </h2>
                  <button
                    onClick={() => toggleSection(key)}
                    aria-label={isCollapsed ? `Expand ${label}` : `Collapse ${label}`}
                    className="text-muted-foreground/30 hover:text-muted-foreground/60 transition-colors"
                  >
                    {isCollapsed ? (
                      <span className="flex items-center gap-1 text-[10px] tabular-nums">
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
                      />
                    </DroppableZone>
                  </div>
                </div>
              </section>
            );
          })}
        </>
      )}
    </div>
  );
}
