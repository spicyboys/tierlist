"use client";

import { JSX, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  onIdTokenChanged,
  signInWithCustomToken,
  signInWithGoogle,
} from "@/lib/firebase/auth";
import { type DiscordSDK } from "@discord/embedded-app-sdk";
import { useDiscordSDK } from "./DiscordSDKProvider";
import { deleteSessionCookie, setSessionCookie } from "@/lib/session";
import { getUserDocument, updateUserDisplayName } from "@/lib/firestore";
import DisplayNameModal from "./DisplayNameModal";

interface User {
  id: string;
  name: string;
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

  const data = (await response.json()) as { customToken: string };

  // Sign in to Firebase Auth with the custom token
  await signInWithCustomToken(data.customToken);
}

function useUserSession(initialUser: User | null) {
  const [user, setUser] = useState<User | null>(initialUser);

  useEffect(() => {
    return onIdTokenChanged(async (firebaseUser) => {
      if (firebaseUser) {
        const idToken = await firebaseUser.getIdToken();
        await setSessionCookie(idToken);

        // Read name from Firestore (may be a custom name)
        const userDoc = await getUserDocument(firebaseUser.uid);
        setUser({
          id: firebaseUser.uid,
          name: userDoc?.name || firebaseUser.displayName || "",
        });
      } else {
        await deleteSessionCookie();
        setUser(null);
      }
    });
  }, []);

  return [user, setUser] as const;
}

export default function PageHeader({
  initialUser,
}: {
  initialUser: User | null;
}) {
  const [user, setUser] = useUserSession(initialUser);
  const [showNameModal, setShowNameModal] = useState(false);

  const discordSdk = useDiscordSDK();
  const discordAuthStarted = useRef(false);
  useEffect(() => {
    if (user !== null) return;
    if (!discordSdk) return;
    if (discordAuthStarted.current) return;
    discordAuthStarted.current = true;
    userFromDiscord(discordSdk);
  }, [discordSdk, user]);

  const handleSignIn = useCallback(
    (event: React.MouseEvent<HTMLAnchorElement>) => {
      event.preventDefault();
      signInWithGoogle();
    },
    [],
  );

  const handleNameSave = useCallback(
    async (newName: string) => {
      if (!user) return;
      await updateUserDisplayName(user.id, newName);
      setUser({ ...user, name: newName });
      setShowNameModal(false);
    },
    [user, setUser],
  );

  const [userInfo, setUserInfo] = useState<JSX.Element | null>(null);
  useEffect(() => {
    if (user) {
      setUserInfo(
        <>
          <button
            onClick={() => setShowNameModal(true)}
            className="text-sm text-gray-400 hover:text-white transition cursor-pointer"
            title="Change display name"
          >
            {user.name}
          </button>
          <Link
            href="/dashboard"
            className="text-sm text-gray-400 hover:text-white transition"
          >
            My Tier Lists
          </Link>
        </>,
      );
    } else if (discordSdk === null) {
      setUserInfo(
        <a href="#" onClick={handleSignIn}>
          Sign In with Google
        </a>,
      );
    }
  }, [user, discordSdk, handleSignIn]);

  return (
    <>
      <nav className="border-b border-gray-800 px-4 py-3 flex items-center justify-between">
        <span className="text-lg font-bold">
          <Link href="/">TierMaker</Link>
        </span>
        <div className="flex items-center gap-3">{userInfo}</div>
      </nav>
      {showNameModal && user && (
        <DisplayNameModal
          currentName={user.name}
          onSave={handleNameSave}
          onClose={() => setShowNameModal(false)}
        />
      )}
    </>
  );
}
