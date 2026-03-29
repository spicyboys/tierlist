"use client";

import { JSX, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useUser, useSetDisplayName, useSignIn } from "./AuthProvider";
import { useDiscordSDK } from "./DiscordSDKProvider";
import DisplayNameModal from "./DisplayNameModal";

export default function PageHeader() {
  const user = useUser();
  const setDisplayName = useSetDisplayName();
  const signIn = useSignIn();
  const discordSdk = useDiscordSDK();
  const [showNameModal, setShowNameModal] = useState(false);

  const handleSignIn = useCallback(
    (event: React.MouseEvent<HTMLAnchorElement>) => {
      event.preventDefault();
      signIn();
    },
    [signIn],
  );

  const handleNameSave = useCallback(
    async (newName: string) => {
      await setDisplayName(newName);
      setShowNameModal(false);
    },
    [setDisplayName],
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
