"use client";

import { useEffect, useState, useRef, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import TierListEditor, { DragIndicator } from "@/components/TierListEditor";
import { TierListData } from "@/lib/types";
import toast from "react-hot-toast";
import { discordSdk } from "@/components/AuthProvider";
import { useUser } from "@/components/UserProvider";

interface LiveUser {
  id: string;
  username: string;
  draggingItemId?: string | null;
}

function parseTierList(tierList: Record<string, unknown>): TierListData {
  const tl = tierList as {
    id: string;
    ownerId: string;
    title: string;
    tiers: Array<{
      id: string; label: string; color: string; order: number;
      items: Array<{ id: string; title: string; imageUrl: string | null; order: number }>;
    }>;
    items: Array<{ id: string; title: string; imageUrl: string | null; order: number }>;
    liveSessionId: string | null;
  };
  return {
    id: tl.id,
    ownerId: tl.ownerId,
    title: tl.title,
    tiers: tl.tiers.map((t) => ({
      id: t.id, label: t.label, color: t.color, order: t.order,
      items: t.items.map((i) => ({
        id: i.id, title: i.title, imageUrl: i.imageUrl, order: i.order,
      })),
    })),
    unsortedItems: (tl.items || []).map((i) => ({
      id: i.id, title: i.title, imageUrl: i.imageUrl, order: i.order,
    })),
    liveSessionId: tl.liveSessionId,
  };
}

function fingerprint(d: TierListData): string {
  const tierIds = d.tiers.map(
    (t) => `${t.id}:${t.items.map((i) => i.id).join(",")}`
  );
  const unsorted = d.unsortedItems.map((i) => i.id).join(",");
  return `${d.title}|${tierIds.join(";")}|${unsorted}`;
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
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium flex-shrink-0 ${u.id === hostUserId
              ? "bg-purple-900/50 text-purple-300 ring-1 ring-purple-500/30"
              : u.draggingItemId
                ? "bg-yellow-900/50 text-yellow-300 ring-1 ring-yellow-500/30"
                : "bg-gray-800 text-gray-300"
              }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${u.draggingItemId ? "bg-yellow-400" : "bg-green-400"
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

export default function EditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const user = useUser();
  const [liveCode, setLiveCode] = useState<string | null>(null);
  const [liveUsers, setLiveUsers] = useState<LiveUser[]>([]);
  const [dragIndicators, setDragIndicators] = useState<DragIndicator[]>([]);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastFingerprintRef = useRef<string>("");

  const [data, setData] = useState<TierListData>();
  useEffect(() => {
    fetch(`/api/tierlist/${id}`)
      .then((res) => {
        if (!res.ok) {
          throw new Error("Failed to fetch tier list");
        }
        return res.json() as Promise<Record<string, unknown>>;
      })
      .then((tierList) => {
        const parsed = parseTierList(tierList);
        setData(parsed);
        lastFingerprintRef.current = fingerprint(parsed);
        if (parsed.liveSessionId) {
          setLiveCode(parsed.liveSessionId);
        }
      })
      .catch((err) => {
        toast.error(err.message);
        router.push("/");
      });
  }, [id, router]);

  useEffect(() => {
    if (data && data.ownerId !== user.id) {
      toast.error("You don't have permission to edit this tier list");
      router.push("/");
    }
  }, [data, user.id, router]);

  // Poll full tier list state + users during live session
  const pollLiveState = useCallback(async () => {
    if (!liveCode) return;

    try {
      const res = await fetch(
        `/api/live/${liveCode}/state`
      );
      if (res.status === 404) {
        // Session not found - probably ended
        setLiveCode(null);
        setLiveUsers([]);
        setDragIndicators([]);
        return;
      }

      if (!res.ok) {
        return;
      }

      const state = (await res.json()) as Record<string, unknown> & {
        users?: LiveUser[];
      };
      console.table(state.users);

      // Always update users and drag indicators
      const stateUsers = (state.users || []) as LiveUser[];
      setLiveUsers(stateUsers);

      const indicators: DragIndicator[] = [];
      for (const u of stateUsers) {
        if (u.id !== user.id && u.draggingItemId) {
          indicators.push({ itemId: u.draggingItemId, userName: u.username });
        }
      }
      setDragIndicators(indicators);

      // Only update tier list data if it actually changed
      if (state.id) {
        const parsed = parseTierList(state);
        const fp = fingerprint(parsed);
        if (fp !== lastFingerprintRef.current) {
          lastFingerprintRef.current = fp;
          setData(parsed);
        }
      }
    } catch {
      // ignore network errors
    }
  }, [user, liveCode]);

  // Poll when live session is active (owner only)
  useEffect(() => {
    if (liveCode) {
      pollLiveState();
      pollRef.current = setInterval(() => pollLiveState(), 1000);
    } else {
      setLiveUsers([]);
      setDragIndicators([]);
    }
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [liveCode, pollLiveState]);

  const handleSave = async (saveData: TierListData) => {
    const res = await fetch(`/api/tierlist/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: saveData.title,
        tiers: saveData.tiers,
        unsortedItems: saveData.unsortedItems,
      }),
    });

    if (res.status === 403) {
      toast.error("Unauthorized");
      throw new Error("Unauthorized");
    }
    if (!res.ok) throw new Error("Failed to save");
  };

  const handleStartLive = async () => {
    const res = await fetch("/api/live/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tierListId: id, discordGuildId: discordSdk.guildId }),
    });
    if (res.ok) {
      const { code } = (await res.json()) as { code: string };
      setLiveCode(code);
      toast.success(`Live session started! Code: ${code}`);
    } else {
      toast.error("Failed to start live session");
    }
  };

  const handleEndLive = async () => {
    if (liveCode) {
      await fetch(`/api/live/${liveCode}`, { method: "DELETE" });
    }
    setLiveCode(null);
    toast.success("Live session ended");
  };

  const handleLiveItemAdded = useCallback(
    async (item: { title: string; imageUrl: string | null }) => {
      if (!liveCode) return;
      await fetch(`/api/live/${liveCode}/add-item`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: item.title, imageUrl: item.imageUrl }),
      });
      await pollLiveState();
    },
    [liveCode, pollLiveState]
  );

  const handleLiveItemMoved = useCallback(
    async (itemId: string, targetTierId: string | null, newOrder: number) => {
      if (!liveCode) return;
      await fetch(`/api/live/${liveCode}/move-item`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId, tierId: targetTierId, order: newOrder }),
      });
      await pollLiveState();
    },
    [liveCode, pollLiveState]
  );

  const handleLiveItemRemoved = useCallback(
    async (itemId: string) => {
      if (!liveCode) return;
      await fetch(`/api/live/${liveCode}/remove-item`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId }),
      });
      await pollLiveState();
    },
    [liveCode, pollLiveState]
  );

  const handleLiveDragBroadcast = useCallback(
    (itemId: string | null) => {
      if (!liveCode) return;
      fetch(`/api/live/${liveCode}/drag`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId }),
      });
    },
    [liveCode]
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

      {/* Live user list bar */}
      {liveCode && liveUsers.length > 0 && (
        <LiveUserBar
          users={liveUsers}
          hostUserId={user.id}
        />
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
      </main >
    </>
  );
}
