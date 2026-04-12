# Implementation Plan: Architect Agent

> **STATUS: WAITING FOR CONFIRMATION** — see Clarifying Questions below.

---

## Clarifying Questions (must resolve before implementation)

The input `+ architect agent` is ambiguous. Three plausible interpretations:

1. **(Assumed default) MCP architect tool** — A new MCP tool that accepts a natural-language project brief, calls the Claude API internally to decompose it into a project/sections/tasks tree, and either returns the proposal for review or writes it to the DB.
2. **Web chat UI** — A new panel in `packages/web` with a chat interface that talks to Claude and uses the existing REST API to create projects/sections/tasks.
3. **Background analyzer** — A scheduled job that inspects existing tasks (stale, overdue, unscoped) and surfaces suggestions.

**Q1 — Which interpretation?** Default assumed: **#1 (MCP tool)**. Matches existing MCP integration direction, reuses existing plumbing, no new UI work.

**Q2 — One-step or two-step flow?**
  - **(A)** Generate AND write in one call, OR
  - **(B)** Two tools: `plan_project` (dry run, returns proposed JSON) + `apply_project_plan` (writes rows after review).
  
  **Default assumed: (B).** Lets the user see the decomposition before touching the DB.

**Q3 — Which Claude model?** Default assumed: `claude-sonnet-4-5` (env-overridable).

**Q4 — Green-field only or extend existing projects?** Default assumed: **green-field only in Phase 1**, extend-existing as a Phase 3 enhancement.

**Q5 — Where does `ANTHROPIC_API_KEY` live?** Default assumed: `packages/mcp/.env`, loaded via dotenv at startup. Not shipped to the web bundle.

---

## Overview

Add an "architect agent" MCP tool pair that turns a natural-language project description into a structured project plan (sections + tasks + subtasks) via a direct call to the Anthropic API, with a dry-run/confirm flow so the caller can review before writing to the DB.

## Requirements

- Natural language input → structured breakdown (project / sections / tasks / subtasks).
- Dry-run first (`plan_project`), commit second (`apply_project_plan`).
- Single new dependency: `@anthropic-ai/sdk` in `packages/mcp` only.
- Single new env var: `ANTHROPIC_API_KEY`.
- No changes required to the web UI in Phase 1 or 2.
- MCP writes directly to DB (no HTTP hop), consistent with existing tools.

## Prerequisite Gap

The MCP package has no section tools today. Sections exist in the DB schema, shared types, and web API — but not in MCP tools. Creating a project with sections from the architect tool would silently drop section info unless we add section CRUD first (Phase 1).

Also: `create_task` in `packages/mcp/src/tools/tasks.ts` does not accept `sectionId` in its Zod schema. Must be extended in Phase 1.

---

## Architecture Changes

New files:
- `packages/mcp/src/tools/sections.ts` — section CRUD tools
- `packages/mcp/src/tools/architect.ts` — `plan_project` + `apply_project_plan`
- `packages/mcp/src/lib/anthropic.ts` — Anthropic SDK wrapper
- `packages/mcp/src/lib/architect-schema.ts` — Zod schema for plan JSON
- `packages/mcp/src/lib/prompts.ts` — system prompt + few-shot examples
- `packages/mcp/.env.example` — document new env var

Modified files:
- `packages/mcp/src/tools/tasks.ts` — add `sectionId` to create_task/update_task
- `packages/mcp/src/index.ts` — register section tools + architect tools
- `packages/mcp/package.json` — add `@anthropic-ai/sdk`, `dotenv`
- `packages/shared/src/schemas.ts` — export `ProjectPlanSchema` (optional, for future web reuse)
- `CLAUDE.md` — document `ANTHROPIC_API_KEY`
- `PLAN.md` — add architect tool to MCP tools list

---

## Implementation Phases

### Phase 0: Research and scaffolding

1. Confirm Anthropic SDK API shape after install (check installed README/.d.ts — do not rely on memorized method signatures)
2. Decide structured-output strategy: tool-use with `submit_project_plan` tool (preferred) vs. JSON mode with client-side validation

### Phase 1: Section MCP tools + create_task sectionId (prerequisite)

