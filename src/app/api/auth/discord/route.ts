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

  const customToken = await adminAuth.createCustomToken(user.id, {
    username: user.username,
  });

  return NextResponse.json({
    customToken,
  });
}
