export const runtime = "edge";

import { NextRequest, NextResponse } from "next/server";
import { getEnv } from "@/lib/env";
import { getDb, schema } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { customAlphabet } from "nanoid";

const generateId = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 25);

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

  const { title, imageUrl } = (await req.json()) as { title?: string; imageUrl?: string };
  if (!title) {
    return NextResponse.json({ error: "Title required" }, { status: 400 });
  }

  const id = generateId();
  await db.insert(schema.items).values({
    id,
    title,
    imageUrl: imageUrl || null,
    order: Date.now(), // Use timestamp for ordering new items
    tierListId: session.tierListId,
    isUnsorted: true,
  }).run();

  return NextResponse.json({ id, title, imageUrl });
}
