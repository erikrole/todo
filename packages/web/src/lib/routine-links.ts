export type RoutineLink = {
  routineTitle: string;
  logSlug: string;
  typeFilter: string | null;
};

export const LINKED_LOG_SOURCES: RoutineLink[] = [
  { routineTitle: "Mow Lawn", logSlug: "mowing", typeFilter: null },
  { routineTitle: "Oil Change", logSlug: "maintenance", typeFilter: "oil_change" },
  { routineTitle: "Doctor Visit", logSlug: "health", typeFilter: "doctor" },
  { routineTitle: "Eye Exam", logSlug: "health", typeFilter: "eye_exam" },
  { routineTitle: "Dentist", logSlug: "health", typeFilter: "dental" },
];

export const LINKED_ROUTINE_TITLES = new Set(LINKED_LOG_SOURCES.map((s) => s.routineTitle));

export const GAS_LOG_SLUG = "gas";
export const OIL_CHANGE_TASK_TITLE = "Oil Change";
export const OIL_CHANGE_INTERVAL_MILES = 7500;
