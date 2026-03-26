export const runtime = "edge";

import { NextRequest, NextResponse } from "next/server";
import { getEnv } from "@/lib/env";
import { getDb, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { verifyPasswordSecure, createJWT, authCookie } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const { email, password } = (await req.json()) as {
    email?: string;
    password?: string;
  };

  if (!email || !password) {
    return NextResponse.json(
      { error: "Email and password are required" },
      { status: 400 }
    );
  }

  const trimmedEmail = email.trim().toLowerCase();
  const env = getEnv();
  const db = getDb(env.DB);

  const user = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.email, trimmedEmail))
    .get();

  if (!user) {
    return NextResponse.json(
      { error: "Invalid email or password" },
      { status: 401 }
    );
  }

  const valid = await verifyPasswordSecure(password, user.passwordHash);
  if (!valid) {
    return NextResponse.json(
      { error: "Invalid email or password" },
      { status: 401 }
    );
  }

  const token = await createJWT({ userId: user.id, email: user.email });
  const res = NextResponse.json({
    id: user.id,
    email: user.email,
    name: user.name,
  });
  res.headers.set("Set-Cookie", authCookie(token));
  return res;
}
