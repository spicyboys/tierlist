export const runtime = "edge";

import { NextRequest, NextResponse } from "next/server";
import { getEnv } from "@/lib/env";
import { getDb, schema } from "@/lib/db";
import { eq, and } from "drizzle-orm";

// Check if a tier list has an active live session
export async function GET(req: NextRequest) {
  const tierListId = req.nextUrl.searchParams.get("tierListId");
  if (!tierListId) {
    return NextResponse.json({ error: "tierListId required" }, { status: 400 });
  }

  const env = getEnv();
  const db = getDb(env.DB);

  const session = await db
    .select({ code: schema.liveSessions.code })
    .from(schema.liveSessions)
    .where(
      and(
        eq(schema.liveSessions.tierListId, tierListId),
        eq(schema.liveSessions.active, true)
      )
    )
    .get();

  if (!session) {
    return NextResponse.json({ active: false });
  }

  return NextResponse.json({ active: true, code: session.code });
}
