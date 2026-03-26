export const runtime = "edge";

import { NextRequest, NextResponse } from "next/server";
import { getEnv } from "@/lib/env";
import { getDb, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { hashPasswordSecure } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const { token, password } = (await req.json()) as {
    token?: string;
    password?: string;
  };

  if (!token || !password) {
    return NextResponse.json(
      { error: "Token and password are required" },
      { status: 400 }
    );
  }

  if (password.length < 6) {
    return NextResponse.json(
      { error: "Password must be at least 6 characters" },
      { status: 400 }
    );
  }

  const env = getEnv();
  const db = getDb(env.DB);

  const user = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.resetToken, token))
    .get();

  if (!user) {
    return NextResponse.json(
      { error: "Invalid or expired reset token" },
      { status: 400 }
    );
  }

  const now = Math.floor(Date.now() / 1000);
  if (!user.resetTokenExpiresAt || user.resetTokenExpiresAt < now) {
    return NextResponse.json(
      { error: "Reset token has expired" },
      { status: 400 }
    );
  }

  const passwordHash = await hashPasswordSecure(password);

  await db
    .update(schema.users)
    .set({ passwordHash, resetToken: null, resetTokenExpiresAt: null })
    .where(eq(schema.users.id, user.id))
    .run();

  return NextResponse.json({ success: true });
}
