"use client";

import { useTasks } from "@/hooks/use-tasks";
import { ViewHeader } from "@/components/upshot/view-header";
import { TaskList } from "@/components/tasks/task-list";

export default function V2SomedayPage() {
  const { data: tasks = [], isLoading } = useTasks("someday");

  return (
    <div style={{ maxWidth: 640, padding: "0 0 48px" }}>
      <ViewHeader title="Someday" subtitle="Ideas and intentions without a date." />
      <TaskList tasks={tasks} isLoading={isLoading} emptyMessage="Nothing here yet." />
    </div>
  );
}
