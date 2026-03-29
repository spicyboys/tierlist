"use client";

import { DiscordSDK, patchUrlMappings } from "@discord/embedded-app-sdk";
import { createContext, use } from "react";

const DiscordSDKContext = createContext<DiscordSDK | null>(null);

export function useDiscordSDK() {
  return use(DiscordSDKContext);
}

let sdk: DiscordSDK | null = null;
try {
  sdk = new DiscordSDK(process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID!);
  patchUrlMappings([
    { prefix: "/googleapis/{subdomain}", target: "{subdomain}.googleapis.com" },
  ]);
} catch {
  // Not in a discord environment
}

export default function DiscordSDKProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <DiscordSDKContext.Provider value={sdk}>
      {children}
    </DiscordSDKContext.Provider>
  );
}
