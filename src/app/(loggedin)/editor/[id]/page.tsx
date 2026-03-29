"use client";

import { useEffect, useState, useRef, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import TierListEditor, { DragIndicator } from "@/components/TierListEditor";
import { TierListData } from "@/lib/types";
import toast from "react-hot-toast";
import { useDiscordSDK } from "@/components/DiscordSDKProvider";
import { useUser } from "@/components/AuthProvider";
import {
  subscribeTierList,
  saveTierList,
  createLiveSession,
  endLiveSession,
  addTierListItem,
  moveTierListItem,
  removeTierListItem,
  subscribeLiveSessionUsers,
  updatePresence,
  setDragState,
} from "@/lib/firestore";

interface LiveUser {
  id: string;
  username: string;
  draggingItemId?: string | null;
}

function LiveUserBar({
  users,
  hostUserId,
}: {
  users: LiveUser[];
  hostUserId: string;
}) {
  return (
    <div className="border-b border-gray-800 px-4 py-2 flex items-center gap-2 overflow-x-auto">
      {users.map((u) => {
        return (
          <span
            key={u.id}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium flex-shrink-0 ${
              u.id === hostUserId
                ? "bg-purple-900/50 text-purple-300 ring-1 ring-purple-500/30"
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
            {u.id === hostUserId && " (host)"}
            {u.draggingItemId && u.id !== hostUserId && " - moving..."}
          </span>
        );
      })}
    </div>
  );
}

export default function EditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const user = useUser();
  const discordSdk = useDiscordSDK();
  const [data, setData] = useState<TierListData>();
  const [liveCode, setLiveCode] = useState<string | null>(null);
  const [liveUsers, setLiveUsers] = useState<LiveUser[]>([]);
  const [dragIndicators, setDragIndicators] = useState<DragIndicator[]>([]);
  const isDraggingRef = useRef(false);
  const presenceRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Subscribe to Firestore tier list (real-time updates)
  useEffect(() => {
    const unsub = subscribeTierList(id, (tierListData) => {
      if (!tierListData) {
        toast.error("Tier list not found");
        router.push("/");
        return;
      }
      // Don't overwrite local state while user is dragging
      if (!isDraggingRef.current) {
        setData(tierListData);
      }
      setLiveCode(tierListData.liveSessionId);
    });
    return unsub;
  }, [id, router]);

  // Auth check
  useEffect(() => {
    if (data && user && data.ownerId !== user.id) {
      toast.error("You don't have permission to edit this tier list");
      router.push("/");
    }
  }, [data, user, router]);

  // Subscribe to live session users when live
  useEffect(() => {
    if (!liveCode || !user) return;

    const unsub = subscribeLiveSessionUsers(liveCode, (users) => {
      setLiveUsers(users);
      const indicators: DragIndicator[] = [];
      for (const u of users) {
        if (u.id !== user.id && u.draggingItemId) {
          indicators.push({ itemId: u.draggingItemId, userName: u.username });
        }
      }
      setDragIndicators(indicators);
    });

    // Heartbeat for presence
    updatePresence(liveCode, user.id, user.name);
    presenceRef.current = setInterval(() => {
      if (liveCode) updatePresence(liveCode, user.id, user.name);
    }, 5000);

    return () => {
      unsub();
      if (presenceRef.current) {
        clearInterval(presenceRef.current);
        presenceRef.current = null;
      }
    };
  }, [liveCode, user]);

  const handleSave = async (saveData: TierListData) => {
    if (!user) return;
    await saveTierList(id, {
      title: saveData.title,
      tiers: saveData.tiers,
      unsortedItems: saveData.unsortedItems,
    });
  };

  const handleStartLive = async () => {
    try {
      const code = await createLiveSession(id, discordSdk?.guildId ?? null);
      setLiveCode(code);
      toast.success(`Live session started! Code: ${code}`);

      if (discordSdk) {
        try {
          await discordSdk.commands.shareLink({
            message: `Join my live tierlist session! Code: ${code}`,
            custom_id: `live_session_${code}`,
          });
        } catch (e) {
          console.error("Failed to share live session link on Discord:", e);
        }
      }
    } catch {
      toast.error("Failed to start live session");
    }
  };

  const handleEndLive = async () => {
    if (liveCode) {
      await endLiveSession(liveCode, id);
    }
    setLiveCode(null);
    toast.success("Live session ended");
  };

  const handleLiveItemAdded = useCallback(
    async (item: { title: string; imageUrl: string | null }) => {
      if (!liveCode) return;
      await addTierListItem(id, item.title, item.imageUrl);
    },
    [liveCode, id],
  );

  const handleLiveItemMoved = useCallback(
    async (itemId: string, targetTierId: string | null, newOrder: number) => {
      if (!liveCode) return;
      isDraggingRef.current = true;
      try {
        await moveTierListItem(id, itemId, targetTierId, newOrder);
      } finally {
        isDraggingRef.current = false;
      }
    },
    [liveCode, id],
  );

  const handleLiveItemRemoved = useCallback(
    async (itemId: string) => {
      if (!liveCode) return;
      await removeTierListItem(id, itemId);
    },
    [liveCode, id],
  );

  const handleLiveDragBroadcast = useCallback(
    (itemId: string | null) => {
      if (!liveCode || !user) return;
      setDragState(liveCode, user.id, itemId);
      isDraggingRef.current = !!itemId;
    },
    [liveCode, user],
  );

  if (!data) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-gray-400">Loading...</div>
      </div>
    );
  }

  return (
    <>
      {liveCode && liveUsers.length > 0 && user && (
        <LiveUserBar users={liveUsers} hostUserId={user.id} />
      )}

      <main className="max-w-2xl mx-auto px-4 py-24 text-center">
        <TierListEditor
          initialData={data}
          onSave={handleSave}
          canSave={true}
          onStartLive={handleStartLive}
          liveSessionCode={liveCode}
          onEndLive={handleEndLive}
          onItemMoved={liveCode ? handleLiveItemMoved : undefined}
          onItemAdded={liveCode ? handleLiveItemAdded : undefined}
          onItemRemoved={liveCode ? handleLiveItemRemoved : undefined}
          onDragBroadcast={liveCode ? handleLiveDragBroadcast : undefined}
          dragIndicators={liveCode ? dragIndicators : undefined}
        />
      </main>
    </>
  );
}
