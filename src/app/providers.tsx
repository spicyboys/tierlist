"use client";

import DiscordSDKProvider from "@/components/DiscordSDKProvider";
import AuthProvider from "@/components/AuthProvider";
import { Toaster } from "react-hot-toast";
import type { UserDoc } from "@/lib/firestore/converters/user";

export default function Providers({
  initialUser,
  children,
}: {
  initialUser: UserDoc | null;
  children: React.ReactNode;
}) {
  return (
    <DiscordSDKProvider>
      <AuthProvider initialUser={initialUser}>
        {children}
        <Toaster position="bottom-right" />
      </AuthProvider>
    </DiscordSDKProvider>
  );
}
