import ICAL from "ical.js";
import { ok, err } from "@/lib/api";

export interface CalendarEvent {
  id: string;
  title: string;
  start: string; // ISO
  end: string; // ISO
  allDay: boolean;
  source: "personal" | "work";
  location?: string;
  description?: string;
}

function sanitizeIcal(text: string): string {
  // Remove bare lines that have no property delimiter (colon or semicolon)
  // and aren't line continuations (which start with whitespace)
  return text
    .split("\n")
    .filter((line) => {
      const trimmed = line.trimEnd();
      if (trimmed === "") return true;
      if (trimmed.startsWith(" ") || trimmed.startsWith("\t")) return true; // continuation
      return trimmed.includes(":") || trimmed.includes(";");
    })
    .join("\n");
}

async function fetchAndParse(url: string, source: "personal" | "work"): Promise<CalendarEvent[]> {
  const res = await fetch(url, { next: { revalidate: 300 } });
  if (!res.ok) throw new Error(`Failed to fetch ${source} calendar: ${res.status}`);
  const raw = await res.text();
  const text = sanitizeIcal(raw);

  const jcal = ICAL.parse(text);
  const comp = new ICAL.Component(jcal);
  const vevents = comp.getAllSubcomponents("vevent");

  const now = ICAL.Time.now();
  const windowEnd = now.clone();
  windowEnd.addDuration(new ICAL.Duration({ days: 14 }));

  const events: CalendarEvent[] = [];

  for (const vevent of vevents) {
    const event = new ICAL.Event(vevent);

    // Skip cancelled events
    if (vevent.getFirstPropertyValue("status") === "CANCELLED") continue;

    // Handle recurring events
    if (event.isRecurring()) {
      const expand = event.iterator();
      let next = expand.next();
      while (next) {
        if (next.compare(windowEnd) > 0) break;
        if (next.compare(now) >= 0) {
          const occurrence = event.getOccurrenceDetails(next);
          events.push(toEvent(occurrence.item, occurrence.startDate, occurrence.endDate, source));
        }
        next = expand.next();
      }
    } else {
      const start = event.startDate;
      const end = event.endDate;
      if (start.compare(windowEnd) <= 0 && end.compare(now) >= 0) {
        events.push(toEvent(event, start, end, source));
      }
    }
  }

  return events;
}

function toEvent(
  event: ICAL.Event,
  start: ICAL.Time,
  end: ICAL.Time,
  source: "personal" | "work",
): CalendarEvent {
  return {
    id: `${source}:${event.uid}:${start.toICALString()}`,
    title: event.summary ?? "(No title)",
    start: start.toJSDate().toISOString(),
    end: end.toJSDate().toISOString(),
    allDay: start.isDate,
    source,
    location: event.location || undefined,
    description: event.description || undefined,
  };
}

export async function GET() {
  const personalUrl = process.env.ICAL_URL_PERSONAL;
  const workUrl = process.env.ICAL_URL_WORK;

  if (!personalUrl && !workUrl) {
    return ok({ events: [] });
  }

  const results = await Promise.allSettled([
    personalUrl ? fetchAndParse(personalUrl, "personal") : Promise.resolve([]),
    workUrl ? fetchAndParse(workUrl, "work") : Promise.resolve([]),
  ]);

  const events: CalendarEvent[] = [];
  const errors: string[] = [];

  for (const r of results) {
    if (r.status === "fulfilled") events.push(...r.value);
    else errors.push(String(r.reason));
  }

  // Sort by start time
  events.sort((a, b) => a.start.localeCompare(b.start));

  if (errors.length > 0 && events.length === 0) {
    return err(`Calendar fetch failed: ${errors.join("; ")}`, 502);
  }

  return ok({ events, errors: errors.length > 0 ? errors : undefined });
}
