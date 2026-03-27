import { NextRequest, NextResponse } from "next/server";
import { getDb, schema } from "@/lib/db";
import { eq, and, asc, gt, sql } from "drizzle-orm";
import { getAuthUser } from "@/lib/auth";

// Users seen within the last 10 seconds are considered online
const PRESENCE_TIMEOUT_SEC = 10;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { code } = await params;
  const db = getDb();

  // Validate session is active
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

  // Handle heartbeat: upsert user presence using INSERT OR REPLACE
  const now = Math.floor(Date.now() / 1000);

  // Use raw SQL for proper upsert to avoid race conditions
  await db.insert(schema.liveSessionUsers).values({
    userId: user.id,
    sessionId: session.id,
    lastSeenAt: now,
  }).onConflictDoUpdate({
    target: [schema.liveSessionUsers.userId, schema.liveSessionUsers.sessionId],
    set: {
      lastSeenAt: now,
      draggingItemId: sql`excluded.dragging_item_id`, // Preserve dragging state if provided
    },
  }).run();

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
      id: schema.liveSessionUsers.userId,
      username: schema.users.username,
      draggingItemId: schema.liveSessionUsers.draggingItemId,
    })
    .from(schema.liveSessionUsers)
    .where(
      and(
        eq(schema.liveSessionUsers.sessionId, session.id),
        gt(schema.liveSessionUsers.lastSeenAt, cutoff)
      )
    )
    .innerJoin(schema.users, eq(schema.users.id, schema.liveSessionUsers.userId))
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
    ownerId: tierList.ownerId,
    title: tierList.title,
    tiers: tiersWithItems,
    items: unsortedItems,
    active: true,
    users: activeUsers,
  });
}
