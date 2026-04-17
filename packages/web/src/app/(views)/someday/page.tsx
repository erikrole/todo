"use client";

import { useTasks } from "@/hooks/use-tasks";
import { TaskList } from "@/components/tasks/task-list";
import { DroppableZone } from "@/components/dnd/droppable-zone";

export default function SomedayPage() {
  const { data: tasks = [], isLoading } = useTasks("someday");

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <h1 className="text-3xl font-bold tracking-tight">Someday</h1>
      <DroppableZone id="section:someday">
        <TaskList
          tasks={tasks}
          isLoading={isLoading}
          emptyMessage="No someday tasks. Add tasks here for things you want to do eventually."
        />
      </DroppableZone>
    </div>
  );
}
