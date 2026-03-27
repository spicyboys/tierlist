"use client";

import { useAuth } from "@/components/AuthProvider";
import Link from "next/link";
import UserProvider from "@/components/UserProvider";
import Loading from "./loading";

export default function Layout({ children }: { children: React.ReactNode }) {
  const { authState, refresh } = useAuth();
  if (authState.loading) {
    return (
      <Loading />
    );
  } else if (authState.error !== null) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-gray-400">{authState.error}</div>
        <button
          onClick={refresh}
          className="ml-4 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <UserProvider user={authState.user}>
      <div className="min-h-screen bg-gray-950 text-white">
        <nav className="border-b border-gray-800 px-4 py-3 flex items-center justify-between">
          <span className="text-lg font-bold"><Link href="/">TierMaker</Link></span>
          <div className="flex items-center gap-3">
            <>
              <span className="text-sm text-gray-400">{authState.user.username}</span>
              <Link
                href="/dashboard"
                className="text-sm text-gray-400 hover:text-white transition"
              >
                My Tier Lists
              </Link>
            </>
          </div>
        </nav>

        {children}
      </div>
    </UserProvider>
  );
}