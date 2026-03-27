"use client";

import { DiscordSDK } from "@discord/embedded-app-sdk";
import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { User } from "./UserProvider";

interface AuthContextType {
  authState: AuthState;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  authState: { user: null, loading: true, error: null },
  refresh: async () => { },
});

export function useAuth() {
  return useContext(AuthContext);
}

export const discordSdk = new DiscordSDK(process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID!);

async function userFromDiscord(): Promise<User | null> {

  await discordSdk.ready();
  const { code } = await discordSdk.commands.authorize({
    client_id: process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID!,
    response_type: 'code',
    state: '',
    prompt: 'none',
    scope: ['identify', 'applications.commands'],
  });

  // Retrieve an access_token from your application's server
  const response = await fetch('/api/auth/discord', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      code,
    }),
  });

  return await response.json() as User;
}

type AuthState = {
  user: User
  loading: false;
  error: null;
} | {
  user: null;
  loading: true;
  error: null;
} | {
  user: null;
  loading: false;
  error: string;
};


export default function AuthProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    loading: true,
    error: null,
  });

  const refresh = useCallback(async () => {
    try {
      const user = await userFromDiscord();
      if (user) {
        setAuthState({ user, loading: false, error: null });
        return;
      }
    } catch {
      // Ignore errors and just set user to null
    }

    setAuthState({ user: null, loading: false, error: "Failed to fetch user" });
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <AuthContext.Provider value={{ authState, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}
