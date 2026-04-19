"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useTasks } from "@/hooks/use-tasks";
import { useTodayCalendarEvents } from "@/hooks/use-calendar-events";
import { useProjects } from "@/hooks/use-projects";
import { useAreas } from "@/hooks/use-areas";
import { useWeather } from "@/hooks/use-weather";
import { useOccasions } from "@/hooks/use-occasions";
import { useInsights } from "@/hooks/use-insights";
import { toLocalDateStr } from "@/lib/dates";
import { nextOccurrenceForOccasion, daysUntilDate } from "@/lib/occasions";
import { TaskList } from "@/components/tasks/task-list";
import type { Task, TimeOfDay } from "@todo/shared";
import type { CalendarEvent } from "@/hooks/use-calendar-events";
import type { Occasion } from "@todo/db";

type TimelineItem =
  | { kind: "event"; id: string; min: number; title: string; source: "personal" | "work" }
  | { kind: "task"; id: string; min: number; title: string };

// ─── Helpers ─────────────────────────────────────────────────────────────────

type Mode = "morning" | "day" | "evening";

function deriveMode(): Mode {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 21) return "day";
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

function useBrief(mode: Mode, taskTitles: string[], today: string): string | null {
  const { data } = useQuery({
    queryKey: ["brief", mode, today],
    queryFn: () =>
      fetch("/api/brief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, taskTitles, date: formatDate() }),
      })
        .then((r) => r.json())
        .then((d) => (d.brief as string | null) ?? null),
    enabled: taskTitles.length > 0,
    staleTime: 60 * 60_000, // 1 hour — regenerates when mode changes or day rolls over
    retry: false,
  });
  return data ?? null;
}

