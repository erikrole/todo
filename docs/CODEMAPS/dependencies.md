<!-- Generated: 2026-04-12 | Files scanned: 98 | Token estimate: ~400 -->
# Dependencies

## External Services

| Service | Purpose | Config |
|---------|---------|--------|
| Turso (libSQL) | Production database | `TURSO_URL`, `TURSO_AUTH_TOKEN` |
| Vercel | Hosting + edge network | `vercel --prod` from repo root |
| Anthropic Claude | MCP architect tools | `ANTHROPIC_API_KEY`, `ARCHITECT_MODEL` |

## Key Runtime Dependencies

### `packages/web`

| Package | Usage |
|---------|-------|
| `next` | App Router, API routes, middleware |
| `@tanstack/react-query` v5 | Server state, cache, mutations |
| `@dnd-kit/core` + `@dnd-kit/sortable` | Drag-and-drop tasks and sections |
| `framer-motion` | Animated task expand/collapse |
| `chrono-node` | NLP date parsing |
| `react-day-picker` | Calendar date picker UI |
| `next-themes` | Dark/light mode |
| `sonner` | Toast notifications |
| `drizzle-orm` + `@libsql/client` | DB access (same driver as `packages/db`) |
| `radix-ui` | Headless primitives (via shadcn/ui) |
| `@hugeicons/react` | Icon set |

### `packages/mcp`

| Package | Usage |
|---------|-------|
| `@modelcontextprotocol/sdk` | MCP server + tool registration |
| `@anthropic-ai/sdk` | Claude API for architect tools |
| `drizzle-orm` + `@libsql/client` | Direct DB access |
| `zod` | Tool input validation |

### `packages/db`

| Package | Usage |
|---------|-------|
| `drizzle-orm` | ORM + query builder |
| `@libsql/client` | Turso/SQLite driver |
| `drizzle-kit` | Migration generation |

### `packages/shared`

| Package | Usage |
|---------|-------|
| `zod` | Schema definitions + type inference |

## Dev Dependencies (root)

| Package | Usage |
|---------|-------|
| `prettier` | Code formatting (100-char, double quotes) |
| `typescript` | Strict mode, extends `tsconfig.base.json` |
| `dotenv-cli` | Inject `.env.local` for db commands |
| `playwright` | E2E tests (`packages/web/e2e/`) |
