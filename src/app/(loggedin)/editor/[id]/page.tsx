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
  startVote,
  submitVote,
  resolveVote,
  clearVote,
  subscribeVote,
  setItemLocked,
} from "@/lib/firestore";
import LiveUserBar, { LiveUser } from "@/components/LiveUserBar";
import { VoteState } from "@/lib/types";

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
  const [vote, setVote] = useState<VoteState | null>(null);
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

    const unsubVote = subscribeVote(liveCode, (voteState) => {
      setVote(voteState);
    });

    // Heartbeat for presence
    updatePresence(liveCode, user.id, user.name);
    presenceRef.current = setInterval(() => {
      if (liveCode) updatePresence(liveCode, user.id, user.name);
    }, 5000);

    return () => {
      unsub();
      unsubVote();
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
            message: `Join my live tierlist session and rank **${data?.title}**! Code: ${code}`,
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

  const handleStartVote = useCallback(
    (itemId: string, itemTitle: string) => {
      if (!liveCode) return;
      startVote(liveCode, itemId, itemTitle);
    },
    [liveCode],
  );

  const handleSubmitVote = useCallback(
    (tier: string) => {
      if (!liveCode || !user) return;
      submitVote(liveCode, user.id, tier);
    },
    [liveCode, user],
  );

  const handleResolveVote = useCallback(
    (result: string) => {
      if (!liveCode) return;
      resolveVote(liveCode, result);
    },
    [liveCode],
  );

  const handleClearVote = useCallback(() => {
    if (!liveCode) return;
    clearVote(liveCode);
  }, [liveCode]);

  const handleToggleLockItem = useCallback(
    (itemId: string, locked: boolean) => {
      setItemLocked(id, itemId, locked);
    },
    [id],
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
        <LiveUserBar
          users={liveUsers}
          hostUserId={user.id}
          currentUserId={user.id}
        />
      )}

      <main className="max-w-5xl mx-auto px-4 py-24 text-center">
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
          vote={liveCode ? vote : undefined}
          currentUserId={user?.id}
          totalLiveUsers={liveUsers.length}
          onStartVote={liveCode ? handleStartVote : undefined}
          onSubmitVote={liveCode ? handleSubmitVote : undefined}
          onResolveVote={liveCode ? handleResolveVote : undefined}
          onClearVote={liveCode ? handleClearVote : undefined}
          isHost={true}
          onToggleLockItem={handleToggleLockItem}
        />
      </main>
    </>
  );
}
