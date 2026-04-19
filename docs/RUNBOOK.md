# Runbook

Operational reference for the todo app in production.

## Production Info

| | |
|-|-|
| URL | https://todo.erikrole.com |
| Vercel project | `erikroles-projects/todo` |
| DB | Turso `todo-prod` — `libsql://todo-prod-erikrole.aws-us-east-1.turso.io` |
| Branch | `main` (auto-deploys on push) |

## Deploy

```bash
# Standard deploy
vercel --prod

# Check deployment status
vercel ls

# View recent logs
vercel logs --prod
```

## Environment Variables

```bash
vercel env ls production          # list all
vercel env pull packages/web/.env.local  # pull to local
vercel env add VARIABLE_NAME      # add new variable
```

## Database

```bash
# Local dev DB
pnpm db:migrate       # apply pending migrations (backs up local.db first)
pnpm db:seed          # reset + seed local data (DESTROYS existing data — confirm required)

# Production DB (Turso)
turso db shell todo-prod          # open prod SQL shell
turso db inspect todo-prod        # size, row counts

# Run migration on prod
# Drizzle migrations apply to Turso automatically when deployed — same schema,
# same driver (@libsql/client). Run pnpm db:migrate with prod env vars:
TURSO_URL=libsql://... TURSO_AUTH_TOKEN=... pnpm db:migrate
```

## Common Issues

### API returns 401
- Check `AUTH_TOKEN` is set in Vercel env vars and matches the client

### `/api/brief` or `/api/intelligence/appointment` returns null
- `ANTHROPIC_API_KEY` not set or invalid — check Vercel env vars
- These endpoints fail gracefully (return null, not an error)

### Routine lastCompletedAt not updating
- Check `LINKED_LOG_SOURCES` in `packages/web/src/lib/routine-links.ts`
- The routine title must match exactly; log slug must exist in the `logs` table

### Dev server won't start / DB errors
- Run `pnpm db:migrate` — local.db may be missing migrations
- Check `packages/web/.env.local` has `AUTH_TOKEN` set

### Migrations fail on prod
- Check Turso URL and auth token: `vercel env pull` then test with `turso db shell todo-prod`
- Review migration SQL in `packages/db/drizzle/` for conflicts

## Rollback

```bash
# Roll back to previous Vercel deployment
vercel rollback [deployment-url]

# Roll back DB migration (manual — no automatic down migrations)
# Edit schema.ts, generate a new migration, apply it
```

## MCP Server

The MCP server (`packages/mcp`) connects directly to Turso. It is not deployed — it runs locally via Claude Desktop stdio transport. Requires `TURSO_URL`, `TURSO_AUTH_TOKEN`, and `ANTHROPIC_API_KEY` in the Claude Desktop MCP config.
