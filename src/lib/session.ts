"use server";

import { ResponseCookie } from "next/dist/compiled/@edge-runtime/cookies";
import { cookies, headers } from "next/headers";

export async function setSessionCookie(token: string) {
  (await cookies()).set("__session", token, await cookieOptions());
}

export async function deleteSessionCookie() {
  (await cookies()).delete({
    name: "__session",
    ...await cookieOptions()
  });
}

async function cookieOptions(): Promise<Partial<ResponseCookie>> {
  const headersList = await headers();
  const origin = headersList.get("origin");

  if (origin) {
    return {
      domain: new URL(origin).hostname,
      sameSite: "none",
      partitioned: true,
      secure: true,
    }
  }

  return {};
}