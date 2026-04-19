# Native Apple App Design

**Date:** 2026-04-19
**Status:** Approved
**Scope:** iOS, iPadOS, macOS, Apple Watch — full native client replacing the web interface

---

## Overview

A fully native SwiftUI app across all Apple platforms that replaces the current Next.js web interface. The app uses **Swift Data + CloudKit** as its primary storage layer (offline-first, iCloud sync across all devices), with the existing REST API serving only as a one-time migration bridge. Once the native app is stable, the web backend is retired — leaving zero server dependency, zero monthly database cost, and everything private on-device.

The app lives in a **separate Xcode project / git repository** from this monorepo. The monorepo's role is to provide a clean JSON export endpoint and a typed API contract for the initial data migration.

---

## Architecture

### Storage
- **Swift Data** — all structured data (tasks, projects, areas, sections, logs, occasions, subscriptions)
- **CloudKit (iCloud)** — automatic sync across all Apple devices at no extra cost
- **iCloud Drive** (`~/Library/Mobile Documents/com~apple~CloudDocs/Personal/`) — markdown documentation files, already synced, read via `FileManager`
- **Migration bridge (temporary)** — existing REST API at `todo.erikrole.com`, called once on first launch to seed CloudKit, then retired

### Platform targets
- iOS app (iPhone)
- iPadOS app (iPad — same target, adapted layout)
- macOS app (Mac Catalyst or native AppKit where needed)
- Apple Watch companion app
- macOS menu bar app

### Key principle
No server required after migration. Apple Foundation Model, CloudKit, iCloud Drive, and HealthKit all operate locally. The only network calls are iCloud sync (managed by the OS) and WeatherKit.

---

## Section 1 — Swift Data Model

All models are `@Model` classes. CloudKit compatibility rules apply throughout: all relationships are optional, no unique constraints, inverse relationships required on all `@Relationship` pairs, JSON blobs become `Codable` structs stored as `Data`.

### Core models (direct map from Drizzle schema)

**Area**
- `id: UUID`, `name: String`, `notes: String?`, `color: String?`
- `isArchived: Bool`, `position: Double`
- `projects: [Project]` — `@Relationship(inverse: \Project.area)`

**Project**
- `id: UUID`, `name: String`, `notes: String?`, `color: String?`
- `area: Area?` — `@Relationship`
- `parentProject: Project?` — `@Relationship`
- `isCompleted: Bool`, `completedAt: Date?`, `position: Double`

**Section**
- `id: UUID`, `title: String`, `position: Double`, `isCollapsed: Bool`
- `project: Project?` — `@Relationship`

**Task**
- `id: UUID`, `title: String`, `notes: String?`
- `whenDate: Date?`, `timeOfDay: TimeOfDay?` (enum: morning/day/night)
- `deadline: Date?`, `scheduledTime: Date?`
- `project: Project?`, `area: Area?`, `section: Section?`
- `parentTask: Task?`, `subtasks: [Task]`
- `isSomeday: Bool`, `isCompleted: Bool`, `completedAt: Date?`
- `isCancelled: Bool`, `deletedAt: Date?`
- `recurrenceType: String?`, `recurrenceMode: String?`
- `recurrenceInterval: Int?`, `recurrenceEndsAt: Date?`
- `spawnedFromTask: Task?` — tracks which recurring task this instance was created from
- `position: Double`
- `location: CLLocation?` ← **new** — for geofence-triggered reminders (CloudKit-native type)

**Log + LogEntry**
- `Log`: `id`, `name`, `slug`, `entries: [LogEntry]`
- `LogEntry`: `id`, `log: Log?`, `data: Data` (Codable struct), `createdAt: Date`
- `LogEntry.healthKitSampleId: UUID?` ← **new** — links to HealthKit sample to prevent double-counting

**Occasion**
- `id`, `occasionType`, `personName`, `month`, `day`, `startYear`
- `contactId: String?` ← **new** — links to Contacts record
- `linkedCalendarEventId: String?` ← **new** — EventKit event identifier

**Subscription**
- `id`, `name`, `amount`, `billingCycle`, `nextBillingDate`, `isActive`, `isSplit`
- `calendarEventId: String?` ← **new** — EventKit event identifier

### New model

**MarkdownDocument**
- `id: UUID`, `filename: String`, `iCloudPath: URL`
- `cachedContent: String` (indexed for Spotlight)
- `lastIndexedAt: Date`, `tags: [String]`
- Populated by a background file-watcher on the iCloud Drive Personal folder
- Used by Apple Foundation Model for context and by Spotlight for search

---

## Section 2 — OS Surfaces

### WidgetKit (six widget types)

