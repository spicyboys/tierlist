"use client";

import DiscordSDKProvider from "@/components/DiscordSDKProvider";
import AuthProvider from "@/components/AuthProvider";
import { Toaster } from "react-hot-toast";
import type { UserDoc } from "@/lib/firestore/converters/user";

export default function Providers({
  initialUser,
  initialDiscordAccessToken,
  children,
}: {
  initialUser: UserDoc | null;
  initialDiscordAccessToken: string | null;
  children: React.ReactNode;
}) {
  return (
    <DiscordSDKProvider>
      <AuthProvider
        initialUser={initialUser}
        initialDiscordAccessToken={initialDiscordAccessToken}
      >
        {children}
        <Toaster position="bottom-right" />
      </AuthProvider>
    </DiscordSDKProvider>
  );
}
