"use client";

import { useTasks } from "@/hooks/use-tasks";
import { ViewHeader } from "@/components/upshot/view-header";
import type { Task } from "@todo/shared";

export default function V2LogbookPage() {
  const { data: tasks = [], isLoading } = useTasks("completed");

  const groups = tasks.reduce<Map<string, Task[]>>((acc, task) => {
    const key = task.completedAt ? task.completedAt.slice(0, 10) : "Unknown";
    if (!acc.has(key)) acc.set(key, []);
    acc.get(key)!.push(task);
    return acc;
  }, new Map());

  const sortedDates = [...groups.keys()].sort().reverse();

  return (
    <div style={{ maxWidth: 640 }}>
      <ViewHeader title="Logbook" subtitle="Completed tasks." />
      {isLoading ? (
        <LoadingSkeleton />
      ) : sortedDates.length === 0 ? (
        <div style={{ padding: "48px 16px", textAlign: "center" }}>
          <p style={{ fontSize: 13, color: "var(--ink-4)", margin: 0 }}>Nothing logged yet.</p>
        </div>
      ) : (
        sortedDates.map((date) => (
          <section key={date} style={{ marginBottom: 24 }}>
            <div style={{ padding: "0 16px 6px 16px" }}>
              <span
                style={{
                  fontSize: 11,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  color: "var(--ink-4)",
                  fontWeight: 600,
                }}
              >
                {date}
              </span>
            </div>
            {(groups.get(date) ?? []).map((t) => (
              <div
                key={t.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "6px 16px",
                }}
              >
                <div
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: 6,
                    background: "var(--accent)",
                    flexShrink: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round">
                    <path d="M2 5l2.5 2.5L8 3" />
                  </svg>
                </div>
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
                {t.completedAt && (
                  <span style={{ fontSize: 11, color: "var(--ink-4)", fontVariantNumeric: "tabular-nums" }}>
                    {t.completedAt.slice(11, 16)}
                  </span>
                )}
              </div>
            ))}
          </section>
        ))
      )}
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div style={{ padding: "0 16px", display: "flex", flexDirection: "column", gap: 8 }}>
      {[...Array(5)].map((_, i) => (
        <div key={i} style={{ height: 36, borderRadius: 8, background: "var(--surface-2)" }} />
      ))}
    </div>
  );
}
