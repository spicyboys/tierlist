"use client";

import { DiscordSDK, patchUrlMappings } from "@discord/embedded-app-sdk";
import { createContext, use } from "react";

const DiscordSDKContext = createContext<DiscordSDK | null>(null);

export function useDiscordSDK() {
  return use(DiscordSDKContext);
}

export function useImageProxy() {
  const discordSdk = use(DiscordSDKContext);
  if (!discordSdk) return (url: string | null) => url;
  return (url: string | null) => {
    if (!url) return null;
    return `/api/image-proxy?url=${encodeURIComponent(url)}`;
  };
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
