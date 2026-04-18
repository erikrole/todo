"use client";

import { use } from "react";
import { useTasks } from "@/hooks/use-tasks";
import { useProjects } from "@/hooks/use-projects";
import { ViewHeader } from "@/components/upshot/view-header";
import { UpshootTaskRow } from "@/components/upshot/task-row";

export default function V2ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: tasks = [], isLoading } = useTasks("all", id);
  const { data: projects = [] } = useProjects();
  const project = projects.find((p) => p.id === id);

  const activeTasks = tasks.filter((t) => !t.isCompleted && !t.isCancelled);
  const completedTasks = tasks.filter((t) => t.isCompleted && !t.isCancelled);

  return (
    <div style={{ maxWidth: 640, margin: "0 auto" }}>
      <ViewHeader
        title={project?.name ?? "Project"}
        subtitle={activeTasks.length > 0 ? `${activeTasks.length} task${activeTasks.length === 1 ? "" : "s"}` : undefined}
      />
      {isLoading ? (
        <div style={{ padding: "0 16px", display: "flex", flexDirection: "column", gap: 8 }}>
          {[...Array(4)].map((_, i) => (
            <div key={i} style={{ height: 36, borderRadius: 8, background: "var(--surface-2)" }} />
          ))}
        </div>
      ) : activeTasks.length === 0 && completedTasks.length === 0 ? (
        <div style={{ padding: "48px 16px", textAlign: "center" }}>
          <p style={{ fontFamily: "var(--font-display)", fontSize: 18, color: "var(--ink-2)", margin: "0 0 4px 0" }}>
            No tasks yet.
          </p>
          <p style={{ fontSize: 13, color: "var(--ink-4)", margin: 0 }}>Add a task to get started.</p>
        </div>
      ) : (
        <div style={{ padding: "0 4px" }}>
          {activeTasks.map((t) => (
            <UpshootTaskRow key={t.id} task={t} />
          ))}
          {completedTasks.length > 0 && activeTasks.length > 0 && (
            <div style={{ padding: "16px 14px 8px", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--ink-4)" }}>
              Completed
            </div>
          )}
          {completedTasks.map((t) => (
            <UpshootTaskRow key={t.id} task={t} />
          ))}
        </div>
      )}
    </div>
  );
}