| Widget | Sizes | Content |
|---|---|---|
| Today | Small (count), Medium (top 3), Large (Morning/Day/Evening grouped) | Current day's tasks |
| Inbox count | Small, Lock Screen | Unscheduled task count badge |
| Routines due | Medium | Overdue + approaching routines, color-coded by urgency |
| Upcoming occasion | Medium | Countdown to next birthday/anniversary with contact photo |
| Active project | Medium | Pinnable to a specific project, shows next tasks |
| StandBy / Watch | Minimal | Today count + next task title |

All widgets use a shared **App Group** container so they read Swift Data without launching the main app.

### Action Button
- Exposed as an `AppIntent` action selectable in Settings → Action Button
- Short press → dictate task title → Foundation Model parses date/time/project → saved to Inbox
- Long press → opens quick-add sheet (title + when date)
- Configurable: add task / log entry / start routine timer

### Dynamic Island + Live Activities
- Triggered when a task with a deadline is scheduled for today
- **Compact view** — task title + time remaining in the pill
- **Expanded view** — tap to mark complete or snooze deadline
- Implemented via `ActivityKit` / `LiveActivity`

### Focus Filters
- App registers a `FocusFilterIntent`
- User maps their Areas/Projects to Focus modes in app Settings
- Work focus → shows only work-tagged tasks; Personal focus → hides work projects, surfaces personal + routines
- Sleep/DND → suppresses deadline notifications

### macOS Menu Bar
- `NSStatusItem` with inbox count badge
- Dropdown shows Today tasks with inline checkboxes
- `⌘N` system-wide hotkey opens quick-add without switching windows
- Tap any task to open full detail in the main window

### Apple Watch App
- Complication: today count + next task title
- Main view: Crown-scroll through Today tasks, tap to complete
- Quick-add: dictate to Inbox
- Routines tab: one-tap log entry (mow done, gas filled, etc.)
- Haptic reminder when a deadline is within 1 hour

---

## Section 3 — Apple Intelligence

### Apple Foundation Model — Context Bridge
On-device LLM reading both Swift Data records and iCloud Drive markdown files. Fully private, no API key, no network call. Replaces the current `ANTHROPIC_API_KEY` + `/api/brief` endpoint.

**Capabilities:**
- **Daily brief** — morning summary from Today tasks + overdue routines + upcoming occasions + HealthKit sleep data
- **Task polish** — "Improve" button on any task; cleans title, expands notes using markdown context
- **Smart scheduling** — "When should I mow?" reads WeatherKit forecast + mowing log history + markdown lawn-care notes
- **Markdown Q&A** — "What did I decide about X?" searches MarkdownDocuments, returns answer with file reference
- **Routine insight** — conversational query over log entries and routine schedules
- **Project planning** — plain-text goal → structured task list in a new Project
- **Receipt parsing** — Document Scanner image → Foundation Model extracts amount/merchant/date → log entry
- **Voice task parsing** — spoken task title → Foundation Model extracts date, time of day, project (replaces chrono-node)

### App Intents
Single investment that powers Siri, Shortcuts, and Spotlight simultaneously.

| Intent | Siri phrase | Result |
|---|---|---|
| `AddTaskIntent` | "Add call dentist to my todo" | Task created in Inbox or inferred project |
| `CompleteTaskIntent` | "Mark mow lawn done" | Task completed, recurrence created |
| `LogEntryIntent` | "Log gas fill-up, 12 gallons at $3.45" | Log entry with parsed fields |
| `ShowTodayIntent` | "Show my tasks for today" | Opens Today view |
| `GetTaskCountIntent` | (Shortcuts) | Returns inbox/today/overdue counts |
| `ScheduleTaskIntent` | "Schedule X for Thursday morning" | Sets whenDate + timeOfDay |
| `FindTaskIntent` | (Spotlight) | Full-text task search from system search bar |

### Shortcuts Automations (examples)
- 7am daily → Foundation Model brief → notification
- Arrive home → show Inbox tasks tagged "home" (CoreLocation trigger)
- Connect car Bluetooth → prompt to log gas or check vehicle routines
- Share receipt photo from Photos → Foundation Model parse → log entry
- End of week → summarize completed tasks across all projects

### Spotlight
- All tasks, projects, log entries, and MarkdownDocuments indexed via `CSSearchableItem`
- Tap result → opens directly to that item
- Donated interactions (`NSUserActivity`) surface most-used items higher in results

---

## Section 4 — Personal Data APIs

### HealthKit
- **Auto-complete routines** — background delivery: workout saved to HealthKit → match to routine → complete + create log entry (linked via `healthKitSampleId`)
- **Activity rings** — shown in Today widget and daily brief
- **Sleep data** — Foundation Model softens task load in brief after poor sleep
- **Vitals write** — health log entries optionally written back to HealthKit

