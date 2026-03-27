import { NextRequest, NextResponse } from "next/server";
import { getDb, schema } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { getAuthUser } from "@/lib/auth";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { code } = await params;
  const db = getDb();

  const session = await db
    .select()
    .from(schema.liveSessions)
    .where(
      and(
        eq(schema.liveSessions.id, code.toUpperCase()),
      )
    )
    .get();

  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const { itemId } = (await req.json()) as {
    itemId: string | null;
  };

  await db
    .update(schema.liveSessionUsers)
    .set({ draggingItemId: itemId || null })
    .where(
      and(
        eq(schema.liveSessionUsers.userId, user.id),
        eq(schema.liveSessionUsers.sessionId, session.id)
      )
    )
    .run();

  return NextResponse.json({ success: true });
}
