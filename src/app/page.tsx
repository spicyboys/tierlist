"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";
import { useAuth } from "@/components/AuthProvider";

export default function HomePage() {
  const router = useRouter();
  const { user, loading: authLoading, logout } = useAuth();
  const [sessionCode, setSessionCode] = useState("");

  const handleJoinSession = async () => {
    const code = sessionCode.trim().toUpperCase();
    if (!code) return;

    const res = await fetch(`/api/live/${code}`);
    if (res.ok) {
      router.push(`/live/${code}`);
    } else {
      toast.error("Session not found or has ended");
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <nav className="border-b border-gray-800 px-4 py-3 flex items-center justify-between">
        <span className="text-lg font-bold">TierMaker</span>
        <div className="flex items-center gap-3">
          {authLoading ? null : user ? (
            <>
              <span className="text-sm text-gray-400">{user.name}</span>
              <Link
                href="/dashboard"
                className="text-sm text-gray-400 hover:text-white transition"
              >
                My Tier Lists
              </Link>
              <button
                onClick={logout}
                className="text-sm text-gray-500 hover:text-white transition"
              >
                Log Out
              </button>
            </>
          ) : (
            <>
              <Link
                href="/auth/login"
                className="text-sm text-gray-400 hover:text-white transition"
              >
                Log In
              </Link>
              <Link
                href="/auth/register"
                className="text-sm bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg transition"
              >
                Sign Up
              </Link>
            </>
          )}
        </div>
      </nav>

      <main className="max-w-2xl mx-auto px-4 py-24 text-center">
        <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
          Create Tier Lists
        </h1>
        <p className="text-gray-400 text-lg mb-10">
          Rank anything. Drag and drop items into tiers, search for images, and
          collaborate in real-time.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
          <Link
            href={user ? "/editor/new" : "/auth/register"}
            className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-3 rounded-xl text-lg font-medium transition shadow-lg shadow-blue-600/20"
          >
            Create Tier List
          </Link>
          {user && (
            <Link
              href="/dashboard"
              className="bg-gray-800 hover:bg-gray-700 text-white px-8 py-3 rounded-xl text-lg font-medium transition"
            >
              My Tier Lists
            </Link>
          )}
        </div>

        <div className="bg-gray-900 rounded-xl p-6 max-w-sm mx-auto">
          <h2 className="text-sm font-medium text-gray-400 mb-3">
            Join a Live Session
          </h2>
          <div className="flex gap-2">
            <input
              type="text"
              value={sessionCode}
              onChange={(e) => setSessionCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === "Enter" && handleJoinSession()}
              placeholder="Enter code"
              maxLength={6}
              className="flex-1 bg-gray-800 text-white px-4 py-2 rounded-lg border border-gray-700 focus:border-blue-500 outline-none text-center font-mono tracking-widest uppercase"
            />
            <button
              onClick={handleJoinSession}
              disabled={!sessionCode.trim()}
              className="bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white px-4 py-2 rounded-lg font-medium transition"
            >
              Join
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
