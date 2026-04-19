<!-- Generated: 2026-04-18 | Files scanned: ~120 | Token estimate: ~600 -->

# Architecture

## Project Type
pnpm monorepo — personal task manager (Things 3-inspired) + life-tracking features

## Package Boundaries

```
packages/shared   ← TypeScript types + Zod schemas (no runtime deps)
     ↓ imported by
packages/db       ← Drizzle ORM schema + libsql client (SQLite/Turso)
     ↓ imported by
packages/web      ← Next.js App Router (frontend + REST API)
packages/mcp      ← Standalone MCP server (stdio transport, direct DB access)
```

## Data Flow

```
Browser / iOS
    │  HTTP + Bearer token
    ▼
packages/web/src/app/api/   (Next.js route handlers)
    │  Drizzle ORM
    ▼
packages/db (libsql client)
    │
    ▼
local.db (dev)  OR  Turso (prod: todo-prod-erikrole.aws-us-east-1.turso.io)

Claude Desktop
    │  stdio MCP
    ▼
packages/mcp (direct DB access, no HTTP hop)
```

## Auth
Single Bearer token (`AUTH_TOKEN`) checked in `packages/web/src/app/proxy.ts` (Next.js middleware). No auth library. No login page.

## Key Design Decisions
- **Single DB driver** (`@libsql/client`) for both local SQLite and Turso — same Drizzle schema, zero native compilation
- **Fractional indexing** (`position REAL`) on areas, projects, tasks — O(1) drag-reorder
- **Recurrence spawning** — completing a recurring task creates the next instance (two modes: `on_schedule` / `after_completion`)
- **Routine tracking** — some routines pull `lastCompletedAt` from `log_entries` instead of `task_completions` (see `lib/routine-links.ts`)

## Deployment
- Production: https://todo.erikrole.com (Vercel, `erikroles-projects/todo`)
- Deploy: `vercel --prod`
