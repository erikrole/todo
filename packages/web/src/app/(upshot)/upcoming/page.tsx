"use client";

import { useTasks } from "@/hooks/use-tasks";
import { ViewHeader } from "@/components/upshot/view-header";
import { TaskList } from "@/components/tasks/task-list";
import type { Task } from "@todo/shared";

function parseDateParts(date: string) {
  const d = new Date(date + "T00:00:00");
  const weekday = d.toLocaleDateString("en-US", { weekday: "long" });
  const day = d.toLocaleDateString("en-US", { day: "numeric" });
  const month = d.toLocaleDateString("en-US", { month: "long" });
  const year = d.toLocaleDateString("en-US", { year: "numeric" });
  return { weekday, day, month, year };
}

export default function V2UpcomingPage() {
  const { data: tasks = [], isLoading } = useTasks("upcoming");

  const groups = tasks.reduce<Map<string, Task[]>>((acc, task) => {
    const key = task.whenDate ?? "No date";
    if (!acc.has(key)) acc.set(key, []);
    acc.get(key)!.push(task);
    return acc;
  }, new Map());

  const sortedDates = [...groups.keys()].sort();

  if (isLoading) {
    return (
      <div style={{ maxWidth: 820, padding: "0 32px" }}>
        <ViewHeader title="Upcoming" />
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {[...Array(5)].map((_, i) => (
            <div key={i} style={{ height: 36, borderRadius: 8, background: "var(--surface-2)" }} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 820, padding: "0 32px 48px" }}>
      <ViewHeader title="Upcoming" />
      {sortedDates.length === 0 ? (
        <EmptyState />
      ) : (
        sortedDates.map((date, i) => {
          const isNoDate = date === "No date";
          const parts = isNoDate ? null : parseDateParts(date);
          return (
            <div
              key={date}
              style={{
                display: "grid",
                gridTemplateColumns: "140px 1fr",
                borderTop: i === 0 ? undefined : "1px solid var(--hairline)",
                paddingTop: i === 0 ? 0 : 24,
                marginTop: i === 0 ? 0 : 0,
                paddingBottom: 8,
              }}
            >
              {/* Left: date label */}
              <div style={{ paddingTop: 6 }}>
                {isNoDate ? (
                  <span
                    style={{
                      fontFamily: "var(--font-display)",
                      fontSize: 18,
                      fontWeight: 500,
                      color: "var(--ink-2)",
                    }}
                  >
                    No date
                  </span>
                ) : (
                  <>
                    <div
                      style={{
                        fontFamily: "var(--font-display)",
                        fontSize: 18,
                        fontWeight: 500,
                        color: "var(--ink-1)",
                        lineHeight: 1.2,
                      }}
                    >
                      {parts!.weekday} {parts!.day}
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        color: "var(--ink-4)",
                        marginTop: 2,
                      }}
                    >
                      {parts!.month} {parts!.year}
                    </div>
                  </>
                )}
              </div>

              {/* Right: task list */}
              <div>
                <TaskList
                  tasks={groups.get(date) ?? []}
                  quickAddDefaults={{ whenDate: isNoDate ? undefined : date }}
                />
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div style={{ padding: "48px 0", textAlign: "center" }}>
      <p
        style={{
          fontFamily: "var(--font-display)",
          fontSize: 18,
          color: "var(--ink-2)",
          margin: "0 0 4px 0",
        }}
      >
        Nothing coming up.
      </p>
      <p style={{ fontSize: 13, color: "var(--ink-4)", margin: 0 }}>Your schedule is clear.</p>
    </div>
  );
}
