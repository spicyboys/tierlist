"use client";

import { DiscordSDK, patchUrlMappings } from "@discord/embedded-app-sdk";
import { createContext, use } from "react";

const DiscordSDKContext = createContext<DiscordSDK | null>(null);

export function useDiscordSDK() {
  return use(DiscordSDKContext);
}

const ORIGIN_WHITELIST = [
  "https://cdn.discordapp.com",
  "https://upload.wikimedia.org",
];

export function useImageProxy(): (url: string) => string {
  const discordSdk = use(DiscordSDKContext);

  if (!discordSdk) return (url: string) => url;

  return (url: string) => {
    if (ORIGIN_WHITELIST.includes(new URL(url).origin)) {
      return url; // Don't proxy if in whitelist
    }
    return `/api/image-proxy?url=${encodeURIComponent(url)}`;
  };
}

let sdk: DiscordSDK | null = null;
try {
  sdk = new DiscordSDK(process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID!);
  patchUrlMappings(
    [
      {
        prefix: "/googleapis/{subdomain}",
        target: "{subdomain}.googleapis.com",
      },
      { prefix: "/wikimedia", target: "upload.wikimedia.org" },
    ],
    { patchSrcAttributes: true },
  );
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
