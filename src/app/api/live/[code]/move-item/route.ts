import { NextRequest, NextResponse } from "next/server";
import { getDb, schema } from "@/lib/db";
import { eq, and, asc } from "drizzle-orm";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
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

  const { itemId, tierId, order } = (await req.json()) as {
    itemId?: string;
    tierId?: string | null;
    order?: number;
  };
  if (!itemId) {
    return NextResponse.json({ error: "itemId required" }, { status: 400 });
  }

  // Move the item to the target tier/unsorted
  await db
    .update(schema.items)
    .set({
      tierId: tierId || null,
      isUnsorted: !tierId,
    })
    .where(eq(schema.items.id, itemId))
    .run();

  // Recompute order for all items in the target container
  const targetItems = tierId
    ? await db
      .select()
      .from(schema.items)
      .where(
        and(eq(schema.items.tierId, tierId), eq(schema.items.isUnsorted, false))
      )
      .orderBy(asc(schema.items.order))
      .all()
    : await db
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

  // Place the moved item at the requested position
  const otherItems = targetItems.filter((i) => i.id !== itemId);
  const insertAt = Math.min(Math.max(order ?? otherItems.length, 0), otherItems.length);
  otherItems.splice(insertAt, 0, { id: itemId } as (typeof otherItems)[0]);

  // Update all orders sequentially
  for (let i = 0; i < otherItems.length; i++) {
    await db
      .update(schema.items)
      .set({ order: i })
      .where(eq(schema.items.id, otherItems[i].id))
      .run();
  }

  return NextResponse.json({ success: true });
}
