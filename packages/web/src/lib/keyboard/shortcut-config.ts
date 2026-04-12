// packages/web/src/lib/keyboard/shortcut-config.ts

export type ShortcutCategory = "navigation" | "task-nav" | "task-actions" | "app";

export interface ShortcutDef {
  id: string;
  defaultKey: string; // e.g. "Meta+1", "c", "Backspace", "?"
  label: string;
  category: ShortcutCategory;
  description?: string;
}

export const SHORTCUT_DEFS: ShortcutDef[] = [
  // Navigation (Cmd+number — no browser conflicts)
  { id: "navigate-today",    defaultKey: "Meta+1",    label: "Go to Today",           category: "navigation" },
  { id: "navigate-inbox",    defaultKey: "Meta+2",    label: "Go to Inbox",           category: "navigation" },
  { id: "navigate-upcoming", defaultKey: "Meta+3",    label: "Go to Upcoming",        category: "navigation" },
  { id: "navigate-someday",  defaultKey: "Meta+4",    label: "Go to Someday",         category: "navigation" },
  { id: "navigate-logbook",  defaultKey: "Meta+5",    label: "Go to Logbook",         category: "navigation" },
  { id: "command-palette",   defaultKey: "Meta+k",    label: "Open command palette",  category: "navigation" },
  { id: "toggle-sidebar",    defaultKey: "Meta+/",    label: "Toggle sidebar",        category: "navigation" },
  // Task navigation (bare keys — skip when focus is in an input)
  { id: "task-next",         defaultKey: "j",         label: "Focus next task",       category: "task-nav" },
  { id: "task-prev",         defaultKey: "k",         label: "Focus previous task",   category: "task-nav" },
  { id: "task-expand",       defaultKey: "Enter",     label: "Expand / open task",    category: "task-nav" },
  { id: "task-close",        defaultKey: "Escape",    label: "Close / deselect",      category: "task-nav" },
  // Task actions (bare keys — no-op when focusedTaskId is null)
  { id: "task-new",          defaultKey: "n",         label: "New task",              category: "task-actions", description: "Quick-add in current view" },
  { id: "task-complete",     defaultKey: "c",         label: "Complete task",         category: "task-actions" },
  { id: "task-delete",       defaultKey: "Backspace", label: "Delete task",           category: "task-actions" },
  { id: "task-edit",         defaultKey: "e",         label: "Edit title",            category: "task-actions", description: "Focuses the title input" },
  { id: "task-move-today",   defaultKey: "t",         label: "Move → Today",          category: "task-actions" },
  { id: "task-move-inbox",   defaultKey: "i",         label: "Move → Inbox",          category: "task-actions" },
  { id: "task-move-someday", defaultKey: "s",         label: "Move → Someday",        category: "task-actions" },
  // App
  { id: "show-shortcuts",    defaultKey: "?",         label: "Show shortcuts",        category: "app" },
  { id: "undo",              defaultKey: "Meta+z",    label: "Undo",                  category: "app" },
];

export const SHORTCUT_STORAGE_KEY = "todo-keyboard-shortcuts";

export type ShortcutOverrides = Record<string, { key: string; enabled: boolean }>;

/**
 * Convert a KeyboardEvent to a normalized key string.
 * Returns "" for lone modifier keys (Meta, Ctrl, Alt, Shift).
 * Examples: "Meta+1", "c", "Backspace", "?" (shift is embedded in e.key)
 */
export function eventToKey(e: KeyboardEvent): string {
  if (["Meta", "Control", "Alt", "Shift"].includes(e.key)) return "";
  const mods: string[] = [];
  if (e.metaKey) mods.push("Meta");
  if (e.ctrlKey) mods.push("Ctrl");
  if (e.altKey) mods.push("Alt");
  return [...mods, e.key].join("+");
}

/**
 * Returns true if a KeyboardEvent matches a stored key string.
 * Note: Shift is NOT checked explicitly — it's already embedded in e.key
 * (e.g. e.key === "?" when Shift+/ is pressed on a US keyboard).
 */
export function matchesKey(e: KeyboardEvent, keyDef: string): boolean {
  if (!keyDef) return false;
  const parts = keyDef.split("+");
  const key = parts[parts.length - 1];
  if (!key) return false;
  const needsMeta = parts.includes("Meta");
  const needsCtrl = parts.includes("Ctrl");
  const needsAlt = parts.includes("Alt");
  return (
    e.key === key &&
    e.metaKey === needsMeta &&
    e.ctrlKey === needsCtrl &&
    e.altKey === needsAlt
  );
}

/** Load overrides from localStorage. Returns {} if empty or on error. */
export function loadOverrides(): ShortcutOverrides {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(SHORTCUT_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as ShortcutOverrides) : {};
  } catch {
    return {};
  }
}

/** Persist overrides to localStorage. */
export function saveOverrides(overrides: ShortcutOverrides): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(SHORTCUT_STORAGE_KEY, JSON.stringify(overrides));
}

/** Format a key string for display. Returns an array of key-cap strings. */
export function formatKeyParts(key: string): string[] {
  return key.split("+").map((part) => {
    if (part === "Meta") return "⌘";
    if (part === "Ctrl") return "⌃";
    if (part === "Alt") return "⌥";
    if (part === "Backspace") return "⌫";
    if (part === "Escape") return "Esc";
    if (part === "Enter") return "↵";
    return part;
  });
}
