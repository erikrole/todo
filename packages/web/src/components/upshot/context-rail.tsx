"use client";

import { useMemo, useState } from "react";
import { useTasks, useUpdateTask, useDeleteTask } from "@/hooks/use-tasks";
import { useAreas } from "@/hooks/use-areas";
import { useProjects } from "@/hooks/use-projects";
import { useCalendarEvents } from "@/hooks/use-calendar-events";
import { toLocalDateStr } from "@/lib/dates";
import type { Task } from "@todo/shared";
import type { CalendarEvent } from "@/hooks/use-calendar-events";

const CAL_COLORS: Record<"personal" | "work", string> = {
  personal: "#0088FF",
  work: "#a00000",
};

// ─── Suggestion card ──────────────────────────────────────────────────────────

interface SuggestionAction {
  label: string;
  primary?: boolean;
  danger?: boolean;
  onClick: () => void;
}

function SuggestionCard({
  title,
  detail,
  source,
  actions,
  onDismiss,
}: {
  title: string;
  detail?: string;
  source: "upshot" | "asana" | "gcal" | "messages";
  actions: SuggestionAction[];
  onDismiss: () => void;
}) {
  const sourceLabel: Record<string, string> = {
    upshot: "Upshot",
    asana: "Asana",
    gcal: "Calendar",
    messages: "Messages",
  };

  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--hairline)",
        borderRadius: 12,
        padding: "12px 14px",
        position: "relative",
      }}
    >
      {/* Source chip + dismiss */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
        <span
          style={{
            fontSize: 10.5,
            padding: "2px 7px",
            borderRadius: 999,
            background: "var(--surface-2)",
            color: "var(--ink-3)",
            border: "1px solid var(--hairline)",
          }}
        >
          {sourceLabel[source]}
        </span>
        <div style={{ flex: 1 }} />
        <button
          onClick={onDismiss}
          style={{
            width: 20,
            height: 20,
            borderRadius: 6,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--ink-4)",
            fontSize: 12,
            cursor: "pointer",
          }}
          title="Dismiss"
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>

      {/* Title */}
      <div style={{ fontSize: 13.5, fontWeight: 500, color: "var(--ink)", lineHeight: 1.4, marginBottom: detail ? 5 : 10 }}>
        {title}
      </div>

      {/* Detail */}
      {detail && (
        <div style={{ fontSize: 12, color: "var(--ink-3)", lineHeight: 1.45, marginBottom: 10 }}>
          {detail}
        </div>
      )}

      {/* Actions */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {actions.map((action) => (
          <button
            key={action.label}
            onClick={action.onClick}
            style={{
              fontSize: 12,
              padding: "5px 10px",
              borderRadius: 7,
              cursor: "pointer",
              background: action.primary
                ? "var(--accent)"
                : action.danger
                ? "var(--danger-soft)"
                : "var(--surface-2)",
              color: action.primary
                ? "var(--accent-fg, white)"
                : action.danger
                ? "var(--danger)"
                : "var(--ink-2)",
              border: action.primary
                ? "1px solid var(--accent)"
                : action.danger
                ? "1px solid color-mix(in oklch, var(--danger) 25%, transparent)"
                : "1px solid var(--hairline)",
              fontWeight: action.primary ? 500 : 400,
            }}
          >
            {action.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Assistant section ────────────────────────────────────────────────────────

function AssistantSection() {
  const today = toLocalDateStr(new Date());
  const { data: overdueTasks = [] } = useTasks("overdue");
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();

  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const dismiss = (id: string) => setDismissed((s) => new Set([...s, id]));

  const visibleOverdue = overdueTasks.filter((t) => !dismissed.has(t.id)).slice(0, 3);

  if (visibleOverdue.length === 0) return null;

  function fmtWhenDate(d: string): string {
    const date = new Date(d + "T00:00:00");
    const diff = Math.round((new Date(today + "T00:00:00").getTime() - date.getTime()) / 86400000);
    if (diff === 1) return "yesterday";
    if (diff <= 6) return `${diff} days ago`;
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }

  return (
    <>
      <div
        style={{
          fontSize: 11,
          color: "var(--ink-4)",
          textTransform: "uppercase",
          letterSpacing: "0.1em",
          fontWeight: 500,
          marginBottom: 10,
        }}
      >
        Assistant
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 24 }}>
        {visibleOverdue.map((task) => {
          const when = task.whenDate ? fmtWhenDate(task.whenDate) : "earlier";
          return (
            <SuggestionCard
              key={task.id}
              source="upshot"
              title={`'${task.title}' wasn't done.`}
              detail={`Scheduled for ${when}. Move it to today or remove it?`}
              onDismiss={() => dismiss(task.id)}
              actions={[
                {
                  label: "Move to Today",
                  primary: true,
                  onClick: () => {
                    updateTask.mutate({ id: task.id, whenDate: today });
                    dismiss(task.id);
                  },
                },
                {
                  label: "Remove",
                  danger: true,
                  onClick: () => {
                    deleteTask.mutate(task.id);
                    dismiss(task.id);
                  },
                },
              ]}
            />
          );
        })}
      </div>
    </>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function ContextRail() {
  const { data: upcomingTasks = [] } = useTasks("upcoming");
  const { data: completedTasks = [] } = useTasks("completed_today");
  const { data: calendarEvents = [] } = useCalendarEvents();
  const { data: areas = [] } = useAreas();
  const { data: projects = [] } = useProjects();

  const areaColorMap = useMemo(() => new Map(areas.map((a) => [a.id, a.color])), [areas]);
  const areaNameMap = useMemo(() => new Map(areas.map((a) => [a.id, a.name])), [areas]);
  const projectAreaMap = useMemo(() => new Map(projects.map((p) => [p.id, p.areaId])), [projects]);

  function getAreaColor(task: Task): string | null | undefined {
    const areaId = task.areaId ?? (task.projectId ? projectAreaMap.get(task.projectId) : null);
    if (!areaId) return null;
    return areaColorMap.get(areaId);
  }

  function getAreaName(task: Task): string | null | undefined {
    const areaId = task.areaId ?? (task.projectId ? projectAreaMap.get(task.projectId) : null);
    if (!areaId) return null;
    return areaNameMap.get(areaId);
  }

  const grouped = useMemo(() => {
    const groups: { date: string; label: string; tasks: Task[]; events: CalendarEvent[] }[] = [];
    const now = new Date();
    for (let i = 1; i <= 7; i++) {
      const d = new Date(now);
      d.setDate(d.getDate() + i);
      const dateStr = toLocalDateStr(d);
      const tasks = upcomingTasks.filter((t) => t.whenDate === dateStr && !t.isCompleted);
      const events = calendarEvents.filter((e) => {
        const start = toLocalDateStr(new Date(e.start));
        const end = toLocalDateStr(new Date(e.end));
        return start <= dateStr && end >= dateStr;
      });
      if (tasks.length > 0 || events.length > 0) {
        const label = d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
        groups.push({ date: dateStr, label, tasks, events });
      }
    }
    return groups;
  }, [upcomingTasks, calendarEvents]);

  const today = toLocalDateStr(new Date());
  const recentActivity = useMemo(() => {
    return completedTasks
      .filter((t) => t.completedAt && toLocalDateStr(new Date(t.completedAt)) === today)
      .slice(0, 8)
      .map((t) => ({
        time: new Date(t.completedAt!).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
        title: t.title,
      }));
  }, [completedTasks, today]);

  return (
    <aside
      style={{
        width: 320,
        flex: "0 0 320px",
        borderLeft: "1px solid var(--hairline)",
        background: "var(--bg)",
        padding: "22px 20px 140px",
        overflowY: "auto",
        height: "100vh",
        position: "sticky",
        top: 0,
      }}
    >
      {/* Assistant cards */}
      <AssistantSection />

      {/* Next 7 days */}
      <div
        style={{
          fontSize: 11,
          color: "var(--ink-4)",
          textTransform: "uppercase",
          letterSpacing: "0.1em",
          fontWeight: 500,
          marginBottom: 12,
        }}
      >
        Next 7 days
      </div>

      {grouped.length === 0 ? (
        <p style={{ fontSize: 12.5, color: "var(--ink-4)", fontStyle: "italic", margin: "0 0 22px 0" }}>
          Nothing coming up.
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 18, marginBottom: 28 }}>
          {grouped.map(({ date, label, tasks, events }) => (
            <div key={date}>
              <div style={{ fontSize: 12, color: "var(--ink-3)", marginBottom: 5, fontWeight: 500 }}>
                {label}
              </div>

              {/* Calendar events */}
              {events.map((event) => {
                const color = CAL_COLORS[event.source];
                const timeStr = event.allDay
                  ? null
                  : new Date(event.start).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
                return (
                  <div
                    key={event.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "3px 0",
                      fontSize: 13,
                      color: "var(--ink-2)",
                    }}
                  >
                    <span
                      style={{
                        width: 3,
                        alignSelf: "stretch",
                        borderRadius: 99,
                        background: color,
                        flexShrink: 0,
                        minHeight: 14,
                      }}
                    />
                    <span
                      style={{
                        flex: 1,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        lineHeight: 1.5,
                      }}
                    >
                      {event.title}
                    </span>
                    {timeStr && (
                      <span
                        style={{
                          fontSize: 11,
                          color: "var(--ink-4)",
                          flexShrink: 0,
                          fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        {timeStr}
                      </span>
                    )}
                  </div>
                );
              })}

              {/* Tasks */}
              {tasks.map((task) => {
                const color = getAreaColor(task);
                const areaName = getAreaName(task);
                const isOverdue = task.deadline && task.deadline < new Date().toISOString().slice(0, 10);
                return (
                  <div
                    key={task.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "3px 0",
                      fontSize: 13,
                      color: "var(--ink-2)",
                    }}
                  >
                    <span
                      style={{
                        width: 5,
                        height: 5,
                        borderRadius: "50%",
                        background: isOverdue ? "var(--danger)" : (color ?? "var(--ink-4)"),
                        flexShrink: 0,
                      }}
                    />
                    <span
                      style={{
                        flex: 1,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        lineHeight: 1.5,
                      }}
                    >
                      {task.title}
                    </span>
                    {areaName && (
                      <span style={{ fontSize: 11, color: "var(--ink-4)", flexShrink: 0 }}>
                        {areaName}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}

      {/* Recent activity */}
      {recentActivity.length > 0 && (
        <>
          <div
            style={{
              fontSize: 11,
              color: "var(--ink-4)",
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              fontWeight: 500,
              marginBottom: 10,
            }}
          >
            Recent activity
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {recentActivity.map((r, i) => (
              <div key={i} style={{ display: "flex", gap: 10, fontSize: 12, color: "var(--ink-3)" }}>
                <span
                  style={{
                    width: 54,
                    flex: "0 0 54px",
                    color: "var(--ink-4)",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {r.time}
                </span>
                <span style={{ lineHeight: 1.45 }}>{r.title}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </aside>
  );
}
