"use client";

import { useTasks, useRestoreTask, useDeleteTaskPermanent, usePurgeTrashedTasks } from "@/hooks/use-tasks";
import { ViewHeader } from "@/components/upshot/view-header";
import { useQueryClient } from "@tanstack/react-query";

export default function V2TrashPage() {
  const { data: tasks = [], isLoading } = useTasks("trash");
  const restoreTask = useRestoreTask();
  const deleteForever = useDeleteTaskPermanent();
  const purge = usePurgeTrashedTasks();
  const qc = useQueryClient();

  function handleEmptyTrash() {
    if (!confirm(`Permanently delete all ${tasks.length} item${tasks.length === 1 ? "" : "s"}? This cannot be undone.`)) return;
    purge.mutate(undefined, {
      onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
    });
  }

  return (
    <div style={{ maxWidth: 640 }}>
      <ViewHeader
        title="Trash"
        subtitle={tasks.length > 0 ? `${tasks.length} deleted item${tasks.length === 1 ? "" : "s"}` : undefined}
      />
      {isLoading ? (
        <LoadingSkeleton />
      ) : tasks.length === 0 ? (
        <div style={{ padding: "48px 16px", textAlign: "center" }}>
          <p style={{ fontSize: 13, color: "var(--ink-4)", margin: 0 }}>Trash is empty.</p>
        </div>
      ) : (
        <>
          <div style={{ padding: "0 16px 12px", display: "flex", justifyContent: "flex-end" }}>
            <button
              onClick={handleEmptyTrash}
              disabled={purge.isPending}
              style={{
                fontSize: 12,
                color: "#ef4444",
                padding: "4px 10px",
                background: "color-mix(in srgb, #ef4444 8%, transparent)",
                border: "1px solid color-mix(in srgb, #ef4444 25%, transparent)",
                borderRadius: 6,
                cursor: "pointer",
                opacity: purge.isPending ? 0.5 : 1,
              }}
            >
              Empty Trash
            </button>
          </div>
          {tasks.map((t) => (
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
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {t.title}
              </span>
              {t.deletedAt && (
                <span style={{ fontSize: 11, color: "var(--ink-4)", fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>
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
                  flexShrink: 0,
                }}
              >
                Restore
              </button>
              <button
                onClick={() => {
                  if (!confirm("Delete this task permanently? This cannot be undone.")) return;
                  deleteForever.mutate(t.id);
                }}
                disabled={deleteForever.isPending}
                style={{
                  fontSize: 11,
                  color: "#ef4444",
                  padding: "2px 8px",
                  background: "color-mix(in srgb, #ef4444 8%, transparent)",
                  border: "1px solid color-mix(in srgb, #ef4444 25%, transparent)",
                  borderRadius: 5,
                  cursor: "pointer",
                  flexShrink: 0,
                }}
              >
                Delete Forever
              </button>
            </div>
          ))}
        </>
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
