export const runtime = "edge";

import { NextRequest, NextResponse } from "next/server";
import { getEnv } from "@/lib/env";
import { getDb, schema } from "@/lib/db";
import { eq, and } from "drizzle-orm";

export async function POST(
  req: NextRequest,
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

  const { userId, itemId } = (await req.json()) as {
    userId: string;
    itemId: string | null;
  };

  if (!userId) {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }

  await db
    .update(schema.liveSessionUsers)
    .set({ draggingItemId: itemId || null })
    .where(eq(schema.liveSessionUsers.id, userId))
    .run();

  return NextResponse.json({ success: true });
}
