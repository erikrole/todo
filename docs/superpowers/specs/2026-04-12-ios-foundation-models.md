# iOS FoundationModels Roadmap

**Date:** 2026-04-12  
**Framework:** Apple FoundationModels (iOS 26 / Apple Intelligence)  
**Dependency:** iOS app scaffold built against the existing REST API  
**Constraint:** 4,096 token context window; on-device only; availability varies by device

---

## Philosophy

All four features run entirely on-device — no Anthropic API key, no network call for AI inference. This is the iOS app's key differentiation from the web app: privacy-preserving intelligence that works offline. Each feature degrades gracefully when the model is unavailable (device not eligible, Apple Intelligence disabled, model not downloaded).

---

## Feature 1 — NLP Quick-Add  *(highest value, ship first)*

**What:** Parse natural language task input into structured fields before POSTing to the REST API. Mirrors `parseTaskInput` in the web app but runs entirely on-device.

**Input:** `"submit expense report friday morning #work !! next monday"`  
**Output:** `{ title: "submit expense report", whenDate: "2026-04-17", timeOfDay: "morning", projectId: <work-project-id>, deadline: "2026-04-20" }`

### Generable Schema

```swift
@Generable(description: "Parsed fields extracted from a natural language task description")
struct ParsedTaskInput {
    @Guide(description: "The clean task title with all scheduling tokens removed")
    var title: String

    @Guide(description: "ISO date string YYYY-MM-DD for when to do the task, or nil")
    var whenDate: String?

    @Guide(description: "Time of day to do the task")
    var timeOfDay: TimeOfDay?

    @Guide(description: "ISO date string YYYY-MM-DD for the hard deadline, or nil")
    var deadline: String?

    @Guide(description: "Whether this is a someday/maybe task with no scheduled date")
    var isSomeday: Bool

    @Guide(description: "The name of the matching project, or nil")
    var projectName: String?
}

@Generable
enum TimeOfDay: String {
    case morning, day, night
}
```

### Session Setup

```swift
let instructions = """
    You extract structured task fields from natural language input.
    Today's date is \(todayISO). Resolve relative dates ("tomorrow", "friday", "next week") to absolute YYYY-MM-DD strings.
    Available projects: \(projectNames.joined(separator: ", "))
    Match project names case-insensitively. Return nil for projectName if no match.
    "!!" prefix means deadline, not when_date.
    """
```

### UX Integration

- Parse runs on every keystroke with 300ms debounce → show chips below input (same as web quick-add)
- Chips: blue date, teal time-of-day, violet project, amber deadline, gray someday
- Chips are tappable to clear individual parsed tokens
- On submit → merge parsed fields with current view defaults (projectId, areaId) → POST `/api/tasks`

### Availability Fallback

When model unavailable → ship a Swift port of the regex/chrono rules from `parse-task.ts` as a deterministic fallback. No silent degradation.

---

## Feature 2 — Smart Scheduling Suggestions

**What:** After viewing Today or Upcoming, the app proactively surfaces an "Overloaded?" prompt when it detects an imbalanced schedule, with specific reschedule suggestions.

**Trigger:** User opens Today and has ≥ 6 tasks + at least 2 days in Upcoming with 0 tasks.

### Flow

1. Collect today's task list + next 7 days of scheduled tasks (capped at 40 tasks to stay under token budget)
2. Single prompt → structured suggestions
3. Present as swipeable cards: "Move 'X' to Thursday?" → swipe right to apply, left to dismiss
4. Apply via PATCH `/api/tasks/[id]` with the new `whenDate`

### Generable Schema

```swift
@Generable(description: "Schedule rebalancing suggestions")
struct ScheduleSuggestions {
    @Guide(description: "Up to 5 specific reschedule suggestions", .count(5))
    var suggestions: [RescheduleSuggestion]

    @Guide(description: "One-line summary of why the schedule looks imbalanced")
    var rationale: String
}

@Generable(description: "A single reschedule suggestion")
struct RescheduleSuggestion {
    var taskId: String
    var taskTitle: String
    var suggestedDate: String  // YYYY-MM-DD
    var reason: String         // "Light day, similar priority to today's tasks"
}
```

### Token Budget

Tasks are serialized as compact JSON: `{"id":"…","title":"…","date":"…","timeOfDay":"…"}` — approximately 80 tokens per task. 40 tasks ≈ 3,200 tokens, leaving ~800 for prompt + output.

