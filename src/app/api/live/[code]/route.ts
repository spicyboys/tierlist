export const runtime = "edge";

import { NextRequest, NextResponse } from "next/server";
import { getEnv } from "@/lib/env";
import { getDb, schema } from "@/lib/db";
import { eq, and } from "drizzle-orm";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const env = getEnv();
  const db = getDb(env.DB);

  const session = await db
    .select()
    .from(schema.liveSessions)
    .where(
      and(
        eq(schema.liveSessions.code, code.toUpperCase()),
        eq(schema.liveSessions.active, true)
      )
    )
    .get();

  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  return NextResponse.json({
    code: session.code,
    tierListId: session.tierListId,
    active: true,
  });
}

// End a live session (owner only)
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const env = getEnv();
  const db = getDb(env.DB);

  await db
    .update(schema.liveSessions)
    .set({ active: false })
    .where(eq(schema.liveSessions.code, code.toUpperCase()))
    .run();

  return NextResponse.json({ success: true });
}
