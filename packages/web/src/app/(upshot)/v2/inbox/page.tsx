"use client";

import { useTasks } from "@/hooks/use-tasks";
import { ViewHeader } from "@/components/upshot/view-header";
import { UpshootTaskRow } from "@/components/upshot/task-row";

export default function V2InboxPage() {
  const { data: tasks = [], isLoading } = useTasks("inbox");

  return (
    <div style={{ maxWidth: 640 }}>
      <ViewHeader title="Inbox" subtitle={tasks.length > 0 ? `${tasks.length} to process` : undefined} />
      {isLoading ? (
        <LoadingSkeleton />
      ) : tasks.length === 0 ? (
        <EmptyState message="Inbox zero." sub="Everything's been dispatched." />
      ) : (
        tasks.map((t) => <UpshootTaskRow key={t.id} task={t} />)
      )}
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div style={{ padding: "0 16px", display: "flex", flexDirection: "column", gap: 8 }}>
      {[...Array(4)].map((_, i) => (
        <div key={i} style={{ height: 36, borderRadius: 8, background: "var(--surface-2)" }} />
      ))}
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
