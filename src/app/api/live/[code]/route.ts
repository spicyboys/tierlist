import { NextRequest, NextResponse } from "next/server";
import { getDb, schema } from "@/lib/db";
import { eq, and } from "drizzle-orm";

export async function GET(
  _req: NextRequest,
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

  return NextResponse.json({
    code: session.id,
    tierListId: session.tierListId,
    active: true,
  });
}

// End a live session (owner only)
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const db = getDb();

  await db
    .delete(schema.liveSessions)
    .where(eq(schema.liveSessions.id, code.toUpperCase()))
    .run();

  return NextResponse.json({ success: true });
}
