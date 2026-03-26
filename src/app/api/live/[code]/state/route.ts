export const runtime = "edge";

import { NextRequest, NextResponse } from "next/server";
import { getEnv } from "@/lib/env";
import { getDb, schema } from "@/lib/db";
import { eq, and, asc, gt, sql } from "drizzle-orm";

// Users seen within the last 10 seconds are considered online
const PRESENCE_TIMEOUT_SEC = 10;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const env = getEnv();
  const db = getDb(env.DB);

  // Validate session is active
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
    return NextResponse.json({ error: "Session ended", ended: true }, { status: 404 });
  }

  // Handle heartbeat: upsert user presence using INSERT OR REPLACE
  const userId = req.nextUrl.searchParams.get("userId");
  const userName = req.nextUrl.searchParams.get("userName");
  const now = Math.floor(Date.now() / 1000);

  if (userId && userName) {
    // Use raw SQL for proper upsert to avoid race conditions
    await db.run(sql`
      INSERT INTO live_session_users (id, session_id, name, last_seen_at)
      VALUES (${userId}, ${session.id}, ${userName}, ${now})
      ON CONFLICT(id) DO UPDATE SET
        last_seen_at = ${now},
        name = ${userName},
        session_id = ${session.id}
    `);
  }

  // Clean up very old entries (older than 60 seconds)
  const cleanupCutoff = now - 60;
  await db
    .delete(schema.liveSessionUsers)
    .where(
      and(
        eq(schema.liveSessionUsers.sessionId, session.id),
        gt(sql`${cleanupCutoff}`, schema.liveSessionUsers.lastSeenAt)
      )
    )
    .run();

  // Fetch active users (seen within timeout)
  const cutoff = now - PRESENCE_TIMEOUT_SEC;
  const activeUsers = await db
    .select({
      id: schema.liveSessionUsers.id,
      name: schema.liveSessionUsers.name,
      draggingItemId: schema.liveSessionUsers.draggingItemId,
    })
    .from(schema.liveSessionUsers)
    .where(
      and(
        eq(schema.liveSessionUsers.sessionId, session.id),
        gt(schema.liveSessionUsers.lastSeenAt, cutoff)
      )
    )
    .all();

  // Fetch full tier list state
  const tierList = await db
    .select()
    .from(schema.tierLists)
    .where(eq(schema.tierLists.id, session.tierListId))
    .get();

  if (!tierList) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const tierRows = await db
    .select()
    .from(schema.tiers)
    .where(eq(schema.tiers.tierListId, session.tierListId))
    .orderBy(asc(schema.tiers.order))
    .all();

  const tiersWithItems = await Promise.all(
    tierRows.map(async (tier) => {
      const tierItems = await db
        .select()
        .from(schema.items)
        .where(
          and(eq(schema.items.tierId, tier.id), eq(schema.items.isUnsorted, false))
        )
        .orderBy(asc(schema.items.order))
        .all();
      return { ...tier, items: tierItems };
    })
  );

  const unsortedItems = await db
    .select()
    .from(schema.items)
    .where(
      and(
        eq(schema.items.tierListId, session.tierListId),
        eq(schema.items.isUnsorted, true)
      )
    )
    .orderBy(asc(schema.items.order))
    .all();

  return NextResponse.json({
    id: tierList.id,
    title: tierList.title,
    tiers: tiersWithItems,
    items: unsortedItems,
    active: true,
    users: activeUsers,
  });
}
