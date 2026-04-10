import type { Config } from "drizzle-kit";

export default {
  schema: "./src/schema.ts",
  out: "./drizzle",
  dialect: "turso",
  dbCredentials: {
    url: process.env["TURSO_URL"] ?? `file:${process.env["SQLITE_PATH"] ?? "local.db"}`,
    authToken: process.env["TURSO_AUTH_TOKEN"],
  },
} satisfies Config;
