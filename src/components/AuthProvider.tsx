"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { User as FirebaseUser } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import { onAuthStateChanged } from "@/lib/firebase/auth";
import { ensureUserDocument } from "@/lib/firestore";

interface AppUser {
  id: string;
  name: string;
}

const UserContext = createContext<AppUser | null>(null);

export function useUser(): AppUser | null {
  return useContext(UserContext);
}

export default function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(() => {
    const u = auth.currentUser;
    return u ? { id: u.uid, name: u.displayName || "" } : null;
  });

  useEffect(() => {
    return onAuthStateChanged(async (firebaseUser: FirebaseUser | null) => {
      if (firebaseUser) {
        const appUser: AppUser = {
          id: firebaseUser.uid,
          name: firebaseUser.displayName || "",
        };
        setUser(appUser);

        // Ensure Firestore user document exists
        await ensureUserDocument(
          firebaseUser.uid,
          firebaseUser.displayName || "",
        );
      } else {
        setUser(null);
      }
    });
  }, []);

  return <UserContext.Provider value={user}>{children}</UserContext.Provider>;
}
