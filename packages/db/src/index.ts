import { env } from "@promptshield/env/server";
import { drizzle } from "drizzle-orm/node-postgres";

import * as schema from "./schema";

export function createDb() {
  return drizzle(env.DATABASE_URL, { schema });
}

export type Database = ReturnType<typeof createDb>;

export const db = createDb();

// Re-export all schema tables so routers can import from @promptshield/db
export * from "./schema";
