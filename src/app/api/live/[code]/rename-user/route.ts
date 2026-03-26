export const runtime = "edge";

import { NextRequest, NextResponse } from "next/server";
import { getEnv } from "@/lib/env";
import { getDb, schema } from "@/lib/db";
import { eq, and } from "drizzle-orm";

// Host renames a participant
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const { userId, newName } = (await req.json()) as {
    userId: string;
    newName: string;
  };

  if (!userId || !newName?.trim()) {
    return NextResponse.json(
      { error: "userId and newName required" },
      { status: 400 }
    );
  }

  const env = getEnv();
  const db = getDb(env.DB);

  // Find the active session
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

  // Update the user's name
  await db
    .update(schema.liveSessionUsers)
    .set({ name: newName.trim() })
    .where(
      and(
        eq(schema.liveSessionUsers.id, userId),
        eq(schema.liveSessionUsers.sessionId, session.id)
      )
    )
    .run();

  return NextResponse.json({ success: true });
}
