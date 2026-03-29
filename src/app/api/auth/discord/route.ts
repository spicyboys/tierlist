import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase/admin";

export async function POST(req: NextRequest) {
  const { code } = (await req.json()) as {
    code: string;
  };
  const response = await fetch('https://discord.com/api/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID!,
      client_secret: process.env.DISCORD_CLIENT_SECRET!,
      grant_type: 'authorization_code',
      code: code,
    }),
  });

  const { access_token } = (await response.json()) as {
    access_token: string;
  };

  const userResponse = await fetch('https://discord.com/api/users/@me', {
    headers: {
      Authorization: `Bearer ${access_token}`,
    },
  });

  const user = await userResponse.json() as {
    id: string;
    username: string;
    email: string;
  };

  let uid: string;

  try {
    // Check if this Discord user already has a Firebase account
    const existing = await adminAuth.getUser(user.id);
    uid = existing.uid;
    // Keep Discord username up to date
    await adminAuth.updateUser(uid, { displayName: user.username });
  } catch {
    // No account with this Discord UID — check if one exists with the same email
    try {
      const existingByEmail = await adminAuth.getUserByEmail(user.email);
      uid = existingByEmail.uid;
      // Prefer Discord username over existing display name
      await adminAuth.updateUser(uid, { displayName: user.username });
    } catch {
      // No existing account at all — create a new one
      const created = await adminAuth.createUser({
        uid: user.id,
        email: user.email,
        displayName: user.username,
      });
      uid = created.uid;
    }
  }

  const customToken = await adminAuth.createCustomToken(uid);

  return NextResponse.json({
    customToken,
  });
}
