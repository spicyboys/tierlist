import {
  onAuthStateChanged as _onAuthStateChanged,
  onIdTokenChanged as _onIdTokenChanged,
  GoogleAuthProvider,
  NextOrObserver,
  signInWithPopup,
  signInWithCustomToken as _signInWithCustomToken,
  User,
} from "firebase/auth";

import { auth } from "@/lib/firebase/client";

export function onAuthStateChanged(cb: NextOrObserver<User>) {
  return _onAuthStateChanged(auth, cb);
}

export function onIdTokenChanged(cb: NextOrObserver<User>) {
  return _onIdTokenChanged(auth, cb);
}

export async function signInWithGoogle() {
  const provider = new GoogleAuthProvider();

  try {
    const result = await signInWithPopup(auth, provider);
    const idToken = await result.user.getIdToken();

    // Check if another account with the same email exists and link them
    const response = await fetch("/api/auth/link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken }),
    });

    const data = (await response.json()) as { customToken?: string };
    if (data.customToken) {
      // Sign in as the existing account instead
      await _signInWithCustomToken(auth, data.customToken);
    }
  } catch (error) {
    console.error("Error signing in with Google", error);
  }
}

export async function signInWithCustomToken(customToken: string) {
  try {
    await _signInWithCustomToken(auth, customToken);
  } catch (error) {
    console.error("Error signing in with custom token", error);
  }
}