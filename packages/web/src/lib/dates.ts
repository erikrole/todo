import * as chrono from "chrono-node";

/** Format a Date to a local YYYY-MM-DD string (avoids UTC offset shifting the date). */
export function toLocalDateStr(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Parse a natural language string into a YYYY-MM-DD date, or null if unrecognised. */
export function parseNaturalDate(text: string): string | null {
  const result = chrono.parseDate(text, new Date(), { forwardDate: true });
  if (!result) return null;
  return toLocalDateStr(result);
}

/** Format HH:MM (24h) to a display string like "3:45 PM". */
export function fmtTime(t: string): string {
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${ampm}`;
}

/** Format a YYYY-MM-DD string for display (e.g. "Today", "Tomorrow", "Apr 14"). */
export function formatWhenDate(date: string): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  const d = new Date(date + "T00:00:00");

  if (d.getTime() === today.getTime()) return "Today";
  if (d.getTime() === tomorrow.getTime()) return "Tomorrow";

  const diff = Math.round((d.getTime() - today.getTime()) / 86400000);
  if (diff > 0 && diff <= 6) {
    return d.toLocaleDateString("en-US", { weekday: "long" });
  }
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** Returns deadline urgency level for badge styling. */
export function deadlineUrgency(deadline: string): "overdue" | "soon" | "normal" {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(deadline + "T00:00:00");
  const diff = Math.round((d.getTime() - today.getTime()) / 86400000);
  if (diff < 0) return "overdue";
  if (diff <= 3) return "soon";
  return "normal";
}

/** Human-readable age string for a task that has been in inbox since createdAt. */
export function taskAge(createdAt: string): string {
  const days = Math.floor((Date.now() - new Date(createdAt).getTime()) / 86400000);
  if (days === 0) return "today";
  if (days === 1) return "1d";
  if (days < 7) return `${days}d`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w`;
  return `${Math.floor(days / 30)}mo`;
}

/** YYYY-MM-DD string for today in local time. */
export function todayStr(): string {
  return toLocalDateStr(new Date());
}

/** YYYY-MM-DD string for tomorrow in local time. */
export function tomorrowStr(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return toLocalDateStr(d);
}

/** YYYY-MM-DD string for the coming Saturday in local time (or today if today is Saturday). */
export function nextSaturdayStr(): string {
  const d = new Date();
  const day = d.getDay(); // 0=Sun … 6=Sat
  const daysUntilSat = day === 6 ? 0 : 6 - day;
  d.setDate(d.getDate() + daysUntilSat);
  return toLocalDateStr(d);
}
