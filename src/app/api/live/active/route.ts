export const runtime = "edge";

import { getDb, schema } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";

export async function GET(
  req: NextRequest,
) {

  const searchParams = req.nextUrl.searchParams
  const guildId = searchParams.get('guildId')

  if (!guildId) {
    return NextResponse.json({ error: "guildId is required" }, { status: 400 });
  }

  const env = getEnv();
  const db = getDb(env.DB);

  const sessions = await db
    .select({
      code: schema.liveSessions.id,
      title: schema.tierLists.title,
    })
    .from(schema.liveSessions)
    .where(eq(schema.liveSessions.discordGuildId, guildId))
    .innerJoin(
      schema.tierLists,
      eq(schema.tierLists.id, schema.liveSessions.tierListId)
    )
    .all();

  return NextResponse.json(sessions);
}