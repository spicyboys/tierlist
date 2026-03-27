"use client";

import { useEffect, useState, useCallback, useRef, use } from "react";
import { useRouter } from "next/navigation";
import TierListEditor, { DragIndicator } from "@/components/TierListEditor";
import { TierListData, TierItem } from "@/lib/types";
import toast from "react-hot-toast";
import Link from "next/link";
import { useUser } from "@/components/UserProvider";

interface LiveUser {
  id: string;
  username: string;
  draggingItemId?: string | null;
}

function parseTierList(data: Record<string, unknown>): TierListData {
  const tl = data as {
    id: string;
    ownerId: string;
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
    liveSessionId: string | null;
  };
  return {
    id: tl.id,
    ownerId: tl.ownerId,
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
  const [users, setUsers] = useState<LiveUser[]>([]);
  const [dragIndicators, setDragIndicators] = useState<DragIndicator[]>([]);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastFingerprintRef = useRef<string>("");
  const isDraggingRef = useRef(false);
  const user = useUser();

  const pollState = useCallback(async () => {
    try {
      const res = await fetch(`/api/live/${code}/state`);
      if (!res.ok) {
        if (res.status === 404) {
          if (data !== null) {
            toast.error("Session ended");
            setEnded(true);
          }
        }

        if (pollRef.current) clearInterval(pollRef.current);
        return;
      }

      const state = (await res.json()) as Record<string, unknown> & {
        users?: LiveUser[];
      };

      // Always update users and drag indicators
      if (state.users) {
        setUsers(state.users);
        const indicators: DragIndicator[] = [];
        for (const u of state.users) {
          if (u.id !== user.id && u.draggingItemId) {
            indicators.push({ itemId: u.draggingItemId, userName: u.username });
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
  }, [code, user.id]);

  useEffect(() => {
    fetch(`/api/live/${code}`)
      .then((res) => {
        if (!res.ok) throw new Error("Session not found");
        return res.json() as Promise<unknown>;
      })
      .then(() => pollState())
      .then(() => {
        setLoading(false);
        pollRef.current = setInterval(pollState, 1000);
      })
      .catch(() => {
        toast.error("Session not found");
        router.push("/");
      });

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [code, router, pollState]);

  const handleItemAdded = useCallback(
    async (item: TierItem) => {
      if (ended) return;

      await fetch(`/api/live/${code}/add-item`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: item.title, imageUrl: item.imageUrl }),
      });
      await pollState();
    },
    [code, pollState, ended]
  );

  const handleItemMoved = useCallback(
    async (itemId: string, targetTierId: string | null, newOrder: number) => {
      if (ended) return;

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
    [code, pollState, ended]
  );

  const handleItemRemoved = useCallback(
    async (itemId: string) => {
      if (ended) return;

      await fetch(`/api/live/${code}/remove-item`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId }),
      });
      await pollState();
    },
    [code, pollState, ended]
  );

  const handleDragBroadcast = useCallback(
    (itemId: string | null) => {
      if (ended) return;

      if (itemId) {
        isDraggingRef.current = true;
      } else {
        isDraggingRef.current = false;
      }
      fetch(`/api/live/${code}/drag`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId }),
      });
    },
    [code, ended]
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
      {users.length > 0 && (
        <div className="border-b border-gray-800 px-4 py-2 flex items-center gap-2 overflow-x-auto">
          {users.map((u) => (
            <span
              key={u.id}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium flex-shrink-0 ${u.id === user.id
                ? "bg-blue-900/50 text-blue-300 ring-1 ring-blue-500/30"
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
