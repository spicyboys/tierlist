export const runtime = "edge";

import { NextRequest, NextResponse } from "next/server";
import { getEnv } from "@/lib/env";
import { getDb, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { customAlphabet } from "nanoid";
import { hashPasswordSecure, createJWT, authCookie } from "@/lib/auth";

const generateId = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 25);

export async function POST(req: NextRequest) {
  const { email, password, name } = (await req.json()) as {
    email?: string;
    password?: string;
    name?: string;
  };

  if (!email || !password) {
    return NextResponse.json(
      { error: "Email and password are required" },
      { status: 400 }
    );
  }

  const trimmedEmail = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }

  if (password.length < 6) {
    return NextResponse.json(
      { error: "Password must be at least 6 characters" },
      { status: 400 }
    );
  }

  const env = getEnv();
  const db = getDb(env.DB);

  const existing = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.email, trimmedEmail))
    .get();

  if (existing) {
    return NextResponse.json(
      { error: "An account with this email already exists" },
      { status: 409 }
    );
  }

  const id = generateId();
  const passwordHash = await hashPasswordSecure(password);

  await db
    .insert(schema.users)
    .values({
      id,
      email: trimmedEmail,
      name: name?.trim() || "Anonymous",
      passwordHash,
    })
    .run();

  const token = await createJWT({ userId: id, email: trimmedEmail });
  const res = NextResponse.json({
    id,
    email: trimmedEmail,
    name: name?.trim() || "Anonymous",
  });
  res.headers.set("Set-Cookie", authCookie(token));
  return res;
}
