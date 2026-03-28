"use client";

import { JSX, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  onIdTokenChanged,
  signInWithCustomToken,
  signInWithGoogle,
} from "@/lib/firebase/auth";
import { setCookie, deleteCookie } from "cookies-next";
import { type DiscordSDK } from "@discord/embedded-app-sdk";
import { useDiscordSDK } from "./DiscordSDKProvider";
import { User } from "@/lib/firestore/converters/user";

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
  useEffect(() => {
    return onIdTokenChanged(async (user) => {
      if (user) {
        const idToken = await user.getIdToken();
        await setCookie("__session", idToken);
      } else {
        await deleteCookie("__session");
      }
      if (initialUser?.id === user?.uid) {
        return;
      }
      window.location.reload();
    });
  }, [initialUser]);

  return initialUser;
}

export default function PageHeader({
  initialUser,
}: {
  initialUser: User | null;
}) {
  const user = useUserSession(initialUser);

  const discordSdk = useDiscordSDK();
  useEffect(() => {
    if (user) return;
    if (!discordSdk) return;

    userFromDiscord(discordSdk);
  }, [discordSdk, user]);

  const handleSignIn = useCallback(
    (event: React.MouseEvent<HTMLAnchorElement>) => {
      event.preventDefault();
      signInWithGoogle();
    },
    [],
  );

  const [userInfo, setUserInfo] = useState<JSX.Element | null>(null);
  useEffect(() => {
    if (user) {
      setUserInfo(
        <>
          <span className="text-sm text-gray-400">{user.name}</span>
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
    <nav className="border-b border-gray-800 px-4 py-3 flex items-center justify-between">
      <span className="text-lg font-bold">
        <Link href="/">TierMaker</Link>
      </span>
      <div className="flex items-center gap-3">{userInfo}</div>
    </nav>
  );
}
