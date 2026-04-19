"use client";

import { useTasks } from "@/hooks/use-tasks";
import { ViewHeader } from "@/components/upshot/view-header";
import { TaskList } from "@/components/tasks/task-list";

export default function V2InboxPage() {
  const { data: tasks = [], isLoading } = useTasks("inbox");

  return (
    <div style={{ maxWidth: 640, padding: "0 0 48px" }}>
      <ViewHeader title="Inbox" subtitle={tasks.length > 0 ? `${tasks.length} to process` : undefined} />
      {tasks.length === 0 && !isLoading ? (
        <EmptyState message="Inbox zero." sub="Everything's been dispatched." />
      ) : (
        <TaskList tasks={tasks} isLoading={isLoading} emptyMessage="" />
      )}
    </div>
  );
}

function EmptyState({ message, sub }: { message: string; sub: string }) {
  return (
    <div style={{ padding: "48px 16px", textAlign: "center" }}>
      <p style={{ fontFamily: "var(--font-display)", fontSize: 18, color: "var(--ink-2)", margin: "0 0 4px 0" }}>
        {message}
      </p>
      <p style={{ fontSize: 13, color: "var(--ink-4)", margin: 0 }}>{sub}</p>
    </div>
  );
}
