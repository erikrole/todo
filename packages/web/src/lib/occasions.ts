import type { Occasion } from "@todo/db";

// ── Holiday computation helpers ───────────────────────────────────────────────

export function nthWeekdayOfMonth(year: number, month: number, weekday: number, n: number): string {
  const d = new Date(year, month, 1);
  let count = 0;
  while (d.getMonth() === month) {
    if (d.getDay() === weekday) { count++; if (count === n) break; }
    d.setDate(d.getDate() + 1);
  }
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function lastWeekdayOfMonth(year: number, month: number, weekday: number): string {
  const d = new Date(year, month + 1, 0);
  while (d.getDay() !== weekday) d.setDate(d.getDate() - 1);
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function easterDate(year: number): string {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

// Holidays whose date shifts year-to-year — recomputed at render, not stored
export const COMPUTED_HOLIDAYS: Record<string, (year: number) => string> = {
  "Easter":        (y) => easterDate(y),
  "Mother's Day":  (y) => nthWeekdayOfMonth(y, 4, 0, 2),
  "Memorial Day":  (y) => lastWeekdayOfMonth(y, 4, 1),
  "Father's Day":  (y) => nthWeekdayOfMonth(y, 5, 0, 3),
  "Labor Day":     (y) => nthWeekdayOfMonth(y, 8, 1, 1),
  "Thanksgiving":  (y) => nthWeekdayOfMonth(y, 10, 4, 4),
};

export function nextOccurrenceForOccasion(o: Occasion): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayIso = today.toISOString().slice(0, 10);

  if (!o.isAnnual) return o.date;

  // Computed holidays: re-derive from formula each year to avoid drift
  if (o.occasionType === "holiday" && COMPUTED_HOLIDAYS[o.name]) {
    const compute = COMPUTED_HOLIDAYS[o.name]!;
    let year = today.getFullYear();
    let date = compute(year);
    if (date < todayIso) date = compute(++year);
    return date;
  }

  // Fixed-date annual: preserve month/day, advance year
  const d = new Date(o.date + "T00:00:00");
  d.setFullYear(Math.max(today.getFullYear(), d.getFullYear()));
  if (d < today) d.setFullYear(d.getFullYear() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function daysUntilDate(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((new Date(dateStr + "T00:00:00").getTime() - today.getTime()) / 86400000);
}
