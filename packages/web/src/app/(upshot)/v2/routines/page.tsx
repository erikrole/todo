"use client";

import { useTasks } from "@/hooks/use-tasks";
import { ViewHeader } from "@/components/upshot/view-header";
import { toLocalDateStr } from "@/lib/dates";

export default function V2RoutinesPage() {
  const today = toLocalDateStr(new Date());
  const { data: tasks = [], isLoading } = useTasks("routines");

  const due = tasks.filter((t) => t.whenDate !== null && t.whenDate <= today);
  const upcoming = tasks.filter((t) => t.whenDate !== null && t.whenDate > today);

  return (
    <div style={{ maxWidth: 640 }}>
      <ViewHeader title="Routines" subtitle={`${due.length} due today`} />
      {isLoading ? (
        <LoadingSkeleton />
      ) : tasks.length === 0 ? (
        <div style={{ padding: "48px 16px", textAlign: "center" }}>
          <p style={{ fontSize: 13, color: "var(--ink-4)", margin: 0 }}>No routines set up yet.</p>
        </div>
      ) : (
        <>
          {due.length > 0 && (
            <section style={{ marginBottom: 32 }}>
              <SectionLabel>Due today</SectionLabel>
              <RoutineGrid tasks={due} />
            </section>
          )}
          {upcoming.length > 0 && (
            <section>
              <SectionLabel>Upcoming</SectionLabel>
              <RoutineGrid tasks={upcoming} />
            </section>
          )}
        </>
      )}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ padding: "0 16px 10px 16px", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--ink-4)", fontWeight: 600 }}>
      {children}
    </div>
  );
}

function RoutineGrid({ tasks }: { tasks: ReturnType<typeof useTasks>["data"] }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
        gap: 10,
        padding: "0 16px",
      }}
    >
      {(tasks ?? []).map((t) => (
        <div
          key={t.id}
          style={{
            padding: "12px 14px",
            background: "var(--surface)",
            border: "1px solid var(--hairline)",
            borderRadius: "var(--radius)",
            boxShadow: "var(--shadow-1)",
          }}
        >
          <div style={{ fontSize: 13.5, fontWeight: 500, color: "var(--ink)", marginBottom: 6 }}>{t.title}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            {t.recurrenceType && (
              <span
                style={{
                  fontSize: 11,
                  color: "var(--accent-ink)",
                  background: "var(--accent-soft)",
                  padding: "2px 7px",
                  borderRadius: 99,
                }}
              >
                {t.recurrenceInterval && t.recurrenceInterval > 1
                  ? `every ${t.recurrenceInterval} ${t.recurrenceType}`
                  : t.recurrenceType}
              </span>
            )}
            {t.whenDate && (
              <span style={{ fontSize: 11, color: "var(--ink-4)" }}>Next: {t.whenDate}</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div style={{ padding: "0 16px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
      {[...Array(4)].map((_, i) => (
        <div key={i} style={{ height: 80, borderRadius: 12, background: "var(--surface-2)" }} />
      ))}
    </div>
  );
}
