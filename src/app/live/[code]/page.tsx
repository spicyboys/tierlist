"use client";

export const runtime = "edge";

import { useEffect, useState, useCallback, useRef, use } from "react";
import { useRouter } from "next/navigation";
import TierListEditor, { DragIndicator } from "@/components/TierListEditor";
import { TierListData, TierItem } from "@/lib/types";
import toast from "react-hot-toast";
import Link from "next/link";
import { customAlphabet } from "nanoid";

const generateUserId = customAlphabet(
  "abcdefghijklmnopqrstuvwxyz0123456789",
  16
);

// Persist viewer userId so presence survives reloads
function getOrCreateViewerId(code: string): string {
  if (typeof window === "undefined") return generateUserId();
  const key = `viewer_uid_${code}`;
  const stored = sessionStorage.getItem(key);
  if (stored) return stored;
  const id = generateUserId();
  sessionStorage.setItem(key, id);
  return id;
}

interface LiveUser {
  id: string;
  name: string;
  draggingItemId?: string | null;
}

function parseTierList(data: Record<string, unknown>): TierListData {
  const tl = data as {
    id: string;
    title: string;
    tiers: Array<{
      id: string;
      label: string;
      color: string;
      order: number;
      items: Array<{
        id: string;
        title: string;
        imageUrl: string | null;
        order: number;
      }>;
    }>;
    items: Array<{
      id: string;
      title: string;
      imageUrl: string | null;
      order: number;
    }>;
  };
  return {
    id: tl.id,
    title: tl.title,
    tiers: tl.tiers.map((t) => ({
      id: t.id,
      label: t.label,
      color: t.color,
      order: t.order,
      items: t.items.map((i) => ({
        id: i.id,
        title: i.title,
        imageUrl: i.imageUrl,
        order: i.order,
      })),
    })),
    unsortedItems: (tl.items || []).map((i) => ({
      id: i.id,
      title: i.title,
      imageUrl: i.imageUrl,
      order: i.order,
    })),
  };
}

function fingerprint(d: TierListData): string {
  const tierIds = d.tiers.map(
    (t) => `${t.id}:${t.items.map((i) => i.id).join(",")}`
  );
  const unsorted = d.unsortedItems.map((i) => i.id).join(",");
  return `${d.title}|${tierIds.join(";")}|${unsorted}`;
}

