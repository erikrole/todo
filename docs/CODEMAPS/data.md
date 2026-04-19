<!-- Generated: 2026-04-18 | Files scanned: schema.ts + 10 migrations | Token estimate: ~600 -->

# Data

Schema: `packages/db/src/schema.ts`. Driver: `@libsql/client`. ORM: Drizzle.
Local: `file:packages/db/local.db`. Prod: Turso `todo-prod-erikrole.aws-us-east-1.turso.io`.

## Tables

### Core Task Tables
```
areas
  id, name, color, isArchived, position(real), createdAt, updatedAt

projects
  id, name, areaId→areas, parentProjectId→projects(self)
  isCompleted, completedAt, isArchived, isSomeday, position(real)

sections
  id, projectId→projects, title, position(real), isCollapsed

tasks
  id, title, notes
  whenDate(YYYY-MM-DD), timeOfDay(morning|day|night|null)
  deadline(YYYY-MM-DD)
  projectId→projects, areaId→areas, sectionId→sections
  parentTaskId→tasks(self), spawnedFromTaskId→tasks(self)
  isCompleted, completedAt, isCancelled, isSomeday, deletedAt(soft delete)
  position(real)
  recurrenceType(daily|weekly|monthly|yearly|weekday|appointment)
  recurrenceMode(on_schedule|after_completion)
  recurrenceInterval(int), recurrenceEndsAt(YYYY-MM-DD)

taskCompletions
  id, taskId→tasks, completedAt, intervalActual(int, days), notes
```

### Log / Metric Tables
```
logs
  id, name, slug(unique), description, icon, color, isBuiltIn, position(real)

logEntries
  id, logId→logs, loggedAt(ISO), numericValue(real), data(JSON text), notes
```

### Life Tracking Tables
```
subscriptions
  id, name, amount(real), billingPeriod(monthly|yearly|weekly|quarterly)
  nextDueDate(YYYY-MM-DD), category, autoRenew, isSplit, isActive

occasions
  id, name, occasionType(birthday|anniversary|holiday|other)
  personName, startYear(int), month(int), day(int), isAnnual, prepWindowDays(int)
```

## Relationships
```
areas ──< projects ──< sections
       └──< tasks
projects ──< tasks ──< tasks (subtasks via parentTaskId)
                    └── tasks (recurrence chain via spawnedFromTaskId)
tasks ──< taskCompletions
logs  ──< logEntries
```

## Position / Ordering
`position REAL` (fractional indexing) on areas, projects, tasks.
Insert between items: `position = (a + b) / 2`. No renumbering needed.

## Migration History
```
0001 — initial: areas, projects, sections, tasks
0002 — task soft delete (deletedAt)
0003 — taskCompletions table
0004 — recurrence fields on tasks
0005 — spawnedFromTaskId on tasks
0006 — isCancelled, isSomeday on tasks
0007 — parentProjectId on projects
0008 — logs, logEntries, occasions, subscriptions tables
0009 — occasionType, personName, startYear on occasions
0010 — isSplit on subscriptions
```
