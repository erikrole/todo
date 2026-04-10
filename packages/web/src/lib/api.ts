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
  return new Date().toISOString().slice(0, 10);
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
      d.setDate(d.getDate() + interval);
      break;
    case "weekly":
      d.setDate(d.getDate() + interval * 7);
      break;
    case "monthly":
      d.setMonth(d.getMonth() + interval);
      break;
    case "yearly":
      d.setFullYear(d.getFullYear() + interval);
      break;
    default:
      d.setDate(d.getDate() + interval);
  }
  return d.toISOString().slice(0, 10);
}
