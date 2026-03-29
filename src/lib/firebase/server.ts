import "server-only";

import { cookies } from "next/headers";
import { initializeServerApp, initializeApp } from "firebase/app";

import { getAuth } from "firebase/auth";
import { adminDb } from "@/lib/firebase/admin";
import type { UserDoc } from "../firestore/converters/user";

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

  return { firebaseServerApp, currentUser: user };
}