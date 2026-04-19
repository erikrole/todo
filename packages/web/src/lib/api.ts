/** Shared helpers for route handlers */

export function ok<T>(data: T, status = 200): Response {
  return Response.json({ data }, { status });
}

export function err(message: string, status = 400): Response {
  return Response.json({ error: message }, { status });
}

export function nowIso() {
  return new Date().toISOString();
}

export function todayStr() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Advance a YYYY-MM-DD date by a recurrence interval */
export function nextRecurrenceDate(
  fromDate: string,
  type: string,
  interval: number,
): string {
  const d = new Date(fromDate + "T00:00:00");
  switch (type) {
    case "daily":
    case "day":
      d.setDate(d.getDate() + interval);
      break;
    case "weekly":
    case "week":
      d.setDate(d.getDate() + interval * 7);
      break;
    case "monthly":
    case "month":
      d.setMonth(d.getMonth() + interval);
      break;
    case "yearly":
    case "year":
      d.setFullYear(d.getFullYear() + interval);
      break;
    case "weekday": {
      // interval = target JS day (0=Sun … 6=Sat)
      const target = interval % 7;
      d.setDate(d.getDate() + 1); // always at least 1 day ahead
      while (d.getDay() !== target) d.setDate(d.getDate() + 1);
      break;
    }
    default:
      d.setDate(d.getDate() + interval);
  }
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
