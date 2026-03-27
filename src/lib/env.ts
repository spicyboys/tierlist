import { getCloudflareContext } from "@opennextjs/cloudflare";

export interface CloudflareEnv {
  DB: D1Database;
}

export function getEnv(): CloudflareEnv {
  const { env } = getCloudflareContext();
  return env as unknown as CloudflareEnv;
}
