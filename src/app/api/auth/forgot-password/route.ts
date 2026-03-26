export const runtime = "edge";

import { NextRequest, NextResponse } from "next/server";
import { getEnv } from "@/lib/env";
import { getDb, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { customAlphabet } from "nanoid";

const generateToken = customAlphabet(
  "abcdefghijklmnopqrstuvwxyz0123456789",
  40
);

export async function POST(req: NextRequest) {
  const { email } = (await req.json()) as { email?: string };

  if (!email) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }

  const trimmedEmail = email.trim().toLowerCase();
  const env = getEnv();
  const db = getDb(env.DB);

  const user = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.email, trimmedEmail))
    .get();

  // Always return success to avoid email enumeration
  if (!user) {
    return NextResponse.json({ success: true });
  }

  const token = generateToken();
  const expiresAt = Math.floor(Date.now() / 1000) + 3600; // 1 hour

  await db
    .update(schema.users)
    .set({ resetToken: token, resetTokenExpiresAt: expiresAt })
    .where(eq(schema.users.id, user.id))
    .run();

  // In production, send this via email. For now, return it.
  return NextResponse.json({ success: true, resetToken: token });
}
