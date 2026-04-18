"use client";

import { use } from "react";
import Link from "next/link";
import { useAreas } from "@/hooks/use-areas";
import { useProjects } from "@/hooks/use-projects";
import { useTasks } from "@/hooks/use-tasks";
import { UpshootTaskRow } from "@/components/upshot/task-row";

export default function V2AreaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: areas = [] } = useAreas();
  const { data: projects = [] } = useProjects(id);
  const { data: looseTasks = [], isLoading } = useTasks("all", undefined, id);

  const area = areas.find((a) => a.id === id);
  const areaProjects = projects.filter((p) => !p.isCompleted && !p.parentProjectId);
  const activeTasks = looseTasks.filter((t) => !t.isCompleted && !t.isCancelled);
  const isEmpty = areaProjects.length === 0 && activeTasks.length === 0;

  return (
    <div style={{ maxWidth: 640, margin: "0 auto" }}>
      <div style={{ padding: "32px 16px 24px 16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
          <span
            style={{
              width: 10,
              height: 10,
              borderRadius: 3,
              background: area?.color ?? "var(--ink-4)",
              flexShrink: 0,
            }}
          />
          <h1
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 500,
              fontSize: 30,
              lineHeight: 1.15,
              letterSpacing: "-0.02em",
              color: "var(--ink)",
              margin: 0,
            }}
          >
            {area?.name ?? "Area"}
          </h1>
        </div>
        <p style={{ fontSize: 13, color: "var(--ink-4)", margin: 0 }}>
          {areaProjects.length} project{areaProjects.length === 1 ? "" : "s"}
          {activeTasks.length > 0 && ` · ${activeTasks.length} loose task${activeTasks.length === 1 ? "" : "s"}`}
        </p>
      </div>

      {isLoading ? (
        <div style={{ padding: "0 16px", display: "flex", flexDirection: "column", gap: 8 }}>
          {[...Array(3)].map((_, i) => (
            <div key={i} style={{ height: 36, borderRadius: 8, background: "var(--surface-2)" }} />
          ))}
        </div>
      ) : isEmpty ? (
        <div style={{ padding: "64px 16px", textAlign: "center" }}>
          <p style={{ fontFamily: "var(--font-display)", fontSize: 18, color: "var(--ink-2)", margin: "0 0 4px 0" }}>
            Nothing here yet.
          </p>
          <p style={{ fontSize: 13, color: "var(--ink-4)", margin: 0 }}>
            Add a project or a task to this area.
          </p>
        </div>
      ) : (
        <>
          {areaProjects.length > 0 && (
            <div style={{ padding: "0 16px", display: "flex", flexDirection: "column", gap: 2, marginBottom: 24 }}>
              {areaProjects.map((p) => (
                <Link
                  key={p.id}
                  href={`/v2/project/${p.id}`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "8px 10px",
                    borderRadius: 8,
                    color: "var(--ink)",
                    textDecoration: "none",
                    fontSize: 14,
                    background: "transparent",
                  }}
                >
                  <span
                    style={{
                      width: 12,
                      height: 12,
                      borderRadius: 3,
                      flexShrink: 0,
                      border: `1.5px solid ${p.color ?? "var(--hairline-strong)"}`,
                      background: p.color ? `${p.color}22` : "transparent",
                    }}
                  />
                  <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {p.name}
                  </span>
                  {p.taskCount > 0 && (
                    <span style={{ fontSize: 11.5, color: "var(--ink-4)", fontVariantNumeric: "tabular-nums" }}>
                      {p.taskCount}
                    </span>
                  )}
                </Link>
              ))}
            </div>
          )}

          {activeTasks.length > 0 && (
            <div style={{ padding: "0 4px" }}>
              {areaProjects.length > 0 && (
                <div style={{ padding: "8px 14px", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--ink-4)" }}>
                  Loose tasks
                </div>
              )}
              {activeTasks.map((t) => (
                <UpshootTaskRow key={t.id} task={t} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
