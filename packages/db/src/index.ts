import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

export * from "./schema";

function createDb() {
  const tursoUrl = process.env["TURSO_URL"];

  // Production: Turso (hosted libSQL, requires auth token)
  // Local dev: libSQL with local file (no native build needed)
  const client = createClient({
    url: tursoUrl ?? `file:${process.env["SQLITE_PATH"] ?? "local.db"}`,
    authToken: tursoUrl ? process.env["TURSO_AUTH_TOKEN"] : undefined,
  });

  return drizzle(client, { schema });
}

export const db = createDb();
export type Db = typeof db;
