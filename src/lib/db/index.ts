import { drizzle, DrizzleD1Database } from "drizzle-orm/d1";
import * as schema from "./schema";
import { getEnv } from "../env";

export type Database = DrizzleD1Database<typeof schema>;

export function getDb(): Database {
  const env = getEnv();
  return drizzle(env.DB, { schema });
}

export { schema };
