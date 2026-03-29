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
    await signInWithPopup(auth, provider);
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