export const runtime = "edge";

import { NextRequest, NextResponse } from "next/server";
import { getEnv } from "@/lib/env";
import { getDb, schema } from "@/lib/db";
import { eq, desc, inArray } from "drizzle-orm";
import { customAlphabet } from "nanoid";
import { hashPassword } from "@/lib/password";
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
  const body = (await req.json().catch(() => ({}))) as {
    title?: string;
    creatorName?: string;
    password?: string;
  };

  const user = await getAuthUser(req);

  // Require either auth or password
  if (!user && (!body.password || body.password.length < 1)) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 }
    );
  }

  const title = body.title || "My Tier List";
  const creatorName = user?.name || body.creatorName || "Anonymous";
  // For authenticated users, use a random password hash (they don't need it)
  const editPasswordHash = body.password
    ? await hashPassword(body.password)
    : await hashPassword(generateId());

  const env = getEnv();
  const db = getDb(env.DB);
  const tierListId = generateId();

  await db
    .insert(schema.tierLists)
    .values({
      id: tierListId,
      title,
      creatorName,
      editPasswordHash,
      ownerId: user?.id || null,
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
        tierListId: tierListId,
      })
      .run();
  }

  return NextResponse.json({ id: tierListId, title });
}

// GET tier lists by IDs (from client localStorage) or by owner
export async function GET(req: NextRequest) {
  const env = getEnv();
  const db = getDb(env.DB);

  // If "mine" param, return authenticated user's lists
  if (req.nextUrl.searchParams.has("mine")) {
    const user = await getAuthUser(req);
    if (!user) {
      return NextResponse.json([]);
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
          creatorName: list.creatorName,
          updatedAt: list.updatedAt,
          _count: { items: itemCount.length },
        };
      })
    );
    return NextResponse.json(results);
  }

  const idsParam = req.nextUrl.searchParams.get("ids");
  if (!idsParam) {
    return NextResponse.json([]);
  }

  const ids = idsParam.split(",").filter(Boolean);
  if (ids.length === 0) {
    return NextResponse.json([]);
  }

  const lists = await db
    .select()
    .from(schema.tierLists)
    .where(inArray(schema.tierLists.id, ids))
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
        creatorName: list.creatorName,
        updatedAt: list.updatedAt,
        _count: { items: itemCount.length },
      };
    })
  );

  return NextResponse.json(results);
}
