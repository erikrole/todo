"use client";

import { useTasks, useRestoreTask } from "@/hooks/use-tasks";
import { ViewHeader } from "@/components/upshot/view-header";

export default function V2TrashPage() {
  const { data: tasks = [], isLoading } = useTasks("trash");
  const restoreTask = useRestoreTask();

  return (
    <div style={{ maxWidth: 640 }}>
      <ViewHeader title="Trash" subtitle={tasks.length > 0 ? `${tasks.length} deleted items` : undefined} />
      {isLoading ? (
        <LoadingSkeleton />
      ) : tasks.length === 0 ? (
        <div style={{ padding: "48px 16px", textAlign: "center" }}>
          <p style={{ fontSize: 13, color: "var(--ink-4)", margin: 0 }}>Trash is empty.</p>
        </div>
      ) : (
        tasks.map((t) => (
          <div
            key={t.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "6px 16px",
            }}
          >
            <span
              style={{
                flex: 1,
                fontSize: 14,
                color: "var(--ink-4)",
                textDecoration: "line-through",
              }}
            >
              {t.title}
            </span>
            {t.deletedAt && (
              <span style={{ fontSize: 11, color: "var(--ink-4)", fontVariantNumeric: "tabular-nums" }}>
                {t.deletedAt.slice(0, 10)}
              </span>
            )}
            <button
              onClick={() => restoreTask.mutate(t.id)}
              style={{
                fontSize: 11,
                color: "var(--accent-ink)",
                padding: "2px 8px",
                background: "var(--accent-soft)",
                borderRadius: 5,
                cursor: "pointer",
              }}
            >
              Restore
            </button>
          </div>
        ))
      )}
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div style={{ padding: "0 16px", display: "flex", flexDirection: "column", gap: 8 }}>
      {[...Array(3)].map((_, i) => (
        <div key={i} style={{ height: 36, borderRadius: 8, background: "var(--surface-2)" }} />
      ))}
    </div>
  );
}
