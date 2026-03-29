import "server-only";

import { cookies } from "next/headers";
import { initializeServerApp, initializeApp } from "firebase/app";

import { getAuth } from "firebase/auth";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import type { UserDoc } from "../firestore/converters/user";

export interface DiscordTokens {
  access_token: string;
  refresh_token: string;
  expiry: number;
}

export async function refreshDiscordTokens(
  uid: string,
  refreshToken: string,
): Promise<DiscordTokens> {
  const response = await fetch("https://discord.com/api/oauth2/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID!,
      client_secret: process.env.DISCORD_CLIENT_SECRET!,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  if (!response.ok) {
    throw new Error(`Discord token refresh failed: ${response.status}`);
  }

  const { access_token, refresh_token, expires_in } =
    (await response.json()) as {
      access_token: string;
      refresh_token: string;
      expires_in: number;
    };

  const expiry = Date.now() + expires_in * 1000;
  const discord: DiscordTokens = { access_token, refresh_token, expiry };

  await adminAuth.setCustomUserClaims(uid, { discord });

  return discord;
}

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Returns an authenticated client SDK instance for use in Server Side Rendering
// and Static Site Generation
export async function getAuthenticatedAppForUser() {
  const authIdToken = (await cookies()).get("__session")?.value;

  const firebaseServerApp = initializeServerApp(
    initializeApp(firebaseConfig),
    {
      authIdToken,
    }
  );

  const auth = getAuth(firebaseServerApp);
  await auth.authStateReady();

  const currentUser = auth.currentUser;

  let user: UserDoc | null = null;

  if (currentUser !== null) {
    const userDoc = await adminDb.doc(`users/${currentUser.uid}`).get();
    if (userDoc.exists) {
      const data = userDoc.data()!;
      user = {
        id: currentUser.uid,
        name: data.name ?? currentUser.displayName ?? currentUser.uid,
        hasCustomName: data.hasCustomName ?? false,
      };
    } else {
      const name = currentUser.displayName || currentUser.uid;
      await adminDb.doc(`users/${currentUser.uid}`).set({
        name,
        hasCustomName: false,
      });
      user = { id: currentUser.uid, name, hasCustomName: false };
    }
  }

  let discordAccessToken: string | null = null;

  if (currentUser) {
    const userRecord = await adminAuth.getUser(currentUser.uid);
    const discordClaims = userRecord.customClaims?.discord as
      | DiscordTokens
      | undefined;

    if (discordClaims) {
      // Refresh if expired or expiring within 5 minutes
      if (discordClaims.expiry < Date.now() + 5 * 60 * 1000) {
        try {
          const refreshed = await refreshDiscordTokens(
            currentUser.uid,
            discordClaims.refresh_token,
          );
          discordAccessToken = refreshed.access_token;
        } catch (e) {
          console.error("Failed to refresh Discord token:", e);
        }
      } else {
        discordAccessToken = discordClaims.access_token;
      }
    }
  }

  return { firebaseServerApp, currentUser: user, discordAccessToken };
}