"use client";

import { useTasks } from "@/hooks/use-tasks";
import { ViewHeader } from "@/components/upshot/view-header";
import { UpshootTaskRow } from "@/components/upshot/task-row";

export default function V2SomedayPage() {
  const { data: tasks = [], isLoading } = useTasks("someday");

  return (
    <div style={{ maxWidth: 640 }}>
      <ViewHeader title="Someday" subtitle="Ideas and intentions without a date." />
      {isLoading ? (
        <LoadingSkeleton />
      ) : tasks.length === 0 ? (
        <div style={{ padding: "48px 16px", textAlign: "center" }}>
          <p style={{ fontFamily: "var(--font-display)", fontSize: 18, fontStyle: "italic", color: "var(--ink-3)", margin: 0 }}>
            Nothing here yet.
          </p>
        </div>
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
