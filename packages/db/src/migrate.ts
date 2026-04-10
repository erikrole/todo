/**
 * Run migrations — called via `pnpm db:migrate` (drizzle-kit migrate)
 * or directly: `npx tsx packages/db/src/migrate.ts`
 *
 * For local dev, drizzle-kit uses drizzle.config.ts.
 * For Turso, set TURSO_URL + TURSO_AUTH_TOKEN before running.
 */

// drizzle-kit handles actual migration execution.
// This file exists as a hook for custom pre/post-migration logic if needed.
export {};
