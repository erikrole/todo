"use client";

import { useMemo } from "react";
import { useTasks } from "@/hooks/use-tasks";
import { useAreas } from "@/hooks/use-areas";
import { useProjects } from "@/hooks/use-projects";
import { toLocalDateStr } from "@/lib/dates";
import type { Task } from "@todo/shared";

export function ContextRail() {
  const { data: upcomingTasks = [] } = useTasks("upcoming");
  const { data: completedTasks = [] } = useTasks("completed_today");
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
    const groups: { date: string; label: string; tasks: Task[] }[] = [];
    const now = new Date();
    for (let i = 1; i <= 7; i++) {
      const d = new Date(now);
      d.setDate(d.getDate() + i);
      const dateStr = d.toISOString().slice(0, 10);
      const tasks = upcomingTasks.filter((t) => t.whenDate === dateStr && !t.isCompleted);
      if (tasks.length > 0) {
        const label = d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
        groups.push({ date: dateStr, label, tasks });
      }
    }
    return groups;
  }, [upcomingTasks]);

  const today = toLocalDateStr(new Date());
  const recentActivity = useMemo(() => {
    return completedTasks
      .filter((t) => t.completedAt && t.completedAt.slice(0, 10) === today)
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
          {grouped.map(({ date, label, tasks }) => (
            <div key={date}>
              <div style={{ fontSize: 12, color: "var(--ink-3)", marginBottom: 5, fontWeight: 500 }}>
                {label}
              </div>
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
                      <span style={{ fontSize: 11, color: "var(--ink-4)", flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>
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
