"use client";

import { useEffect, useState, useCallback, useRef, use } from "react";
import { useRouter } from "next/navigation";
import TierListEditor, { DragIndicator } from "@/components/TierListEditor";
import { TierListData, TierItem } from "@/lib/types";
import toast from "react-hot-toast";
import Link from "next/link";
import { useUser } from "@/components/AuthProvider";
import {
  checkLiveSession,
  subscribeTierList,
  subscribeLiveSessionUsers,
  addTierListItem,
  editTierListItem,
  moveTierListItem,
  removeTierListItem,
  updatePresence,
  setDragState,
} from "@/lib/firestore";
import { customAlphabet } from "nanoid";
import LiveUserBar from "@/components/LiveUserBar";
import { useDiscordSDK } from "@/components/DiscordSDKProvider";

const generateGuestId = customAlphabet(
  "abcdefghijklmnopqrstuvwxyz0123456789",
  16,
);

interface LiveUser {
  id: string;
  username: string;
  draggingItemId?: string | null;
}

export default function LiveSessionPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code: rawCode } = use(params);
  const code = rawCode.toUpperCase();
  const router = useRouter();
  const user = useUser();
  const [data, setData] = useState<TierListData | null>(null);
  const [tierlistId, setTierlistId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [ended, setEnded] = useState(false);
  const [users, setUsers] = useState<LiveUser[]>([]);
  const [dragIndicators, setDragIndicators] = useState<DragIndicator[]>([]);
  const isDraggingRef = useRef(false);
  const presenceRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Guest join state
  const [userName, setUserName] = useState("");
  const [joined, setJoined] = useState(false);
  const guestIdRef = useRef<string | null>(null);

  // Auto-join if logged in
  useEffect(() => {
    if (user) {
      setJoined(true);
    }
  }, [user]);

  // Effective identity: logged-in user or guest
  const effectiveId = user?.id ?? guestIdRef.current;
  const effectiveName = user?.name ?? userName;

  // Lazily create a stable guest ID when joining without auth
  const getEffectiveId = useCallback((): string => {
    if (user) return user.id;
    if (!guestIdRef.current) {
      guestIdRef.current = `guest_${generateGuestId()}`;
    }
    return guestIdRef.current;
  }, [user]);

  // Check if the live session exists and get the tierlist ID
  useEffect(() => {
    checkLiveSession(code).then((session) => {
      if (!session) {
        toast.error("Session not found");
        router.push("/");
        return;
      }
      setTierlistId(session.tierlistId);
      if (!session.active) {
        setEnded(true);
      }
      setLoading(false);
    });
  }, [code, router]);

  // Subscribe to tier list data
  useEffect(() => {
    if (!tierlistId) return;
    const unsub = subscribeTierList(tierlistId, (tierListData) => {
      if (!tierListData) {
        return;
      }
      // Check if live session became inactive
      if (tierListData.liveSession && !tierListData.liveSession.active) {
        setEnded(true);
      }
      if (!isDraggingRef.current) {
        setData(tierListData);
      }
    });
    return unsub;
  }, [tierlistId]);

  // Subscribe to live session users
  useEffect(() => {
    if (!joined || !tierlistId || ended) return;

    const id = getEffectiveId();
    const name = effectiveName;

    const unsub = subscribeLiveSessionUsers(tierlistId, (liveUsers) => {
      setUsers(liveUsers);
      const indicators: DragIndicator[] = [];
      for (const u of liveUsers) {
        if (u.id !== id && u.draggingItemId) {
          indicators.push({ itemId: u.draggingItemId, userName: u.username });
        }
      }
      setDragIndicators(indicators);
    });

    // Heartbeat for presence
    updatePresence(tierlistId, id, name);
    presenceRef.current = setInterval(() => {
      updatePresence(tierlistId, id, name);
    }, 30 * 1000);

    return () => {
      unsub();
      if (presenceRef.current) {
        clearInterval(presenceRef.current);
        presenceRef.current = null;
      }
    };
  }, [tierlistId, joined, ended, effectiveName, getEffectiveId]);

  const handleItemAdded = useCallback(
    async (item: TierItem) => {
      if (ended || !tierlistId) return;
      await addTierListItem(tierlistId, item.title, item.imageUrl);
    },
    [tierlistId, ended],
  );

  const handleItemEdited = useCallback(
    async (item: TierItem) => {
      if (ended || !tierlistId) return;
      await editTierListItem(tierlistId, item.id, item.title, item.imageUrl);
    },
    [tierlistId, ended],
  );

  const handleItemMoved = useCallback(
    async (itemId: string, targetTierId: string | null, newOrder: number) => {
      if (ended || !tierlistId) return;
      isDraggingRef.current = true;
      try {
        await moveTierListItem(tierlistId, itemId, targetTierId, newOrder);
      } finally {
        isDraggingRef.current = false;
      }
    },
    [tierlistId, ended],
  );

  const handleItemRemoved = useCallback(
    async (itemId: string) => {
      if (ended || !tierlistId) return;
      await removeTierListItem(tierlistId, itemId);
    },
    [tierlistId, ended],
  );

  const handleDragBroadcast = useCallback(
    (itemId: string | null) => {
      if (ended || !joined || !tierlistId) return;
      isDraggingRef.current = !!itemId;
      setDragState(tierlistId, getEffectiveId(), itemId);
    },
    [tierlistId, ended, joined, getEffectiveId],
  );

  const discordSdk = useDiscordSDK();
  useEffect(() => {
    if (!discordSdk) return;
    if (!data) return;

    discordSdk.commands.setActivity({
      activity: {
        type: 4,
        state: "Ranking",
        details: data.title,
      },
    });
  }, [discordSdk, data]);

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
                    sessionStorage.setItem(
                      `viewer_name_${code}`,
                      userName.trim(),
                    );
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

  if (ended && data) {
    return (
      <main className="max-w-5xl mx-auto px-4 py-24 text-center">
        <div className="mb-6 bg-gray-900 rounded-lg p-4 flex items-center justify-between">
          <div>
            <span className="text-yellow-400 font-medium">Session Ended</span>
            <span className="text-gray-500 ml-2 text-sm">
              This session is no longer active.
            </span>
          </div>
          <Link
            href="/"
            className="bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-lg text-sm transition"
          >
            Go Home
          </Link>
        </div>
        <TierListEditor
          initialData={data}
          canEditTiers={false}
          isOwner={false}
          readOnly
        />
      </main>
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
    <>
      {users.length > 0 && effectiveId && (
        <LiveUserBar
          users={users}
          hostUserId={data.ownerId || null}
          currentUserId={effectiveId}
        />
      )}

      <main className="max-w-5xl mx-auto px-4 py-24 text-center">
        <TierListEditor
          initialData={data}
          canEditTiers={false}
          isOwner={false}
          onItemAdded={handleItemAdded}
          onItemEdited={handleItemEdited}
          onItemMoved={handleItemMoved}
          onItemRemoved={handleItemRemoved}
          onDragBroadcast={handleDragBroadcast}
          dragIndicators={dragIndicators}
        />
      </main>
    </>
  );
}
