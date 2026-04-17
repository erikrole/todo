"use client";

import { useMemo } from "react";
import { useTasks, useCompleteTask } from "@/hooks/use-tasks";
import { useTodayCalendarEvents } from "@/hooks/use-calendar-events";
import { useProjects } from "@/hooks/use-projects";
import { useAreas } from "@/hooks/use-areas";
import { toLocalDateStr } from "@/lib/dates";
import { UpshootTaskRow } from "./task-row";
import type { Task, TimeOfDay } from "@todo/shared";
import type { CalendarEvent } from "@/hooks/use-calendar-events";

type TimelineItem =
  | { kind: "event"; id: string; min: number; title: string; source: "personal" | "work" }
  | { kind: "task"; id: string; min: number; title: string };

// ─── Helpers ─────────────────────────────────────────────────────────────────

type Mode = "morning" | "day" | "evening";

function deriveMode(): Mode {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 17) return "day";
  return "evening";
}

function formatDate(): string {
  return new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}

function fmtHour(h: number): string {
  if (h === 0) return "midnight";
  if (h === 12) return "noon";
  return h > 12 ? `${h - 12}pm` : `${h}am`;
}

function minFromDate(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

// Calendar brand colors
const CAL_COLORS: Record<"personal" | "work", string> = {
  personal: "#0088FF",
  work: "#a00000",
};

// ─── Greeting ─────────────────────────────────────────────────────────────────

function Greeting({ mode, completedCount, totalCount }: { mode: Mode; completedCount: number; totalCount: number }) {
  const name = process.env.NEXT_PUBLIC_USER_NAME;
  const nameStr = name ? `, ${name}.` : ".";
  const headingText =
    mode === "morning" ? `Good morning${nameStr}` :
    mode === "evening" ? `Winding down${nameStr}` :
    `Good afternoon${nameStr}`;

  const progress = totalCount > 0 ? completedCount / totalCount : 0;

  return (
    <div style={{ padding: "8px 16px 20px 16px" }}>
      <div style={{ fontSize: 12, color: "var(--ink-4)", letterSpacing: "0.04em", marginBottom: 6 }}>
        {formatDate()}
      </div>
      <h1
        style={{
          fontFamily: "var(--font-display)",
          fontWeight: 500,
          fontSize: 42,
          lineHeight: 1.1,
          margin: "0 0 14px 0",
          letterSpacing: "-0.02em",
          color: "var(--ink)",
        }}
      >
        {headingText}
      </h1>

      {totalCount > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ flex: 1, height: 4, borderRadius: 99, background: "var(--hairline)", overflow: "hidden" }}>
            <div
              style={{
                height: "100%",
                borderRadius: 99,
                background: "var(--accent)",
                width: `${Math.round(progress * 100)}%`,
                transition: "width 400ms ease",
              }}
            />
          </div>
          <span style={{ fontSize: 11, color: "var(--ink-4)", fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>
            {completedCount}/{totalCount}
          </span>
        </div>
      )}
    </div>
  );
}

// ─── Now strip ────────────────────────────────────────────────────────────────

