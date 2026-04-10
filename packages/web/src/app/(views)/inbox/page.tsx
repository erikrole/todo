"use client";

import { useTasks } from "@/hooks/use-tasks";
import { TaskList } from "@/components/tasks/task-list";
import { DroppableZone } from "@/components/dnd/droppable-zone";

export default function InboxPage() {
  const { data: tasks = [], isLoading } = useTasks("inbox");

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <h1 className="text-lg font-semibold tracking-tight">Inbox</h1>
      <DroppableZone id="section:inbox">
        <TaskList tasks={tasks} isLoading={isLoading} emptyMessage="No tasks in your inbox." />
      </DroppableZone>
    </div>
  );
}
