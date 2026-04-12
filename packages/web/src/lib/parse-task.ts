import * as chrono from "chrono-node";
import type { TimeOfDay } from "@todo/shared";

function toLocalDateStr(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

const TIME_ALIASES: Record<string, TimeOfDay> = {
  morning: "morning",
  morn: "morning",
  day: "day",
  night: "night",
};

export interface ParseResult {
  title: string;
  whenDate?: string;
  timeOfDay?: TimeOfDay;
  /** HH:MM in 24h format */
  scheduledTime?: string;
  deadline?: string;
  isSomeday?: boolean;
  projectId?: string;
  projectName?: string;
}

/**
 * Parse a natural-language task string into structured fields.
 *
 * Tokens recognised (all case-insensitive):
 *   @morning | @morn | @day | @night  → timeOfDay
 *   #ProjectName                       → projectId (matched against active projects)
 *   !! <date>                          → deadline
 *   <date expression>                  → whenDate (parsed by chrono-node)
 *
 * All matched tokens are stripped from the returned title.
 */
export function parseTaskInput(
  raw: string,
  projects: Array<{ id: string; name: string; isCompleted: boolean }> = [],
): ParseResult {
  let text = raw;
  let timeOfDay: TimeOfDay | undefined;
  let projectId: string | undefined;
  let projectName: string | undefined;
  let deadline: string | undefined;
  let whenDate: string | undefined;
  let scheduledTime: string | undefined;
  let isSomeday: boolean | undefined;

  // 1. Extract someday token
  text = text.replace(/\bsomeday\b/gi, () => {
    isSomeday = true;
    return "";
  });

  // 2. Extract @time-of-day tokens
  text = text.replace(/@(morning|morn|day|night)\b/gi, (_, match) => {
    timeOfDay = TIME_ALIASES[match.toLowerCase()];
    return "";
  });

  // 3. Extract #ProjectName tokens (only if a matching active project exists)
  text = text.replace(/#(\w+)/g, (full, name) => {
    const found = projects.find(
      (p) => !p.isCompleted && p.name.toLowerCase() === name.toLowerCase(),
    );
    if (found) {
      projectId = found.id;
      projectName = found.name;
      return "";
    }
    return full; // keep unrecognised hashtags in title
  });

  // 4. Extract !! deadline
  const bangIdx = text.indexOf("!!");
  if (bangIdx !== -1) {
    const afterBangs = text.slice(bangIdx + 2).trimStart();
    const results = chrono.parse(afterBangs, new Date(), { forwardDate: true });
    if (results.length > 0) {
      const r = results[0];
      deadline = toLocalDateStr(r.date());
      text =
        text.slice(0, bangIdx) +
        afterBangs.slice(0, r.index) +
        afterBangs.slice(r.index + r.text.length);
    } else {
      text = text.slice(0, bangIdx) + text.slice(bangIdx + 2);
    }
  }

  // 5. Extract natural-language date (and time if explicitly stated) from remaining text
  if (!isSomeday) {
    const dateResults = chrono.parse(text, new Date(), { forwardDate: true });
    if (dateResults.length > 0) {
      const r = dateResults[0];
      whenDate = toLocalDateStr(r.date());
      // Only extract a scheduled time if the user explicitly stated one (not inferred)
      if (r.start.isCertain("hour")) {
        const h = String(r.start.get("hour")).padStart(2, "0");
        const m = String(r.start.get("minute") ?? 0).padStart(2, "0");
        scheduledTime = `${h}:${m}`;
      }
      text = text.slice(0, r.index) + text.slice(r.index + r.text.length);
    }
  }

  const title = text.replace(/\s+/g, " ").trim();

  return { title, whenDate, timeOfDay, scheduledTime, deadline, isSomeday, projectId, projectName };
}
