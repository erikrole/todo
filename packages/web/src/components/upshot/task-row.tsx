"use client";

import { useState } from "react";
import { useCompleteTask, useUncompleteTask } from "@/hooks/use-tasks";
import type { Task } from "@todo/shared";

interface TaskRowProps {
  task: Task;
  showWhenDate?: boolean;
  areaColor?: string | null;
}

export function UpshootTaskRow({ task, showWhenDate, areaColor }: TaskRowProps) {
  const completeTask = useCompleteTask();
  const uncompleteTask = useUncompleteTask();
  const [hovering, setHovering] = useState(false);

  const isOverdue =
    showWhenDate && task.whenDate && !task.isCompleted && task.whenDate < new Date().toISOString().slice(0, 10);

  function handleCheck(e: React.MouseEvent) {
    e.stopPropagation();
    if (task.isCompleted) {
      uncompleteTask.mutate(task.id);
    } else {
      completeTask.mutate({ id: task.id });
    }
  }

  const checkColor = areaColor ?? "var(--hairline-strong)";
  const deadlineColor = task.deadline ? "var(--danger)" : undefined;

  return (
    <div
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "8px 14px",
        borderRadius: 10,
        background: hovering ? "var(--surface-2)" : "transparent",
        transition: "background 120ms ease",
        cursor: "default",
      }}
    >
      {/* Checkbox — colored by area */}
      <button
        onClick={handleCheck}
        style={{
          width: 18,
          height: 18,
          minWidth: 18,
          borderRadius: 6,
          border: `1.5px solid ${task.isCompleted ? checkColor : (deadlineColor ?? checkColor)}`,
          background: task.isCompleted ? checkColor : "transparent",
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          transition: "all 140ms ease",
        }}
      >
        {task.isCompleted && (
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12l5 5L20 7" />
          </svg>
        )}
      </button>

      {/* Title */}
      <span
        style={{
          flex: 1,
          fontSize: 14.5,
          color: task.isCompleted ? "var(--ink-4)" : "var(--ink)",
          textDecoration: task.isCompleted ? "line-through" : "none",
          opacity: task.isCompleted ? 0.5 : 1,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {task.title}
      </span>

      {/* Metadata */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
        {task.deadline && (
          <span style={{ fontSize: 11.5, color: "var(--danger)", display: "inline-flex", alignItems: "center", gap: 3 }}>
            <ClockIcon />
            due {task.deadline}
          </span>
        )}
        {showWhenDate && task.whenDate && (
          <span
            style={{
              fontSize: 11,
              color: isOverdue ? "var(--danger)" : "var(--ink-4)",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {task.whenDate}
          </span>
        )}
        {task.scheduledTime && !task.isCompleted && (
          <span style={{ fontSize: 12.5, color: "var(--ink-3)", fontVariantNumeric: "tabular-nums" }}>
            {formatTime12(task.scheduledTime)}
          </span>
        )}
        {task.recurrenceType && !task.isCompleted && (
          <span style={{ fontSize: 11, color: "var(--ink-4)", display: "inline-flex", alignItems: "center", gap: 3 }}>
            <RoutineIcon />
          </span>
        )}
      </div>
    </div>
  );
}

function formatTime12(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const suffix = h >= 12 ? "pm" : "am";
  const hour = h % 12 || 12;
  return m === 0 ? `${hour}${suffix}` : `${hour}:${m.toString().padStart(2, "0")}${suffix}`;
}

function ClockIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" />
    </svg>
  );
}

function RoutineIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12a9 9 0 1 1-3-6.7" /><path d="M21 4v5h-5" />
    </svg>
  );
}
