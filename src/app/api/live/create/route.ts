export const runtime = "edge";

import { NextRequest, NextResponse } from "next/server";
import { getEnv } from "@/lib/env";
import { getDb, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { customAlphabet } from "nanoid";
import { verifyPassword } from "@/lib/password";
import { getAuthUser } from "@/lib/auth";

const generateId = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 25);
const generateCode = customAlphabet("ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789", 6);

export async function POST(req: NextRequest) {
  const { tierListId, password } = (await req.json()) as {
    tierListId: string;
    password?: string;
  };

  const env = getEnv();
  const db = getDb(env.DB);

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
  const user = await getAuthUser(req);
  if (user && tierList.ownerId === user.id) {
    authorized = true;
  } else if (password) {
    authorized = await verifyPassword(password, tierList.editPasswordHash);
  }

  if (!authorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const code = generateCode();
  await db.insert(schema.liveSessions).values({
    id: generateId(),
    code,
    tierListId,
    active: true,
  }).run();

  return NextResponse.json({
    code,
    tierListId,
    url: `/live/${code}`,
  });
}
