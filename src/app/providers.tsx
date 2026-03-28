"use client";

import DiscordSDKProvider from "@/components/DiscordSDKProvider";
import { Toaster } from "react-hot-toast";

export default function Providers({ children }: { children: React.ReactNode }) {
  console.log("Providers rendering");
  return (
    <DiscordSDKProvider>
      {children}
      <Toaster position="bottom-right" />
    </DiscordSDKProvider>
  );
}
