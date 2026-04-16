# Design Redesign Plan — 2026-04-16

## Direction

**Linear base** — compact, monochrome-with-one-accent, tool feel. One Notion borrow: editorial view headers.

## Two Opinionated Moves

1. **Violet accent as default** — oklch(0.55 0.22 295), replaces generic blue. More distinctive, less SaaS-generic.
2. **Larger view headers** — `text-2xl` instead of `text-lg`. Today gets a date subtitle line (weekday + date in muted mono).

## Accent Color Theming

User-selectable accent. Presets: Violet (default), Blue, Indigo, Teal, Rose, Amber.

**Implementation:**
- `data-accent` attribute on `<html>` — CSS handles light/dark per-accent via `html[data-accent="X"]` and `html.dark[data-accent="X"]` selectors
- `ACCENT_STORAGE_KEY = "todo-accent"` in localStorage
- Anti-FOUC inline `<script>` in `layout.tsx` body reads localStorage and sets attribute before first paint
- `useAccentColor` hook for read/write from components
- `SettingsSheet` component in sidebar footer — accent swatches + theme toggle (Light/Dark/System)

## Scope

**Token overhaul + component re-skin. No IA changes.**

Files changed:
- `src/app/globals.css` — new violet default, per-accent CSS rules, ::selection uses var(--primary)
- `src/app/layout.tsx` — anti-FOUC accent script
- `src/lib/accent-colors.ts` — preset definitions
- `src/hooks/use-accent-color.ts` — localStorage persistence + DOM sync
- `src/components/settings/settings-sheet.tsx` — new settings panel
- `src/components/layout/sidebar.tsx` — SettingsSheet in footer, ThemeToggle moved inside sheet
- `src/app/(views)/*/page.tsx` — bumped h1 to text-2xl; Today gets date subtitle

## Not Changed

- Layout structure, routing, keyboard shortcuts, task expand behavior, drag-and-drop
- Task item left-border selection UX (unchanged — this is functional, not decorative)
