import { getRequestContext } from "@cloudflare/next-on-pages";

export interface CloudflareEnv {
  DB: D1Database;
}

export function getEnv(): CloudflareEnv {
  const { env } = getRequestContext();
  return env as unknown as CloudflareEnv;
}
