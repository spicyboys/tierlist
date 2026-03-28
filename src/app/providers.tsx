"use client";

import DiscordSDKProvider from "@/components/DiscordSDKProvider";
import AuthProvider from "@/components/AuthProvider";
import { Toaster } from "react-hot-toast";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <DiscordSDKProvider>
      <AuthProvider>
        {children}
        <Toaster position="bottom-right" />
      </AuthProvider>
    </DiscordSDKProvider>
  );
}
