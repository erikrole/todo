"use client";

import { createContext, useContext, useState } from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import type { Task, TimeOfDay } from "@todo/shared";
import { useUpdateTask } from "@/hooks/use-tasks";

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function tomorrowStr() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

function resolveUpdate(dropId: string): Omit<Parameters<ReturnType<typeof useUpdateTask>["mutate"]>[0], "id"> | null {
  if (dropId === "sidebar:inbox" || dropId === "section:inbox") {
    return { whenDate: null, timeOfDay: null, isSomeday: false };
  }
  if (dropId === "sidebar:today") {
    return { whenDate: todayStr(), timeOfDay: null, isSomeday: false };
  }
  if (dropId === "sidebar:upcoming") {
    return { whenDate: tomorrowStr(), isSomeday: false };
  }
  if (dropId === "sidebar:someday" || dropId === "section:someday") {
    return { isSomeday: true, whenDate: null, timeOfDay: null };
  }
  if (dropId.startsWith("section:today:")) {
    const sub = dropId.slice("section:today:".length);
    return { whenDate: todayStr(), timeOfDay: sub === "anytime" ? null : (sub as TimeOfDay), isSomeday: false };
  }
  if (dropId.startsWith("section:upcoming:")) {
    const date = dropId.slice("section:upcoming:".length);
    return { whenDate: date, isSomeday: false };
  }
  if (dropId === "section:upcoming") {
    return { whenDate: tomorrowStr(), isSomeday: false };
  }
  if (dropId.startsWith("sidebar:project:") || dropId.startsWith("section:project:")) {
    const projectId = dropId.split(":").at(-1)!;
    return { projectId };
  }
  if (dropId.startsWith("sidebar:area:") || dropId.startsWith("section:area:")) {
    const areaId = dropId.split(":").at(-1)!;
    return { areaId };
  }
  return null;
}

interface DragCtxValue {
  activeTask: Task | null;
}

const DragCtx = createContext<DragCtxValue>({ activeTask: null });
export const useActiveTask = () => useContext(DragCtx);

export function TaskDndProvider({ children }: { children: React.ReactNode }) {
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const updateTask = useUpdateTask();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
  );

  function handleDragStart(event: DragStartEvent) {
    setActiveTask((event.active.data.current?.task as Task) ?? null);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveTask(null);
    if (!over) return;

    const task = active.data.current?.task as Task | undefined;
    if (!task) return;

    const patch = resolveUpdate(over.id as string);
    if (patch) updateTask.mutate({ id: task.id, ...patch });
  }

  return (
    <DragCtx.Provider value={{ activeTask }}>
      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        {children}
        <DragOverlay dropAnimation={null}>
          {activeTask && (
            <div className="bg-card border border-border rounded-lg px-3 py-2.5 shadow-xl text-sm max-w-xs truncate pointer-events-none">
              {activeTask.title}
            </div>
          )}
        </DragOverlay>
      </DndContext>
    </DragCtx.Provider>
  );
}
