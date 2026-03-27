import { NextRequest, NextResponse } from "next/server";
import { getEnv } from "@/lib/env";
import { getDb, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { customAlphabet } from "nanoid";
import { getAuthUser } from "@/lib/auth";

const generateCode = customAlphabet("ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789", 6);

export async function POST(req: NextRequest) {
  const { tierListId, discordGuildId } = (await req.json()) as {
    tierListId: string;
    discordGuildId: string | null;
  };

  const db = getDb();

  const tierList = await db
    .select()
    .from(schema.tierLists)
    .where(eq(schema.tierLists.id, tierListId))
    .get();

  if (!tierList) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Check auth: either owner or password
  let authorized = false;
  const user = await getAuthUser();
  if (user && tierList.ownerId === user.id) {
    authorized = true;
  }

  if (!authorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const code = generateCode();
  await db.insert(schema.liveSessions).values({
    id: code,
    tierListId,
    discordGuildId
  }).run();

  return NextResponse.json({
    code,
    tierListId,
    url: `/live/${code}`,
  });
}
