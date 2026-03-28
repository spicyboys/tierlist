"use client";

import { DiscordSDK } from "@discord/embedded-app-sdk";
import { createContext, use } from "react";

const DiscordSDKContext = createContext<DiscordSDK | null>(null);

export function useDiscordSDK() {
  return use(DiscordSDKContext);
}

export default function DiscordSDKProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  console.log("DiscordSDKProvider rendering");
  let sdk;
  try {
    sdk = new DiscordSDK(process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID!);
  } catch {
    sdk = null;
  }

  return (
    <DiscordSDKContext.Provider value={sdk}>
      {children}
    </DiscordSDKContext.Provider>
  );
}
