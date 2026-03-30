"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  ReactNode,
} from "react";
import { User as FirebaseUser } from "firebase/auth";
import {
  onIdTokenChanged,
  signInWithCustomToken,
  signInWithGoogle,
} from "@/lib/firebase/auth";
import {
  ensureUserDocument,
  getUserDocument,
  updateUserDisplayName,
} from "@/lib/firestore";
import { deleteSessionCookie, setSessionCookie } from "@/lib/session";
import { type DiscordSDK } from "@discord/embedded-app-sdk";
import { useDiscordSDK } from "./DiscordSDKProvider";
import { type UserDoc } from "@/lib/firestore/converters/user";

interface UserContextValue {
  user: UserDoc | null;
  discordAccessToken: string | null;
  setDisplayName: (name: string) => Promise<void>;
  signIn: () => void;
}

const UserContext = createContext<UserContextValue>({
  user: null,
  discordAccessToken: null,
  setDisplayName: async () => {},
  signIn: () => {},
});

export function useUser(): UserDoc | null {
  return useContext(UserContext).user;
}

export function useSetDisplayName(): (name: string) => Promise<void> {
  return useContext(UserContext).setDisplayName;
}

export function useSignIn(): () => void {
  return useContext(UserContext).signIn;
}

export function useDiscordAccessToken(): string | null {
  return useContext(UserContext).discordAccessToken;
}

async function userFromDiscord(discordSdk: DiscordSDK) {
  await discordSdk.ready();
  const { code } = await discordSdk.commands.authorize({
    client_id: process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID!,
    response_type: "code",
    state: "",
    prompt: "none",
    scope: ["identify", "applications.commands", "email"],
  });

  const response = await fetch("/api/auth/discord", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      code,
    }),
  });

  const data = (await response.json()) as {
    customToken: string;
  };

  // Sign in to Firebase Auth with the custom token
  await signInWithCustomToken(data.customToken);
}

export default function AuthProvider({
  initialUser,
  initialDiscordAccessToken,
  children,
}: {
  initialUser: UserDoc | null;
  initialDiscordAccessToken: string | null;
  children: ReactNode;
}) {
  const discordSdk = useDiscordSDK();
  const [user, setUser] = useState(initialUser);
  const [discordAccessToken, setDiscordAccessToken] = useState(
    initialDiscordAccessToken,
  );

  useEffect(() => {
    return onIdTokenChanged(async (firebaseUser: FirebaseUser | null) => {
      if (firebaseUser) {
        const idToken = await firebaseUser.getIdTokenResult();
        await setSessionCookie(idToken.token);

        const discordClaims = idToken.claims.discord as
          | { access_token: string }
          | undefined;

        if (discordClaims && discordSdk) {
          setDiscordAccessToken(discordClaims.access_token);
        }

        // Ensure Firestore user document exists
        await ensureUserDocument(
          firebaseUser.uid,
          firebaseUser.displayName || "",
        );

        // Read the name from Firestore (may be a custom name)
        const userDoc = await getUserDocument(firebaseUser.uid);
        setUser({
          id: firebaseUser.uid,
          name: userDoc?.name || firebaseUser.displayName || "",
          hasCustomName: userDoc?.hasCustomName ?? false,
        });
      } else {
        await deleteSessionCookie();
        setUser(null);
      }
    });
  }, [discordSdk]);

  const discordAuthStarted = useRef(false);
  useEffect(() => {
    if (user !== null) return;
    if (!discordSdk) return;
    if (discordAuthStarted.current) return;

    // Avoid re-entrant calls to this effect
    discordAuthStarted.current = true;

    userFromDiscord(discordSdk);
  }, [discordSdk, user]);

  // Authenticate with the Discord SDK whenever we get a new access token
  useEffect(() => {
    if (!discordSdk) return;
    if (!discordAccessToken) return;

    discordSdk.commands.authenticate({
      access_token: discordAccessToken,
    });
  }, [discordSdk, discordAccessToken]);

  const setDisplayName = useCallback(
    async (name: string) => {
      if (!user) return;
      await updateUserDisplayName(user.id, name);
      setUser((prev) => (prev ? { ...prev, name } : null));
    },
    [user],
  );

  const signIn = useCallback(() => {
    signInWithGoogle();
  }, []);

  return (
    <UserContext.Provider
      value={{ user, setDisplayName, signIn, discordAccessToken }}
    >
      {children}
    </UserContext.Provider>
  );
}
