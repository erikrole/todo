"use client";

import { useTasks } from "@/hooks/use-tasks";
import { formatWhenDate } from "@/lib/dates";
import { ViewHeader } from "@/components/upshot/view-header";
import { UpshootTaskRow } from "@/components/upshot/task-row";
import type { Task } from "@todo/shared";

export default function V2UpcomingPage() {
  const { data: tasks = [], isLoading } = useTasks("upcoming");

  const groups = tasks.reduce<Map<string, Task[]>>((acc, task) => {
    const key = task.whenDate ?? "No date";
    if (!acc.has(key)) acc.set(key, []);
    acc.get(key)!.push(task);
    return acc;
  }, new Map());

  const sortedDates = [...groups.keys()].sort();

  return (
    <div style={{ maxWidth: 640 }}>
      <ViewHeader title="Upcoming" />
      {isLoading ? (
        <LoadingSkeleton />
      ) : sortedDates.length === 0 ? (
        <EmptyState />
      ) : (
        sortedDates.map((date) => (
          <section key={date} style={{ marginBottom: 24 }}>
            <div
              style={{
                display: "flex",
                gap: 24,
                padding: "0 16px 6px 16px",
                alignItems: "baseline",
              }}
            >
              <span
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: 14,
                  fontWeight: 500,
                  color: "var(--ink-2)",
                  minWidth: 120,
                }}
              >
                {date === "No date" ? date : formatWhenDate(date)}
              </span>
              <span style={{ fontSize: 11, color: "var(--ink-4)" }}>{groups.get(date)?.length}</span>
            </div>
            {(groups.get(date) ?? []).map((t) => (
              <UpshootTaskRow key={t.id} task={t} />
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

function EmptyState() {
  return (
    <div style={{ padding: "48px 16px", textAlign: "center" }}>
      <p style={{ fontFamily: "var(--font-display)", fontSize: 18, color: "var(--ink-2)", margin: "0 0 4px 0" }}>
        Nothing coming up.
      </p>
      <p style={{ fontSize: 13, color: "var(--ink-4)", margin: 0 }}>Your schedule is clear.</p>
    </div>
  );
}
