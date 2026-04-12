<!-- Generated: 2026-04-12 | Files scanned: 98 | Token estimate: ~600 -->
# Architecture

## System Overview

```
Browser / iOS (future)
        │  REST + Bearer token
        ▼
┌─────────────────────────────┐
│  packages/web (Next.js)     │
│  UI + /api/* route handlers │
└──────────┬──────────────────┘
           │ imports @todo/db
           ▼
┌──────────────────────────────┐
│  packages/db (Drizzle ORM)   │
│  libsql client               │
│  local.db ◄──► Turso (prod)  │
└──────────────────────────────┘
           ▲ imports @todo/db
           │
┌──────────────────────────────┐
│  packages/mcp (stdio MCP)    │
│  Claude → CRUD tools         │
└──────────────────────────────┘
```

## Package Dependency Graph

```
@todo/shared  (types + Zod schemas)
   ▲   ▲   ▲
   │   │   │
  db  web  mcp
```

## Data Flow — Task Creation

```
User types in TaskQuickAdd
  → parseTaskInput (chrono-node NLP)
  → POST /api/tasks (Bearer auth via proxy.ts)
  → tasks route handler → @todo/db insert
  → TanStack Query cache invalidated
  → UI re-renders via useQuery
```

## Monorepo Layout

```
/
├── packages/
│   ├── shared/     Zod schemas, TS types
│   ├── db/         Drizzle schema, client, migrations, seed
│   ├── web/        Next.js app (UI + REST API)
│   └── mcp/        MCP stdio server for Claude
├── CLAUDE.md       AI assistant guide
└── pnpm-workspace.yaml
```
