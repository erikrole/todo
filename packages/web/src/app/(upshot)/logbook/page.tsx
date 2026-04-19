"use client";

import { useTasks } from "@/hooks/use-tasks";
import { ViewHeader } from "@/components/upshot/view-header";
import { TaskList } from "@/components/tasks/task-list";
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

  if (isLoading) {
    return (
      <div style={{ maxWidth: 640 }}>
        <ViewHeader title="Logbook" subtitle="Completed tasks." />
        <div style={{ padding: "0 16px", display: "flex", flexDirection: "column", gap: 8 }}>
          {[...Array(5)].map((_, i) => (
            <div key={i} style={{ height: 36, borderRadius: 8, background: "var(--surface-2)" }} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 640, padding: "0 0 48px" }}>
      <ViewHeader title="Logbook" subtitle="Completed tasks." />
      {sortedDates.length === 0 ? (
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
            <TaskList tasks={groups.get(date) ?? []} />
          </section>
        ))
      )}
    </div>
  );
}
