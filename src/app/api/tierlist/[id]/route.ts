export const runtime = "edge";

import { NextRequest, NextResponse } from "next/server";
import { getEnv } from "@/lib/env";
import { getDb, schema } from "@/lib/db";
import { eq, and, asc } from "drizzle-orm";
import { customAlphabet } from "nanoid";
import { getAuthUser } from "@/lib/auth";

const generateId = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 25);

async function getTierListFull(db: ReturnType<typeof getDb>, id: string) {
  const tierList = await db
    .select()
    .from(schema.tierLists)
    .where(eq(schema.tierLists.id, id))
    .get();

  if (!tierList) return null;

  const tierRows = await db
    .select()
    .from(schema.tiers)
    .where(eq(schema.tiers.tierListId, id))
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
        eq(schema.items.tierListId, id),
        eq(schema.items.isUnsorted, true)
      )
    )
    .orderBy(asc(schema.items.order))
    .all();

  const liveSession = await db
    .select()
    .from(schema.liveSessions)
    .where(eq(schema.liveSessions.tierListId, id))
    .get();

  const liveSessionId = liveSession ? liveSession.id : null;

  return {
    id: tierList.id,
    title: tierList.title,
    ownerId: tierList.ownerId,
    tiers: tiersWithItems,
    items: unsortedItems,
    liveSessionId,
  };
}

// Check authorization: auth user owns it OR password matches
async function checkAuthorization(
  req: NextRequest,
  db: ReturnType<typeof getDb>,
  id: string
): Promise<boolean> {
  // Check auth cookie first
  const user = await getAuthUser(req);
  if (!user) {
    return false;
  }
  const tierList = await db
    .select()
    .from(schema.tierLists)
    .where(eq(schema.tierLists.id, id))
    .get();
  return tierList?.ownerId === user.id;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const env = getEnv();
  const db = getDb(env.DB);
  const tierList = await getTierListFull(db, id);

  if (!tierList) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(tierList);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const env = getEnv();
  const db = getDb(env.DB);

  const authorized = await checkAuthorization(req, db, id);
  if (!authorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const body = (await req.json()) as any;

  // Update title
  if (body.title !== undefined) {
    await db
      .update(schema.tierLists)
      .set({ title: body.title, updatedAt: new Date() })
      .where(eq(schema.tierLists.id, id))
      .run();
  }

  // Full state save
  if (body.tiers) {
    await db
      .delete(schema.items)
      .where(eq(schema.items.tierListId, id))
      .run();
    await db
      .delete(schema.tiers)
      .where(eq(schema.tiers.tierListId, id))
      .run();

    for (const tier of body.tiers) {
      const tierId = generateId();
      await db.insert(schema.tiers).values({
        id: tierId,
        label: tier.label,
        color: tier.color,
        order: tier.order,
        tierListId: id,
      }).run();

      if (tier.items) {
        for (let i = 0; i < tier.items.length; i++) {
          const item = tier.items[i];
          await db.insert(schema.items).values({
            id: generateId(),
            title: item.title,
            imageUrl: item.imageUrl || null,
            order: i,
            tierId,
            tierListId: id,
            isUnsorted: false,
          }).run();
        }
      }
    }

    if (body.unsortedItems) {
      for (let i = 0; i < body.unsortedItems.length; i++) {
        const item = body.unsortedItems[i];
        await db.insert(schema.items).values({
          id: generateId(),
          title: item.title,
          imageUrl: item.imageUrl || null,
          order: i,
          tierListId: id,
          isUnsorted: true,
        }).run();
      }
    }

    await db
      .update(schema.tierLists)
      .set({ updatedAt: new Date() })
      .where(eq(schema.tierLists.id, id))
      .run();
  }

  const updated = await getTierListFull(db, id);
  return NextResponse.json(updated);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const env = getEnv();
  const db = getDb(env.DB);

  const authorized = await checkAuthorization(req, db, id);
  if (!authorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  await db
    .delete(schema.tierLists)
    .where(eq(schema.tierLists.id, id))
    .run();

  return NextResponse.json({ success: true });
}
