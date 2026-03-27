"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";
import { discordSdk } from "@/components/AuthProvider";

export default function HomePage() {
  console.log("Rendering HomePage");
  const router = useRouter();
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
          href="/editor/new"
          className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-3 rounded-xl text-lg font-medium transition shadow-lg shadow-blue-600/20"
        >
          Create Tier List
        </Link>
        <Link
          href="/dashboard"
          className="bg-gray-800 hover:bg-gray-700 text-white px-8 py-3 rounded-xl text-lg font-medium transition"
        >
          My Tier Lists
        </Link>
      </div>

      <GuildLiveSessions />

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
  );
}

function GuildLiveSessions() {
  const [sessions, setSessions] = useState<Array<{ code: string; title: string }>>([]);
  useEffect(() => {
    async function fetchSessions() {
      if (!discordSdk.guildId) return;
      const res = await fetch(`/api/live/active?guildId=${discordSdk.guildId}`);
      if (res.ok) {
        const data = await res.json() as Array<{ code: string; title: string }>;
        setSessions(data);
      }
    }
    fetchSessions();
  }, []);

  if (sessions.length === 0) return null;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h2 className="text-xl font-bold mb-4">Active Sessions in Your Guild</h2>
      <div className="space-y-3">
        {sessions.map((s) => (
          <Link
            key={s.code}
            href={`/live/${s.code}`}
            className="block bg-gray-800 hover:bg-gray-700 rounded-lg p-4 transition"
          >
            <h3 className="text-lg font-medium">{s.title}</h3>
            <p className="text-sm text-gray-400">Code: {s.code}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}