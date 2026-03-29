"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  ReactNode,
} from "react";
import { User as FirebaseUser } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import { onAuthStateChanged } from "@/lib/firebase/auth";
import {
  ensureUserDocument,
  getUserDocument,
  updateUserDisplayName,
} from "@/lib/firestore";

interface AppUser {
  id: string;
  name: string;
}

interface UserContextValue {
  user: AppUser | null;
  setDisplayName: (name: string) => Promise<void>;
}

const UserContext = createContext<UserContextValue>({
  user: null,
  setDisplayName: async () => {},
});

export function useUser(): AppUser | null {
  return useContext(UserContext).user;
}

export function useSetDisplayName(): (name: string) => Promise<void> {
  return useContext(UserContext).setDisplayName;
}

export default function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(() => {
    const u = auth.currentUser;
    return u ? { id: u.uid, name: u.displayName || "" } : null;
  });

  useEffect(() => {
    return onAuthStateChanged(async (firebaseUser: FirebaseUser | null) => {
      if (firebaseUser) {
        // Ensure Firestore user document exists
        await ensureUserDocument(
          firebaseUser.uid,
          firebaseUser.displayName || "",
        );

        // Read the name from Firestore (may be a custom name)
        const userDoc = await getUserDocument(firebaseUser.uid);
        const appUser: AppUser = {
          id: firebaseUser.uid,
          name: userDoc?.name || firebaseUser.displayName || "",
        };
        setUser(appUser);
      } else {
        setUser(null);
      }
    });
  }, []);

  const setDisplayName = useCallback(
    async (name: string) => {
      if (!user) return;
      await updateUserDisplayName(user.id, name);
      setUser((prev) => (prev ? { ...prev, name } : null));
    },
    [user],
  );

  return (
    <UserContext.Provider value={{ user, setDisplayName }}>
      {children}
    </UserContext.Provider>
  );
}
