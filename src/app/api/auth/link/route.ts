import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase/admin";

export async function POST(req: NextRequest) {
  const { idToken } = (await req.json()) as { idToken: string };

  const decoded = await adminAuth.verifyIdToken(idToken);
  const currentUser = await adminAuth.getUser(decoded.uid);

  if (!currentUser.email) {
    return NextResponse.json({});
  }

  try {
    const existingUser = await adminAuth.getUserByEmail(currentUser.email);
    if (existingUser.uid !== currentUser.uid) {
      // Another account with the same email exists — use it instead
      await adminAuth.deleteUser(currentUser.uid);
      const customToken = await adminAuth.createCustomToken(existingUser.uid);
      return NextResponse.json({ customToken });
    }
  } catch {
    // No other user with this email
  }

  return NextResponse.json({});
}