export default function LiveSessionPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code: rawCode } = use(params);
  const code = rawCode.toUpperCase();
  const router = useRouter();
  const [data, setData] = useState<TierListData | null>(null);
  const [loading, setLoading] = useState(true);
  const [ended, setEnded] = useState(false);
  const [userName, setUserName] = useState(() => {
    if (typeof window === "undefined") return "";
    return sessionStorage.getItem(`viewer_name_${code}`) || "";
  });
  const [joined, setJoined] = useState(false);
  const [userId] = useState(() => getOrCreateViewerId(code));
  const [users, setUsers] = useState<LiveUser[]>([]);
  const [dragIndicators, setDragIndicators] = useState<DragIndicator[]>([]);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastFingerprintRef = useRef<string>("");
  const userNameRef = useRef("");
  const isDraggingRef = useRef(false);

  useEffect(() => {
    userNameRef.current = userName;
  }, [userName]);

  const pollState = useCallback(async () => {
    try {
      const p = new URLSearchParams();
      if (userNameRef.current) {
        p.set("userId", userId);
        p.set("userName", userNameRef.current);
      }
      const res = await fetch(`/api/live/${code}/state?${p.toString()}`);
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          ended?: boolean;
        };
        if (body.ended) {
          setEnded(true);
          if (pollRef.current) clearInterval(pollRef.current);
          return;
        }
        return;
      }
      const state = (await res.json()) as Record<string, unknown> & {
        active?: boolean;
        users?: LiveUser[];
      };
      if (!state.active) {
        setEnded(true);
        if (pollRef.current) clearInterval(pollRef.current);
        return;
      }

      // Always update users and drag indicators
      if (state.users) {
        setUsers(state.users);
        const indicators: DragIndicator[] = [];
        for (const u of state.users) {
          if (u.id !== userId && u.draggingItemId) {
            indicators.push({ itemId: u.draggingItemId, userName: u.name });
          }
        }
        setDragIndicators(indicators);
      }

      // Only update tier list data if changed and not dragging
      if (state.id && !isDraggingRef.current) {
        const parsed = parseTierList(state as Record<string, unknown>);
        const fp = fingerprint(parsed);
        if (fp !== lastFingerprintRef.current) {
          lastFingerprintRef.current = fp;
          setData(parsed);
        }
      }
    } catch {
      // Network error, keep polling
    }
  }, [code, userId]);

  useEffect(() => {
    if (!joined) return;

    fetch(`/api/live/${code}`)
      .then((res) => {
        if (!res.ok) throw new Error("Session not found");
        return res.json() as Promise<unknown>;
      })
      .then(() => pollState())
      .then(() => {
        setLoading(false);
        toast.success("Joined live session!");
        pollRef.current = setInterval(pollState, 1000);
      })
      .catch(() => {
        toast.error("Session not found");
        router.push("/");
      });

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [code, router, pollState, joined]);

  const handleItemAdded = useCallback(
    async (item: TierItem) => {
      await fetch(`/api/live/${code}/add-item`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: item.title, imageUrl: item.imageUrl }),
      });
      await pollState();
    },
    [code, pollState]
  );

  const handleItemMoved = useCallback(
    async (itemId: string, targetTierId: string | null, newOrder: number) => {
      await fetch(`/api/live/${code}/move-item`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemId,
          tierId: targetTierId,
          order: newOrder,
        }),
      });
      await pollState();
    },
    [code, pollState]
  );

  const handleItemRemoved = useCallback(
    async (itemId: string) => {
      await fetch(`/api/live/${code}/remove-item`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId }),
      });
      await pollState();
    },
    [code, pollState]
  );

  const handleDragBroadcast = useCallback(
    (itemId: string | null) => {
      if (itemId) {
        isDraggingRef.current = true;
      } else {
        isDraggingRef.current = false;
      }
      fetch(`/api/live/${code}/drag`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, itemId }),
      });
    },
    [code, userId]
  );

  // Name entry screen
  if (!joined) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center text-white">
        <div className="max-w-sm w-full mx-4">
          <div className="bg-gray-900 rounded-xl p-6">
            <h1 className="text-xl font-bold mb-1 text-center">
              Join Live Session
            </h1>
            <p className="text-gray-400 text-sm text-center mb-5">
              Code: <span className="font-mono text-green-400">{code}</span>
            </p>
            <div className="mb-4">
              <label className="block text-sm text-gray-400 mb-1">
                Your Name
              </label>
              <input
                type="text"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && userName.trim()) {
                    sessionStorage.setItem(`viewer_name_${code}`, userName.trim());
                    setJoined(true);
                  }
                }}
                placeholder="Enter your name"
                autoFocus
                className="w-full bg-gray-800 text-white px-4 py-2 rounded-lg border border-gray-700 focus:border-blue-500 outline-none"
              />
            </div>
            <button
              onClick={() => {
                if (!userName.trim()) {
                  toast.error("Please enter your name");
                  return;
                }
                sessionStorage.setItem(`viewer_name_${code}`, userName.trim());
                setJoined(true);
              }}
              disabled={!userName.trim()}
              className="w-full bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white px-4 py-3 rounded-lg font-medium transition"
            >
              Join Session
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (ended) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center text-white">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Session Ended</h1>
          <p className="text-gray-400 mb-6">
            The owner has ended this live session.
          </p>
          <Link
            href="/"
            className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded-lg transition"
          >
            Go Home
          </Link>
        </div>
      </div>
    );
  }

  if (loading || !data) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-gray-400">Joining session...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <nav className="border-b border-gray-800 px-4 py-3 flex items-center justify-between gap-2">
        <Link href="/" className="text-lg font-bold text-white flex-shrink-0">
          TierMaker
        </Link>
        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-sm text-gray-400">
              {users.length} online
            </span>
          </div>
          <span className="bg-green-900/50 text-green-400 px-3 py-1 rounded-lg text-sm font-mono">
            {code}
          </span>
        </div>
      </nav>

      {/* User list bar */}
      {users.length > 0 && (
        <div className="border-b border-gray-800 px-4 py-2 flex items-center gap-2 overflow-x-auto">
          {users.map((u) => (
            <span
              key={u.id}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium flex-shrink-0 ${
                u.id === userId
                  ? "bg-blue-900/50 text-blue-300 ring-1 ring-blue-500/30"
                  : u.draggingItemId
                    ? "bg-yellow-900/50 text-yellow-300 ring-1 ring-yellow-500/30"
                    : "bg-gray-800 text-gray-300"
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  u.draggingItemId ? "bg-yellow-400" : "bg-green-400"
                }`}
              />
              {u.name}
              {u.id === userId && " (you)"}
              {u.draggingItemId && u.id !== userId && " - moving..."}
            </span>
          ))}
        </div>
      )}

      <TierListEditor
        initialData={data}
        canEditTiers={false}
        canSave={false}
        onItemAdded={handleItemAdded}
        onItemMoved={handleItemMoved}
        onItemRemoved={handleItemRemoved}
        onDragBroadcast={handleDragBroadcast}
        dragIndicators={dragIndicators}
      />
    </div>
  );
}
