# Contributing

Personal project — no external contributors. This doc exists for AI agents and future-me.

## Prerequisites

- Node.js 20+
- pnpm 10+ (`npm i -g pnpm`)
- (Optional) Turso CLI for production DB access

## Setup

```bash
git clone <repo>
cd todo
pnpm install

# Copy and fill in env vars
cp packages/web/.env.example packages/web/.env.local
# At minimum: set NEXT_PUBLIC_AUTH_TOKEN to any random string
# ANTHROPIC_API_KEY needed for /api/brief and /api/intelligence/appointment

# Apply DB migrations
pnpm db:migrate

# Start dev server
pnpm dev   # http://localhost:3000
```

## Commands

<!-- AUTO-GENERATED from package.json scripts -->
| Command | Description |
|---------|-------------|
| `pnpm dev` | Start Next.js dev server (web only) |
| `pnpm build` | Production build (web + mcp packages) |
| `pnpm format` | Run Prettier across all files |
| `pnpm db:generate` | Generate new Drizzle migration from schema changes |
| `pnpm db:migrate` | Apply pending migrations (auto-backs up local.db first) |
| `pnpm db:seed` | Reset and populate local.db with sample data (**destroys existing data**) |
| `pnpm e2e` | Run Playwright E2E tests headless (starts dev server if needed) |
| `pnpm e2e:ui` | Open Playwright interactive test UI |
<!-- /AUTO-GENERATED -->

## Environment Variables

<!-- AUTO-GENERATED from packages/web/.env.example -->
| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_AUTH_TOKEN` | **Yes** | Bearer token for all REST API calls. Any random string (`openssl rand -hex 32`). Exposed to browser. |
| `TURSO_URL` | No | Turso DB URL. Absent = local SQLite (`packages/db/local.db`). |
| `TURSO_AUTH_TOKEN` | No | Turso auth token. Required when `TURSO_URL` is set. |
| `ANTHROPIC_API_KEY` | No | Claude API key. Required for `/api/brief` and `/api/intelligence/appointment`. |
| `ARCHITECT_MODEL` | No | Claude model for MCP architect tools. Default: `claude-sonnet-4-6`. |
<!-- /AUTO-GENERATED -->

## Code Style

- **Formatter:** Prettier — double quotes, semicolons, trailing commas, 100-char width. Run `pnpm format` before committing.
- **TypeScript:** strict mode on all packages.
- **UI:** shadcn/ui components only — no hand-rolled primitives.
- **Comments:** only when WHY is non-obvious. No docblocks.

## Database Changes

1. Edit `packages/db/src/schema.ts`
2. `pnpm db:generate` — creates migration file in `packages/db/drizzle/`
3. `pnpm db:migrate` — applies it to local.db
4. Update `docs/CODEMAPS/data.md` migration history

## Adding API Routes

All routes live under `packages/web/src/app/api/`. Conventions:
- Use `ok(data)` / `err(message, status)` from `@/lib/api` for responses
- All routes are protected by the Bearer token middleware (`proxy.ts`)
- Add corresponding TanStack Query hook in `src/hooks/`
- Add `onError: notify.error(...)` to all mutations in hooks

## Testing

E2E tests in `packages/web/e2e/`. Dev server must be running (or `pnpm e2e` starts it).
No unit tests currently — the codebase relies on E2E coverage and TypeScript for correctness.
