"use client";

import { useTasks } from "@/hooks/use-tasks";
import { TaskList } from "@/components/tasks/task-list";

export default function InboxPage() {
  const { data: tasks = [], isLoading } = useTasks("inbox");

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <h1 className="text-xl font-semibold">Inbox</h1>
      <TaskList
        tasks={tasks}
        isLoading={isLoading}
        emptyMessage="No tasks in your inbox."
      />
    </div>
  );
}
