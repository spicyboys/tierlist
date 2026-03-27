import { NextRequest, NextResponse } from "next/server";
import { getDb, schema } from "@/lib/db";
import { eq, desc } from "drizzle-orm";
import { customAlphabet } from "nanoid";
import { getAuthUser } from "@/lib/auth";

const generateId = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 25);

const DEFAULT_TIERS = [
  { label: "S", color: "#ff7f7f", order: 0 },
  { label: "A", color: "#ffbf7f", order: 1 },
  { label: "B", color: "#ffdf7f", order: 2 },
  { label: "C", color: "#ffff7f", order: 3 },
  { label: "D", color: "#bfff7f", order: 4 },
  { label: "F", color: "#7fffff", order: 5 },
];

export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json() as {
    title: string;
  };

  const db = getDb();
  const tierListId = generateId();

  await db
    .insert(schema.tierLists)
    .values({
      id: tierListId,
      title: body.title,
      ownerId: user.id,
    })
    .run();

  for (const tier of DEFAULT_TIERS) {
    await db
      .insert(schema.tiers)
      .values({
        id: generateId(),
        label: tier.label,
        color: tier.color,
        order: tier.order,
        tierListId,
      })
      .run();
  }

  return NextResponse.json({ id: tierListId, title: body.title });
}

// GET tier lists by IDs (from client localStorage) or by owner
export async function GET(req: NextRequest) {
  const db = getDb();

  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const lists = await db
    .select()
    .from(schema.tierLists)
    .where(eq(schema.tierLists.ownerId, user.id))
    .orderBy(desc(schema.tierLists.updatedAt))
    .all();

  const results = await Promise.all(
    lists.map(async (list) => {
      const itemCount = await db
        .select()
        .from(schema.items)
        .where(eq(schema.items.tierListId, list.id))
        .all();
      return {
        id: list.id,
        title: list.title,
        updatedAt: list.updatedAt,
        _count: { items: itemCount.length },
      };
    })
  );
  return NextResponse.json(results);
}
