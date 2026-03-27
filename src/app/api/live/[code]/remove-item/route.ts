import { NextRequest, NextResponse } from "next/server";
import { getDb, schema } from "@/lib/db";
import { eq, and } from "drizzle-orm";

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

  const { itemId } = (await req.json()) as { itemId?: string };
  if (!itemId) {
    return NextResponse.json({ error: "itemId required" }, { status: 400 });
  }

  await db
    .delete(schema.items)
    .where(eq(schema.items.id, itemId))
    .run();

  return NextResponse.json({ success: true });
}