function Greeting({
  mode,
  completedCount,
  totalCount,
  taskTitles,
}: {
  mode: Mode;
  completedCount: number;
  totalCount: number;
  taskTitles: string[];
}) {
  const name = process.env.NEXT_PUBLIC_USER_NAME;
  const nameStr = name ? `, ${name}.` : ".";
  const headingText =
    mode === "morning" ? `Good morning${nameStr}` :
    mode === "evening" ? `Winding down${nameStr}` :
    `Midday check-in${nameStr}`;

  const progress = totalCount > 0 ? completedCount / totalCount : 0;
  const today = toLocalDateStr(new Date());
  const brief = useBrief(mode, taskTitles, today);
  const { data: weather } = useWeather();

  return (
    <div style={{ padding: "8px 16px 20px 16px" }}>
      {/* Weather line */}
      {weather && (
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 7,
            fontSize: 13,
            color: "var(--ink-3)",
            marginBottom: 8,
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--accent-ink)", flexShrink: 0 }}>
            <path d="M17 16a5 5 0 0 0-1-9.9 6 6 0 0 0-11.7 2A4.5 4.5 0 0 0 5 16" />
            <path d="M9 19l-1 2M13 19l-1 2M17 19l-1 2" />
          </svg>
          <span style={{ fontVariantNumeric: "tabular-nums" }}>
            {weather.temp}° · {weather.condition}
          </span>
        </div>
      )}
      <div style={{ fontSize: 12, color: "var(--ink-4)", letterSpacing: "0.04em", marginBottom: 6 }}>
        {formatDate()}
      </div>
      <h1
        style={{
          fontFamily: "var(--font-display)",
          fontWeight: 500,
          fontSize: 42,
          lineHeight: 1.1,
          margin: "0 0 10px 0",
          letterSpacing: "-0.02em",
          color: "var(--ink)",
        }}
      >
        {headingText}
      </h1>

      {brief && (
        <p style={{ margin: "0 0 14px", maxWidth: 640, fontSize: 15.5, lineHeight: 1.55, color: "var(--ink-2)", textWrap: "pretty" } as React.CSSProperties}>
          <span style={{ color: "var(--accent-ink)", fontWeight: 500 }}>·</span> {brief}
        </p>
      )}

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

// ─── Insights strip ──────────────────────────────────────────────────────────

function InsightsStrip() {
  const router = useRouter();
  const { data: insights = [] } = useInsights();
  const urgent = insights.filter((i) => i.severity === "warning" || i.severity === "alert");
  if (urgent.length === 0) return null;

  return (
    <div
      style={{
        margin: "0 16px 16px",
        display: "flex",
        gap: 8,
        overflowX: "auto",
        scrollbarWidth: "none",
        WebkitOverflowScrolling: "touch",
      } as React.CSSProperties}
    >
      {urgent.map((insight) => {
        const isAlert = insight.severity === "alert";
        return (
          <button
            key={insight.id}
            onClick={() => router.push(insight.href ?? "/routines")}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "6px 12px",
              borderRadius: 99,
              border: `1px solid ${isAlert ? "oklch(58% 0.22 25 / 35%)" : "oklch(65% 0.17 75 / 35%)"}`,
              background: isAlert
                ? "color-mix(in oklch, oklch(58% 0.22 25) 8%, var(--surface))"
                : "color-mix(in oklch, oklch(65% 0.17 75) 8%, var(--surface))",
              flexShrink: 0,
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            <span style={{ fontSize: 13 }}>{insight.icon}</span>
            <span
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: isAlert ? "oklch(58% 0.22 25)" : "oklch(55% 0.16 75)",
              }}
            >
              {insight.title}
            </span>
            <span
              style={{
                fontSize: 11,
                color: isAlert ? "oklch(58% 0.22 25 / 70%)" : "oklch(55% 0.16 75 / 70%)",
              }}
            >
              {insight.detail}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ─── Occasions strip ─────────────────────────────────────────────────────────

const OCCASION_TYPE_EMOJI: Record<string, string> = {
  birthday: "🎂", anniversary: "💍", sports: "🏟️", holiday: "🎉", event: "⭐",
};

function OccasionsStrip({ occasions }: { occasions: Occasion[] }) {
  const router = useRouter();
  const relevant = occasions
    .map((o) => ({ ...o, nextDate: nextOccurrenceForOccasion(o) }))
    .map((o) => ({ ...o, days: daysUntilDate(o.nextDate) }))
    .filter((o) => o.days >= 0 && (o.days === 0 || (o.prepWindowDays > 0 && o.days <= o.prepWindowDays)))
    .sort((a, b) => a.days - b.days);

  if (relevant.length === 0) return null;

  return (
    <div style={{ margin: "0 16px 20px", display: "flex", flexDirection: "column", gap: 6 }}>
      {relevant.map((o) => {
        const isToday = o.days === 0;
        const emoji = o.emoji ?? OCCASION_TYPE_EMOJI[o.occasionType ?? "event"] ?? "⭐";
        return (
          <button
            key={o.id}
            onClick={() => router.push("/occasions")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "10px 14px",
              background: isToday
                ? "color-mix(in srgb, #f59e0b 10%, var(--surface))"
                : "var(--surface)",
              border: `1px solid ${isToday ? "color-mix(in srgb, #f59e0b 30%, transparent)" : "var(--hairline)"}`,
              borderRadius: 10,
              cursor: "pointer",
              width: "100%",
              textAlign: "left",
            }}
          >
            <span style={{ fontSize: 18, flexShrink: 0 }}>{emoji}</span>
            <span style={{ fontSize: 13.5, fontWeight: 500, color: "var(--ink)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {o.name}
            </span>
            <span style={{
              fontSize: 12,
              fontWeight: 600,
              color: isToday ? "#ef4444" : "#f59e0b",
              flexShrink: 0,
            }}>
              {isToday ? "Today" : `in ${o.days} ${o.days === 1 ? "day" : "days"}`}
            </span>
          </button>
        );
      })}
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
  timeOfDay: TimeOfDay | "anytime" | null;
  today: string;
}

function BucketSection({ label, tasks, timeOfDay, today }: BucketSectionProps) {
  if (tasks.length === 0) return null;
  const qod = timeOfDay === "anytime" ? null : timeOfDay;
  return (
    <section style={{ marginBottom: 28 }}>
      <header style={{ display: "flex", alignItems: "baseline", gap: 10, padding: "0 14px 8px" }}>
        <h3 style={{ fontFamily: "var(--font-display)", fontWeight: 500, fontSize: 17, letterSpacing: "-0.01em", margin: 0, color: "var(--ink)" }}>
          {label}
        </h3>
        <span style={{ fontSize: 12, color: "var(--ink-4)" }}>{tasks.length} {tasks.length === 1 ? "item" : "items"}</span>
      </header>
      <div style={{ padding: "0 4px" }}>
        <TaskList tasks={tasks} quickAddDefaults={{ whenDate: today, timeOfDay: qod ?? undefined }} />
      </div>
    </section>
  );
}


// ─── Main ─────────────────────────────────────────────────────────────────────

export function TodayBriefing() {
  const today = toLocalDateStr(new Date());
  const mode = deriveMode();

  const { data: allTasks = [], isLoading } = useTasks("today_all");
  const { data: calendarEvents = [] } = useTodayCalendarEvents();
  const { data: projects = [] } = useProjects();
  const { data: areas = [] } = useAreas();
  const { data: occasions = [] } = useOccasions();

  // Build lookup maps: task → area color
  const areaColorMap = useMemo(() => new Map(areas.map((a) => [a.id, a.color])), [areas]);
  const projectAreaMap = useMemo(() => new Map(projects.map((p) => [p.id, p.areaId])), [projects]);

  function getAreaColor(task: Task): string | null | undefined {
    const areaId = task.areaId ?? (task.projectId ? projectAreaMap.get(task.projectId) : null);
    if (!areaId) return null;
    return areaColorMap.get(areaId);
  }

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
      <Greeting
          mode={mode}
          completedCount={completedCount}
          totalCount={totalCount}
          taskTitles={activeTodayTasks.map((t) => t.title)}
        />

      {isLoading ? (
        <div style={{ padding: "0 16px", display: "flex", flexDirection: "column", gap: 8 }}>
          {[...Array(4)].map((_, i) => (
            <div key={i} style={{ height: 36, borderRadius: 8, background: "var(--surface-2)", animation: "pulse 1.5s ease-in-out infinite" }} />
          ))}
        </div>
      ) : (
        <>
          <InsightsStrip />
          <OccasionsStrip occasions={occasions} />
          <NowStrip events={calendarEvents} tasks={allTasks} />
          {buckets.map(({ id, label }) => (
            <BucketSection
              key={label}
              label={label}
              tasks={tasksByTimeOfDay(id)}
              timeOfDay={id}
              today={today}
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
