<!-- Generated: 2026-04-18 | Files scanned: package.json files | Token estimate: ~400 -->

# Dependencies

## External Services

| Service | Purpose | Config |
|---------|---------|--------|
| Turso (libsql) | Production SQLite DB | `TURSO_URL` + `TURSO_AUTH_TOKEN` |
| Anthropic API | Daily briefing, AI appointment suggestion, MCP architect tools | `ANTHROPIC_API_KEY` |
| Vercel | Hosting + CI/CD | project: `erikroles-projects/todo` |

## Key Libraries

### Database
- `@libsql/client` — unified SQLite/Turso driver
- `drizzle-orm` — type-safe ORM
- `drizzle-kit` — migration generation/application

### Web (`packages/web`)
- `next` — App Router, route handlers, middleware
- `@tanstack/react-query` — server state management
- `@radix-ui/*` + `shadcn/ui` — UI primitives
- `tailwindcss` — styling
- `chrono-node` — NLP date parsing → `when_date`
- `@dnd-kit/*` — drag-and-drop task reordering
- `date-fns` — date formatting
- `zod` — schema validation (via `@todo/shared`)
- `lucide-react` — icons

### MCP (`packages/mcp`)
- `@modelcontextprotocol/sdk` — MCP server + stdio transport
- `@anthropic-ai/sdk` — Claude API for architect tools

## Internal Packages
```
@todo/shared  (packages/shared)  types + Zod schemas
@todo/db      (packages/db)      Drizzle schema + client
```

## Environment Variables

| Variable | Package | Purpose |
|----------|---------|---------|
| `TURSO_URL` | db, mcp | Turso URL (absent = local SQLite) |
| `TURSO_AUTH_TOKEN` | db, mcp | Turso auth token |
| `NEXT_PUBLIC_AUTH_TOKEN` | web | Bearer token for all REST API calls |
| `ANTHROPIC_API_KEY` | web, mcp | Claude API (brief + intelligence + architect) |
| `ARCHITECT_MODEL` | mcp | Override model for plan_project (default: claude-sonnet-4-6) |
