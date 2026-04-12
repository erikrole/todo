"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, ChevronRight } from "lucide-react";
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
  const todayStr = new Date().toISOString().slice(0, 10);
  const { data: activeTasks = [], isLoading } = useTasks("today");
  const { data: completedTodayTasks = [] } = useTasks("completed_today");
  const { data: overdueTasks = [] } = useTasks("overdue");

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

  const totalForProgress = activeTasks.filter((t) => !t.isCancelled).length + completedTodayTasks.length;
  const progressPct = totalForProgress > 0 ? (completedTodayTasks.length / totalForProgress) * 100 : 0;

  function tasksBySection(sectionId: TimeOfDay | null): Task[] {
    return activeTasks
      .filter((t) => (t.timeOfDay ?? null) === sectionId)
      .sort((a, b) => {
        if (!a.scheduledTime && !b.scheduledTime) return 0;
        if (!a.scheduledTime) return 1;
        if (!b.scheduledTime) return -1;
        return a.scheduledTime.localeCompare(b.scheduledTime);
      });
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
            const active = tasksBySection(id);
            const completed = completedBySection(id);
            const hasContent = active.length > 0 || completed.length > 0;
            if (!hasContent) return null;

            const isCollapsed = !!collapsed[key];
            const taskCount = active.length + completed.length;

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
                <AnimatePresence initial={false}>
                  {!isCollapsed && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.18, ease: "easeInOut" }}
                      style={{ overflow: "hidden" }}
                    >
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
                    </motion.div>
                  )}
                </AnimatePresence>
              </section>
            );
          })}
        </>
      )}
    </div>
  );
}