---

## Feature 3 — On-Device Project Planning

**What:** User describes a project in natural language; the app generates a structured plan (sections + tasks) and previews it before POSTing to the REST API. iOS equivalent of the `plan_project` MCP tool.

**Input:** "Plan a kitchen renovation — demo, plumbing, electrical, drywall, cabinets, final touches"  
**Output:** Project with 6 sections, ~30 tasks, preview screen before committing

### Flow

1. Dedicated "New Project from Brief" entry point (long-press + button on Projects list)
2. Multi-line text input + stream the plan as it generates (use `streamResponse`)
3. Preview table: sections as headers, tasks as rows — user can tap to delete or rename before committing
4. On confirm → POST `/api/projects` → POST `/api/sections` (per section) → POST `/api/tasks` (per task)

### Generable Schema

```swift
@Generable(description: "A structured project plan")
struct ProjectPlan {
    var projectName: String
    var notes: String?

    @Guide(description: "Logical phases or groupings of work")
    var sections: [PlannedSection]
}

@Generable(description: "A section containing related tasks")
struct PlannedSection {
    var title: String

    @Guide(description: "Concrete, actionable tasks for this section", .count(8))
    var tasks: [PlannedTask]
}

@Generable(description: "A single actionable task")
struct PlannedTask {
    var title: String
    var notes: String?
}
```

### Streaming UX

Use `streamResponse` → update SwiftUI state with each `PartiallyGenerated` snapshot → sections and tasks appear progressively as the model generates them.

---

## Feature 4 — Daily Briefing & Summaries

**What:** Two surfaces: (a) a morning briefing card on Today that summarizes what's ahead, and (b) per-project progress summaries on the project detail view.

### 4a — Morning Briefing

Triggered at first app open before 10am if Today has ≥ 3 tasks. Single paragraph, ≤ 3 sentences, no structured output needed.

```swift
let prompt = """
    I have \(taskCount) tasks today: \(taskTitles.joined(separator: ", ")).
    Write a brief, motivating one-paragraph morning briefing. Be concise and direct.
    """
```

Surface as a dismissable card at the top of the Today view. Cached until midnight.

### 4b — Project Summary

On project detail view → "Summarize" button → generates a 2-3 sentence status update from the project name, open task titles, and completed task count.

```swift
@Generable(description: "A project status summary")
struct ProjectSummary {
    @Guide(description: "2-3 sentence current status of the project")
    var statusText: String

    @Guide(description: "The single most important next action")
    var nextAction: String

    @Guide(description: "Overall health: on_track, at_risk, or blocked")
    var health: ProjectHealth
}

@Generable
enum ProjectHealth: String {
    case on_track, at_risk, blocked
}
```

---

## Release Sequence

| Phase | Feature | Prerequisite | Complexity |
|-------|---------|-------------|------------|
| iOS v1.0 | App scaffold + full REST integration | — | High |
| iOS v1.1 | **NLP Quick-Add** | v1.0 | Low |
| iOS v1.2 | **Daily Briefing** (4a) | v1.1 | Low |
| iOS v1.3 | **Smart Scheduling** | v1.1 | Medium |
| iOS v1.4 | **Project Planning** | v1.3 | Medium |
| iOS v1.5 | **Project Summary** (4b) | v1.4 | Low |

NLP Quick-Add ships first because it has the highest daily-use impact and the simplest schema. Briefing follows because it's nearly stateless. Scheduling and planning are saved for after the core iOS experience is stable.

---

## Cross-Cutting Concerns

### Availability Guard (all features)

```swift
func withModelIfAvailable(_ action: (LanguageModelSession) async throws -> Void) async {
    guard SystemLanguageModel.default.availability == .available else {
        // feature silently absent — no error shown to user
        return
    }
    let session = LanguageModelSession()
    try? await action(session)
}
```

### Token Budget Rule

- Always serialize tasks as compact single-line JSON
- Cap task lists at 40 items before passing to the model
- Instructions + prompt + expected output must fit in 4,096 tokens
- Project planning: limit to 8 sections × 8 tasks = 64 tasks max

### Shared Swift Package

All FoundationModels logic lives in a `TodoAI` Swift package (separate from the main app target) so it can be unit-tested and reused across iPhone/iPad/Mac targets.