function NowStrip({ events, tasks }: { events: CalendarEvent[]; tasks: Task[] }) {
  const now = new Date();

  // 4-hour window: 1h before current hour
  const windowStartH = Math.max(5, now.getHours() - 1);
  const windowEndH = Math.min(23, windowStartH + 4);
  const HOUR_COUNT = windowEndH - windowStartH;
  const minStart = windowStartH * 60;
  const minEnd = windowEndH * 60;

  function pct(min: number): number {
    return ((Math.max(minStart, Math.min(minEnd, min)) - minStart) / (minEnd - minStart)) * 100;
  }

  const nowPct = pct(minFromDate(now));
  const nowStr = now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  const hourMarks = Array.from({ length: HOUR_COUNT + 1 }, (_, i) => windowStartH + i);

  const timedEvents = events.filter((e) => {
    if (e.allDay) return false;
    const s = minFromDate(new Date(e.start));
    const en = minFromDate(new Date(e.end));
    return en > minStart && s < minEnd;
  });
  const allDayEvents = events.filter((e) => e.allDay);

  // Build unified timeline items (events + scheduled tasks)
  const scheduledTasks = tasks.filter((t) => {
    if (!t.scheduledTime || t.isCompleted) return false;
    const [h, m] = t.scheduledTime.split(":").map(Number);
    const min = h * 60 + m;
    return min >= minStart && min < minEnd;
  });

  const items: TimelineItem[] = [
    ...timedEvents.map((e): TimelineItem => ({
      kind: "event",
      id: e.id,
      min: minFromDate(new Date(e.start)),
      title: e.title,
      source: e.source,
    })),
    ...scheduledTasks.map((t): TimelineItem => ({
      kind: "task",
      id: t.id,
      min: (() => { const [h, m] = (t.scheduledTime as string).split(":").map(Number); return h * 60 + m; })(),
      title: t.title,
    })),
  ].sort((a, b) => a.min - b.min);

  if (events.length === 0 && scheduledTasks.length === 0) return null;

  return (
    <div
      style={{
        margin: "0 16px 24px",
        padding: "14px 16px",
        background: "var(--surface)",
        border: "1px solid var(--hairline)",
        borderRadius: "var(--radius-lg)",
        boxShadow: "var(--shadow-1)",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <span style={{ fontSize: 11, color: "var(--accent-ink)", textTransform: "uppercase", letterSpacing: "0.12em", fontWeight: 600 }}>
          Next up
        </span>
        <span style={{ fontSize: 12, color: "var(--ink-4)" }}>
          · {fmtHour(windowStartH)} — {fmtHour(windowEndH)}
        </span>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 11.5, color: "var(--ink-3)", fontVariantNumeric: "tabular-nums" }}>now {nowStr}</span>
      </div>

      {/* Timeline track */}
      <div style={{ position: "relative", height: 68 }}>
        {/* Axis */}
        <div style={{ position: "absolute", left: 0, right: 0, top: 34, height: 1, background: "var(--hairline)" }} />

        {/* Hour labels */}
        {hourMarks.map((h, i) => (
          <div
            key={h}
            style={{
              position: "absolute",
              left: `${(i / HOUR_COUNT) * 100}%`,
              top: 38,
              transform: "translateX(-50%)",
              fontSize: 10.5,
              color: "var(--ink-4)",
              fontVariantNumeric: "tabular-nums",
              whiteSpace: "nowrap",
            }}
          >
            {fmtHour(h)}
          </div>
        ))}

        {/* Now indicator */}
        <div style={{ position: "absolute", left: `${nowPct}%`, top: 0, bottom: 0, width: 1.5, background: "var(--accent)" }}>
          <div style={{ position: "absolute", left: -3, top: -3, width: 7, height: 7, borderRadius: "50%", background: "var(--accent)" }} />
        </div>

        {/* Timeline pills — events + scheduled tasks */}
        {items.map((item, idx) => {
          const startPct = pct(item.min);
          const h = Math.floor(item.min / 60);
          const m = item.min % 60;
          const timeStr = `${h % 12 || 12}:${m.toString().padStart(2, "0")} ${h >= 12 ? "pm" : "am"}`.replace(":00 ", " ");
          const isTop = idx % 2 === 0;

          if (item.kind === "event") {
            const color = CAL_COLORS[item.source];
            return (
              <div
                key={item.id}
                title={`${item.title} · ${timeStr}`}
                style={{
                  position: "absolute",
                  left: `${startPct}%`,
                  top: isTop ? 0 : 42,
                  transform: "translateX(-4px)",
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                  background: `${color}18`,
                  border: `1px solid ${color}55`,
                  borderLeft: `3px solid ${color}`,
                  borderRadius: 7,
                  padding: "3px 7px",
                  fontSize: 11.5,
                  color: "var(--ink)",
                  maxWidth: 200,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  cursor: "default",
                }}
              >
                <span style={{ fontVariantNumeric: "tabular-nums", color, flexShrink: 0, fontSize: 11, fontWeight: 500 }}>
                  {timeStr}
                </span>
                <span style={{ color: "var(--hairline-strong)", flexShrink: 0 }}>·</span>
                <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{item.title}</span>
              </div>
            );
          }

          return (
            <div
              key={item.id}
              title={`${item.title} · ${timeStr}`}
              style={{
                position: "absolute",
                left: `${startPct}%`,
                top: isTop ? 0 : 42,
                transform: "translateX(-4px)",
                display: "flex",
                alignItems: "center",
                gap: 5,
                background: "var(--surface-2)",
                border: "1px solid var(--hairline-strong)",
                borderRadius: 7,
                padding: "3px 7px",
                fontSize: 11.5,
                color: "var(--ink)",
                maxWidth: 200,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                cursor: "default",
              }}
            >
              <span style={{ fontVariantNumeric: "tabular-nums", color: "var(--ink-3)", flexShrink: 0, fontSize: 11 }}>
                {timeStr}
              </span>
              <span style={{ color: "var(--hairline-strong)", flexShrink: 0 }}>·</span>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{item.title}</span>
            </div>
          );
        })}
      </div>

      {/* All-day chips */}
      {allDayEvents.length > 0 && (
        <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 4 }}>
          {allDayEvents.map((e) => {
            const color = CAL_COLORS[e.source];
            return (
              <span
                key={e.id}
                style={{
                  fontSize: 11,
                  padding: "2px 8px",
                  borderRadius: 99,
                  background: `${color}18`,
                  color: color,
                  border: `1px solid ${color}44`,
                }}
              >
                {e.title}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Task sections ────────────────────────────────────────────────────────────

interface BucketSectionProps {
  label: string;
  tasks: Task[];
  getAreaColor: (task: Task) => string | null | undefined;
}

function BucketSection({ label, tasks, getAreaColor }: BucketSectionProps) {
  if (tasks.length === 0) return null;
  return (
    <section style={{ marginBottom: 28 }}>
      <header style={{ display: "flex", alignItems: "baseline", gap: 10, padding: "0 14px 8px" }}>
        <h3 style={{ fontFamily: "var(--font-display)", fontWeight: 500, fontSize: 17, letterSpacing: "-0.01em", margin: 0, color: "var(--ink)" }}>
          {label}
        </h3>
        <span style={{ fontSize: 12, color: "var(--ink-4)" }}>{tasks.length} {tasks.length === 1 ? "item" : "items"}</span>
        <div style={{ flex: 1 }} />
        <button style={{ color: "var(--ink-4)", fontSize: 12, display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 6px", borderRadius: 6, cursor: "pointer" }}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
          add
        </button>
      </header>
      <div style={{ padding: "0 4px" }}>
        {tasks.map((t) => (
          <UpshootTaskRow key={t.id} task={t} areaColor={getAreaColor(t)} />
        ))}
        <button style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 14px", borderRadius: 10, color: "var(--ink-4)", fontSize: 13, width: "100%", textAlign: "left", cursor: "pointer" }}>
          <span style={{ width: 18, height: 18, borderRadius: 6, border: "1.5px dashed var(--hairline-strong)", flexShrink: 0 }} />
          Add to {label.toLowerCase()}
        </button>
      </div>
    </section>
  );
}

function RoutineSection({ tasks, getAreaColor }: { tasks: Task[]; getAreaColor: (t: Task) => string | null | undefined }) {
  if (tasks.length === 0) return null;
  return (
    <section style={{ marginBottom: 28 }}>
      <header style={{ display: "flex", alignItems: "baseline", gap: 10, padding: "0 14px 8px" }}>
        <h3 style={{ fontFamily: "var(--font-display)", fontWeight: 500, fontSize: 17, letterSpacing: "-0.01em", margin: 0, color: "var(--ink)" }}>
          Routines
        </h3>
        <span style={{ fontSize: 12, color: "var(--ink-4)" }}>{tasks.length} tracked</span>
      </header>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 8, padding: "0 14px" }}>
        {tasks.map((t) => (
          <RoutineChip key={t.id} task={t} areaColor={getAreaColor(t)} />
        ))}
      </div>
    </section>
  );
}

function cadenceLabel(task: Task): string {
  const interval = task.recurrenceInterval ?? 1;
  const type = task.recurrenceType;
  if (!type) return "routine";
  if (interval === 1) {
    if (type === "daily") return "daily";
    if (type === "weekly") return "weekly";
    if (type === "monthly") return "monthly";
    if (type === "yearly") return "yearly";
  }
  const unit = type === "daily" ? "d" : type === "weekly" ? "w" : type === "monthly" ? "mo" : "yr";
  return `every ${interval} ${unit}`;
}

function RoutineChip({ task, areaColor }: { task: Task; areaColor?: string | null }) {
  const completeTask = useCompleteTask();
  const isDone = task.isCompleted;
  const cadence = cadenceLabel(task);
  const nextDue = task.whenDate;
  const isToday = nextDue === new Date().toISOString().slice(0, 10);

  return (
    <div
      style={{
        padding: "12px 14px",
        borderRadius: 12,
        background: "var(--surface)",
        border: "1px solid var(--hairline)",
        display: "flex",
        alignItems: "center",
        gap: 14,
        minWidth: 0,
        flex: 1,
        opacity: isDone ? 0.5 : 1,
        cursor: "default",
      }}
    >
      {/* Accent badge — checkmark when done, recurrence icon otherwise */}
      <button
        onClick={() => !isDone && completeTask.mutate({ id: task.id })}
        style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          flexShrink: 0,
          background: isDone ? (areaColor ?? "var(--accent)") : "var(--accent-soft)",
          color: isDone ? "white" : "var(--accent-ink)",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: isDone ? "default" : "pointer",
          border: "none",
        }}
      >
        {isDone ? (
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12l5 5L20 7" />
          </svg>
        ) : (
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12a9 9 0 1 1-3-6.7" /><path d="M21 4v5h-5" />
          </svg>
        )}
      </button>

      {/* Name + cadence */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 500, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {task.title}
        </div>
        <div style={{ fontSize: 11.5, color: "var(--ink-3)", marginTop: 2 }}>{cadence}</div>
      </div>

      {/* Next due */}
      {nextDue && (
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{ fontSize: 11, color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Next</div>
          <div style={{ fontSize: 12.5, fontWeight: 500, color: isToday ? "var(--accent-ink)" : "var(--ink-2)" }}>
            {isToday ? "today" : nextDue?.slice(5)}
          </div>
        </div>
      )}
    </div>
  );
}

function OverdueSection({ tasks, getAreaColor }: { tasks: Task[]; getAreaColor: (t: Task) => string | null | undefined }) {
  if (tasks.length === 0) return null;
  return (
    <section style={{ marginBottom: 28, padding: "0 14px" }}>
      <div style={{ padding: "12px 14px", background: "var(--danger-soft)", border: "1px solid color-mix(in oklch, var(--danger) 20%, transparent)", borderRadius: "var(--radius)" }}>
        <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600, color: "var(--danger)", marginBottom: 8 }}>
          Overdue & flagged · {tasks.length}
        </div>
        {tasks.map((t) => (
          <UpshootTaskRow key={t.id} task={t} showWhenDate areaColor={getAreaColor(t)} />
        ))}
      </div>
    </section>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function TodayBriefing() {
  const today = toLocalDateStr(new Date());
  const mode = deriveMode();

  const { data: allTasks = [], isLoading } = useTasks("today_all");
  const { data: routineTasks = [] } = useTasks("routines");
  const { data: calendarEvents = [] } = useTodayCalendarEvents();
  const { data: projects = [] } = useProjects();
  const { data: areas = [] } = useAreas();

  // Build lookup maps: task → area color
  const areaColorMap = useMemo(() => new Map(areas.map((a) => [a.id, a.color])), [areas]);
  const projectAreaMap = useMemo(() => new Map(projects.map((p) => [p.id, p.areaId])), [projects]);

  function getAreaColor(task: Task): string | null | undefined {
    const areaId = task.areaId ?? (task.projectId ? projectAreaMap.get(task.projectId) : null);
    if (!areaId) return null;
    return areaColorMap.get(areaId);
  }

  const overdueTasks = allTasks.filter(
    (t) => !t.isCompleted && t.whenDate !== null && t.whenDate < today,
  );
  const dueRoutines = routineTasks.filter((t) => !t.isCompleted && (t.whenDate === null || t.whenDate <= today));

  const completedCount = allTasks.filter((t) => t.isCompleted && !t.isCancelled).length;
  const totalCount = allTasks.filter((t) => !t.isCancelled).length;

  const activeTodayTasks = allTasks.filter((t) => !t.isCompleted && !t.isCancelled);

  function tasksByTimeOfDay(sectionId: TimeOfDay | "anytime" | null): Task[] {
    if (sectionId === "anytime") {
      return activeTodayTasks.filter((t) => t.timeOfDay === "day" || t.timeOfDay === null);
    }
    return activeTodayTasks.filter((t) => (t.timeOfDay ?? null) === sectionId);
  }

  const buckets =
    mode === "evening"
      ? [
          { id: "anytime" as const, label: "Remaining" },
          { id: "night" as TimeOfDay, label: "Tonight" },
        ]
      : [
          { id: "morning" as TimeOfDay, label: "Morning" },
          { id: "anytime" as const, label: "Anytime" },
          { id: "night" as TimeOfDay, label: "Evening" },
        ];

  return (
    <div style={{ padding: "18px 0 140px 0", maxWidth: 720 }}>
      <Greeting mode={mode} completedCount={completedCount} totalCount={totalCount} />

      {isLoading ? (
        <div style={{ padding: "0 16px", display: "flex", flexDirection: "column", gap: 8 }}>
          {[...Array(4)].map((_, i) => (
            <div key={i} style={{ height: 36, borderRadius: 8, background: "var(--surface-2)", animation: "pulse 1.5s ease-in-out infinite" }} />
          ))}
        </div>
      ) : (
        <>
          <NowStrip events={calendarEvents} tasks={allTasks} />
          <RoutineSection tasks={dueRoutines} getAreaColor={getAreaColor} />
          <OverdueSection tasks={overdueTasks} getAreaColor={getAreaColor} />
          {buckets.map(({ id, label }) => (
            <BucketSection
              key={label}
              label={label}
              tasks={tasksByTimeOfDay(id)}
              getAreaColor={getAreaColor}
            />
          ))}

          {totalCount > 0 && completedCount === totalCount && (
            <div style={{ padding: "48px 14px", textAlign: "center" }}>
              <div style={{ fontSize: 24, marginBottom: 8 }}>✦</div>
              <p style={{ fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 400, color: "var(--ink-2)", margin: "0 0 4px 0" }}>
                All done for today.
              </p>
              <p style={{ fontSize: 13, color: "var(--ink-4)", margin: 0 }}>Come back tomorrow.</p>
            </div>
          )}

          {totalCount === 0 && (
            <div style={{ padding: "48px 14px", textAlign: "center" }}>
              <p style={{ fontSize: 13, color: "var(--ink-4)", margin: 0 }}>Nothing scheduled for today.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
