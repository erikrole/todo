export type AccentId = "violet" | "blue" | "indigo" | "teal" | "rose" | "amber";

export interface AccentPreset {
  id: AccentId;
  label: string;
  swatch: string;
}

export const ACCENT_PRESETS: AccentPreset[] = [
  { id: "violet", label: "Violet", swatch: "oklch(0.55 0.22 295)" },
  { id: "blue",   label: "Blue",   swatch: "oklch(0.50 0.22 250)" },
  { id: "indigo", label: "Indigo", swatch: "oklch(0.50 0.24 280)" },
  { id: "teal",   label: "Teal",   swatch: "oklch(0.52 0.16 190)" },
  { id: "rose",   label: "Rose",   swatch: "oklch(0.55 0.22 15)"  },
  { id: "amber",  label: "Amber",  swatch: "oklch(0.65 0.18 75)"  },
];

export const DEFAULT_ACCENT: AccentId = "violet";
export const ACCENT_STORAGE_KEY = "todo-accent";
