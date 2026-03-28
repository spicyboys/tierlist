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
  moveTierListItem,
  removeTierListItem,
  updatePresence,
  setDragState,
} from "@/lib/firestore";

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

  // Check if the live session exists and get the tierlist ID
  useEffect(() => {
    checkLiveSession(code).then((session) => {
      if (!session) {
        toast.error("Session not found");
        router.push("/");
        return;
      }
      setTierlistId(session.tierlistId);
      setLoading(false);
    });
  }, [code, router]);

  // Subscribe to tier list data
  useEffect(() => {
    if (!tierlistId) return;
    const unsub = subscribeTierList(tierlistId, (tierListData) => {
      if (!tierListData) {
        toast.error("Session ended");
        setEnded(true);
        return;
      }
      // Check if live session was removed
      if (!tierListData.liveSessionId) {
        toast.error("Session ended");
        setEnded(true);
        return;
      }
      if (!isDraggingRef.current) {
        setData(tierListData);
      }
    });
    return unsub;
  }, [tierlistId]);

  // Subscribe to live session users
  useEffect(() => {
    if (!user) return;

    const unsub = subscribeLiveSessionUsers(code, (liveUsers) => {
      setUsers(liveUsers);
      const indicators: DragIndicator[] = [];
      for (const u of liveUsers) {
        if (u.id !== user.id && u.draggingItemId) {
          indicators.push({ itemId: u.draggingItemId, userName: u.username });
        }
      }
      setDragIndicators(indicators);
    });

    // Heartbeat for presence
    updatePresence(code, user.id, user.name);
    presenceRef.current = setInterval(() => {
      updatePresence(code, user.id, user.name);
    }, 5000);

    return () => {
      unsub();
      if (presenceRef.current) {
        clearInterval(presenceRef.current);
        presenceRef.current = null;
      }
    };
  }, [code, user]);

  const handleItemAdded = useCallback(
    async (item: TierItem) => {
      if (ended || !tierlistId) return;
      await addTierListItem(tierlistId, item.title, item.imageUrl);
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
      if (ended || !user) return;
      isDraggingRef.current = !!itemId;
      setDragState(code, user.id, itemId);
    },
    [code, ended, user],
  );

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
      {users.length > 0 && user && (
        <div className="border-b border-gray-800 px-4 py-2 flex items-center gap-2 overflow-x-auto">
          {users.map((u) => (
            <span
              key={u.id}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium flex-shrink-0 ${
                u.id === user.id
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
              {u.username}
              {u.id === user.id && " (you)"}
              {u.draggingItemId && u.id !== user.id && " - moving..."}
            </span>
          ))}
        </div>
      )}

      <main className="max-w-2xl mx-auto px-4 py-24 text-center">
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
      </main>
    </>
  );
}
