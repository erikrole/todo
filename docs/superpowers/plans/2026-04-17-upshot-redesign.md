# Upshot Redesign — Implementation Plan
_Date: 2026-04-17_

## Source
Design bundle: `https://api.anthropic.com/v1/design/h/OJfYXpy47KsnRiKhYbEAzg?open_file=Upshot.html`

## Summary
Full visual rethink: personal assistant "second brain" UI. Warm neutrals, serif display type (Newsreader), 3-column layout (sidebar / briefing / context rail), Today briefing with NowStrip + time buckets + routines. Replaces the current linear task-list feel.

---

## Open questions (blocking)
1. **Replace vs. new route?** Does this replace the current app shell + Today page, or preview at `/today-v2`?
2. **App name.** "Upshot" is a placeholder. Keep it, or defer to current "todo"?
3. **Vault/Obsidian surfaces.** Sync screen, Settings screen, VaultFooter, TaskDetailPanel "Source" section — all assume two-way Obsidian sync (not yet built). Ship as coming-soon/mock, or skip entirely for now?
4. **TweaksPanel.** This is a design-tool scaffolding panel for switching accent/font/theme. Keep as a real user-facing tweaks panel, or skip?

---

## Staged implementation plan

### Phase 1 — Tokens + fonts + layout shell
- Add CSS custom properties (--bg, --surface, --ink, --accent, etc.) to `globals.css` with light/dark/accent presets
- Load Google Fonts: Newsreader + IBM Plex Sans via `next/font` (Geist likely already loaded)
- New 3-column layout: `Sidebar (232px)` | `main (flex)` | `ContextRail (320px)`
- Sidebar: Upshot brand + search slot + views nav (Today/Inbox/Upcoming/Someday/Routines/Logbook/Trash) + Areas tree + VaultFooter + Settings button

### Phase 2 — Today briefing
- `TopBar`: weather + Morning/Day/Evening toggle
- `Greeting`: serif headline + AI brief sentence
- `NowStrip`: timeline rail with task + calendar event chips and "now" marker
- `TodayBuckets`: Morning / Anytime / Evening sections with inline quick-add
- `Overdue`: "Overdue & flagged" section with carry-forward metadata
- `Routines` section: streak-chip / heatmap / countdown variants

### Phase 3 — CommandBar
- Pinned bottom-center, always visible
- Input with rotating hint text
- Parse-intent sub-line (visual only; NLP TBD)

### Phase 4 — Secondary screens (restyle existing)
- Upcoming (already exists, needs date-grouped layout)
- Someday (already exists as filter, needs dedicated screen)
- Logbook (already exists, needs day-grouped layout)
- Trash (already exists, needs restyle)
- Routines full screen (exists, needs restyle)
- Project detail (exists, needs progress bar + section layout)
- Inbox (already exists, needs restyle)

### Phase 5 — TaskDetailPanel
- Slide-in from right on task click
- Title + metadata grid (project, area, when, deadline, recurrence)
- Action buttons (Reschedule, Move to Someday, Delete)
- Vault "Source" section: conditional — show if vault is connected, otherwise hide

### Phase 6 — Evening recap
- RecapScreen: "That's a wrap, Erik." + highlights/unfinished 2-col grid + tomorrow staged card

### Phase 7 — Vault surfaces (conditional on Q3)
- VaultFooter → SyncScreen → SettingsScreen
- RoutineNoteScreen (reference info + heatmap + completion log)
- TaskDetailPanel Source section wired to real data

### Defer / skip
- Mobile framed preview component (design-tool flourish; real mobile is responsive)
- TweaksPanel (unless user wants it)
- Real NLP in CommandBar (design mock only)

---

## Tech decisions
- Tokens: add to `packages/web/src/app/globals.css`; reference via Tailwind `[var(--token)]` syntax or extend theme
- Fonts: `next/font/google` — `Newsreader` (display) + `IBM_Plex_Sans` (UI fallback)
- Accent/theme variants: `data-theme` + `data-accent` attributes on `<body>`; driven by localStorage setting
- Component location: `packages/web/src/components/upshot/` (new folder)
- State: theme/accent settings in a small context or Zustand slice; persisted to localStorage