3. Add `@anthropic-ai/sdk` + `dotenv` to `packages/mcp/package.json`
4. Create `packages/mcp/src/tools/sections.ts` — `list_sections`, `create_section`, `update_section`, `delete_section`
5. Extend `create_task`/`update_task` with `sectionId: z.string().optional()`
6. Register section tools in `packages/mcp/src/index.ts`
7. Smoke test via MCP inspector

### Phase 2: Architect tools (dry-run + apply)

8. Define `ProjectPlanSchema` in `architect-schema.ts`:
   ```
   {
     project: { name, notes?, color?, areaId? },
     sections: [{ tempId, title, position }],
     tasks: [{
       tempId, title, notes?, whenDate?, deadline?, timeOfDay?,
       sectionTempId?, parentTaskTempId?
     }]
   }
   ```
9. Build Anthropic client wrapper in `anthropic.ts` — `generateProjectPlan(brief, opts)`, one retry on schema-validation failure
10. Write system prompt in `prompts.ts` — domain context, output rules, today's date, 1–2 few-shot examples
11. Implement `plan_project` (dry run) — returns validated plan JSON + human-readable summary, no DB writes
12. Implement `apply_project_plan` — inserts all rows in a single `db.transaction`, resolves tempId → real id map for sections/subtasks
13. Register architect tools in `index.ts`
14. Wire `ANTHROPIC_API_KEY` via `.env.example` + dotenv, update CLAUDE.md
15. End-to-end smoke test: brief → plan → apply → verify in web UI

### Phase 3 (optional, not in MVP)

16. `existingProjectId` mode — extend/rework an existing project
17. Streaming feedback — stream Claude's reasoning through MCP content blocks
18. Cost/safety caps — max tokens, max tasks per plan, daily call counter
19. Web chat UI — Next.js route + server action (only if interpretation #2 is also wanted)

---

## Testing Strategy

- **Unit**: `ProjectPlanSchema` validation, tempId resolution (happy path, dangling refs, circular refs)
- **Integration**: MCP inspector session — `plan_project` + `apply_project_plan` against throwaway `local.db`
- **E2E (Playwright)**: after `apply_project_plan`, navigate to project page, assert sections + tasks render
- **Manual quality**: run architect on 5 diverse briefs, grade output

---

## Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Claude returns malformed JSON despite tool-use | High | Validate with `ProjectPlanSchema`, one auto-retry with error appended |
| Anthropic SDK API surface stale in training data | High | Read installed README/.d.ts before writing wrapper |
| Transaction rollback behavior on libsql | Medium | Verify `db.transaction` API against installed Drizzle version |
| Schema drift (MCP tool ≠ DB column) | Medium | Derive MCP input schemas from `@todo/shared` Zod schemas |
| API cost/latency spikes | Medium | Default small model, cap `max_tokens`, Phase 3 daily counter |
| `ANTHROPIC_API_KEY` absent in Vercel/Turso env | Low | Clear error message instead of cryptic SDK exception |

---

## Success Criteria

- [ ] `plan_project` returns validated `ProjectPlan` JSON for 5 sample briefs
- [ ] `apply_project_plan` atomically creates project + sections + tasks viewable in web UI
- [ ] Section tools work via MCP inspector
- [ ] `create_task` accepts `sectionId`
- [ ] No changes to `packages/web` or DB migrations in Phase 1–2
- [ ] CLAUDE.md lists `ANTHROPIC_API_KEY`
- [ ] Phase 2 can be delivered without Phase 3

---

## Key File Paths

| File | Action |
|------|--------|
| `packages/mcp/src/index.ts` | modify — register new tools |
| `packages/mcp/src/tools/tasks.ts` | modify — add sectionId |
| `packages/mcp/src/tools/sections.ts` | **new** |
| `packages/mcp/src/tools/architect.ts` | **new** |
| `packages/mcp/src/lib/anthropic.ts` | **new** |
| `packages/mcp/src/lib/architect-schema.ts` | **new** |
| `packages/mcp/src/lib/prompts.ts` | **new** |
| `packages/mcp/package.json` | modify — add deps |
| `packages/mcp/.env.example` | **new** |
| `packages/shared/src/schemas.ts` | optional modify — export ProjectPlanSchema |
| `CLAUDE.md` | modify — document ANTHROPIC_API_KEY |
| `PLAN.md` | modify — add architect tools |