### EventKit (Calendar + Reminders)
- **Occasions → Calendar** — birthdays/anniversaries create yearly recurring Calendar events automatically
- **Subscriptions → Calendar** — billing dates appear as Calendar events
- **Deadline tasks → Reminders** — optionally mirror for Siri suggestions
- **Calendar events → Today view** — today's events shown inline between Morning/Day/Evening groups
- **Free/busy** — Foundation Model reads calendar when suggesting task scheduling

### MapKit + CoreLocation
- **Geofence triggers** — attach a location to a task; CoreLocation region monitoring fires a notification on arrival
- **Task location pin** — shown on a map in the task detail view
- **"Tasks near me" view** — filters tasks with locations within a configurable radius
- **Place autocomplete** — MapKit powers location search when pinning a task
- **Mileage tracking** — optional CoreLocation + CoreMotion odometer for the vehicle log

### WeatherKit
- Fetch daily forecast on app launch
- Flag outdoor routines (mow, wash car) with a weather warning badge if rain is forecast
- Foundation Model includes forecast when answering scheduling questions
- Notification: proactive suggestion on good outdoor-task weather after a long gap

### ContactsKit
- Link any Occasion to a real Contacts record
- Shows contact photo in occasions list, widget, and detail view
- Tap linked contact → opens contact card or initiates call
- Import birthday from contact if it already exists in Contacts

### Speech + Camera
- **Voice capture** — Action Button → speak → Foundation Model parses date/project/time
- **Document Scanner** (`VNDocumentCameraViewController`) — scan receipts → Foundation Model extracts fields → log entry
- **Camera Continuity** (macOS) — use iPhone camera as a scanner from the Mac app
- **Share Extension** — share URL/image from any app → lands in Inbox

---

## Section 5 — Migration Strategy

### Phase 1 — Prepare this repo (do now)

**In `packages/web`:**
1. Add `GET /api/export` — returns a single JSON payload of all data (areas, projects, sections, tasks, logs, log entries, occasions, subscriptions). The iOS app calls this once on first launch.
2. Verify `updatedAt` exists on all tables (check `logs`, `log_entries`). Add it via migration if missing.
3. Write a TypeScript types file (`packages/shared/src/export-types.ts`) documenting the exact JSON shape of every entity — this becomes the contract the Swift `Codable` models are written against.

**iCloud Drive:**
4. Organize `~/Library/Mobile Documents/com~apple~CloudDocs/Personal/` into named subdirectories (e.g. `vehicles/`, `health/`, `home/`, `finances/`) so Foundation Model can categorize files during indexing.

**Do not:**
- Migrate or restructure the Turso DB schema
- Build new web features
- Attempt CloudKit server-side integration

### Phase 2 — Parallel operation (during native app development)

- iOS app calls `/api/export` on first launch → populates Swift Data + CloudKit
- All new writes go to CloudKit only
- Web app kept running as read-only fallback during development
- Vercel free tier — no cost to keep it alive

### Phase 3 — Retire the web backend (once native app is stable)

- Take the Vercel project offline (or leave it running, it costs nothing)
- Archive or keep this repo — the REST API code is a useful reference for the Swift `Codable` models
- Cancel Turso subscription
- **End state:** fully native, iCloud sync, zero server dependency, zero backend cost, everything private on-device

---

## What's in scope for the native app (not this repo)

| Area | Technology |
|---|---|
| UI framework | SwiftUI (multiplatform target) |
| Storage | Swift Data + CloudKit |
| Sync | CloudKit (`CKContainer`) |
| On-device AI | Apple Foundation Model (`FoundationModels` framework) |
| Widgets | WidgetKit + App Groups |
| Automation | App Intents (`AppIntent`, `AppShortcutsProvider`) |
| Scheduling | `UserNotifications`, `BackgroundTasks` |
| Health | HealthKit (`HKHealthStore`) |
| Calendar | EventKit (`EKEventStore`) |
| Location | CoreLocation, MapKit |
| Weather | WeatherKit |
| Contacts | Contacts framework |
| Watch | WatchKit / SwiftUI for watchOS |
| Menu bar | `NSStatusItem` |
| Capture | `VNDocumentCameraViewController`, `AVFoundation`, Share Extension |
| Search | `CoreSpotlight`, `NSUserActivity` |
| Focus | `FocusFilterIntent` |

---

## Open questions

- What to name the new Xcode project / GitHub repo
- Whether to use Mac Catalyst or a separate native macOS target (Catalyst is faster to ship; native macOS is higher quality)
- CloudKit container ID and iCloud entitlements setup
- TestFlight / App Store distribution plan
