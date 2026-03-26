"use client";

export const runtime = "edge";

import { useEffect, useState, useRef, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import TierListEditor, { DragIndicator } from "@/components/TierListEditor";
import { TierListData } from "@/lib/types";
import toast from "react-hot-toast";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { customAlphabet } from "nanoid";

const generateUserId = customAlphabet(
  "abcdefghijklmnopqrstuvwxyz0123456789",
  16
);

interface LiveUser {
  id: string;
  name: string;
  draggingItemId?: string | null;
}

function parseTierList(tierList: Record<string, unknown>): TierListData {
  const tl = tierList as {
    id: string;
    title: string;
    tiers: Array<{
      id: string; label: string; color: string; order: number;
      items: Array<{ id: string; title: string; imageUrl: string | null; order: number }>;
    }>;
    items: Array<{ id: string; title: string; imageUrl: string | null; order: number }>;
  };
  return {
    id: tl.id,
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
  };
}

function fingerprint(d: TierListData): string {
  const tierIds = d.tiers.map(
    (t) => `${t.id}:${t.items.map((i) => i.id).join(",")}`
  );
  const unsorted = d.unsortedItems.map((i) => i.id).join(",");
  return `${d.title}|${tierIds.join(";")}|${unsorted}`;
}

// Persist host userId so presence survives reloads
function getOrCreateHostId(tierListId: string): string {
  const key = `host_uid_${tierListId}`;
  if (typeof window === "undefined") return generateUserId();
  const stored = sessionStorage.getItem(key);
  if (stored) return stored;
  const id = generateUserId();
  sessionStorage.setItem(key, id);
  return id;
}

function getLiveCode(tierListId: string): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(`live_code_${tierListId}`);
}

function setLiveCodeStorage(tierListId: string, code: string | null) {
  if (typeof window === "undefined") return;
  if (code) {
    sessionStorage.setItem(`live_code_${tierListId}`, code);
  } else {
    sessionStorage.removeItem(`live_code_${tierListId}`);
  }
}

function LiveUserBar({
  users,
  hostUserId,
  isOwner,
  onRenameUser,
}: {
  users: LiveUser[];
  hostUserId: string;
  isOwner: boolean;
  onRenameUser: (userId: string, newName: string) => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  return (
    <div className="border-b border-gray-800 px-4 py-2 flex items-center gap-2 overflow-x-auto">
      {users.map((u) => {
        const isEditing = editingId === u.id;
        const canRename = isOwner && u.id !== hostUserId;

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
            {isEditing ? (
              <input
                autoFocus
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onBlur={() => {
                  if (editName.trim()) onRenameUser(u.id, editName);
                  setEditingId(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && editName.trim()) {
                    onRenameUser(u.id, editName);
                    setEditingId(null);
                  } else if (e.key === "Escape") {
                    setEditingId(null);
                  }
                }}
                className="bg-transparent border-b border-current outline-none w-20 text-xs"
              />
            ) : (
              <span
                onClick={() => {
                  if (canRename) {
                    setEditingId(u.id);
                    setEditName(u.name);
                  }
                }}
                className={canRename ? "cursor-pointer hover:underline" : ""}
                title={canRename ? "Click to rename" : undefined}
              >
                {u.name}
              </span>
            )}
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
  const { user, loading: authLoading } = useAuth();
  const [data, setData] = useState<TierListData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isOwner, setIsOwner] = useState(false);
  const [liveCode, setLiveCode] = useState<string | null>(null);
  const [liveUsers, setLiveUsers] = useState<LiveUser[]>([]);
  const [dragIndicators, setDragIndicators] = useState<DragIndicator[]>([]);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastFingerprintRef = useRef<string>("");
  const [hostUserId] = useState(() => getOrCreateHostId(id));

  // Poll full tier list state + users during live session
  const pollLiveState = useCallback(async (code: string) => {
    try {
      const hostName = user?.name || "Host";
      const res = await fetch(
        `/api/live/${code}/state?userId=${hostUserId}&userName=${encodeURIComponent(hostName)}`
      );
      if (!res.ok) {
        // Session might have ended
        const body = (await res.json().catch(() => ({}))) as { ended?: boolean };
        if (body.ended) {
          setLiveCode(null);
          setLiveCodeStorage(id, null);
          setLiveUsers([]);
          setDragIndicators([]);
        }
        return;
      }
      const state = (await res.json()) as Record<string, unknown> & {
        users?: LiveUser[];
        active?: boolean;
      };

      if (!state.active) {
        setLiveCode(null);
        setLiveCodeStorage(id, null);
        setLiveUsers([]);
        setDragIndicators([]);
        return;
      }

      // Always update users and drag indicators
      const stateUsers = (state.users || []) as LiveUser[];
      setLiveUsers(stateUsers);

      const indicators: DragIndicator[] = [];
      for (const u of stateUsers) {
        if (u.id !== hostUserId && u.draggingItemId) {
          indicators.push({ itemId: u.draggingItemId, userName: u.name });
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
  }, [hostUserId, user?.name, id]);

  useEffect(() => {
    if (authLoading) return;

    fetch(`/api/tierlist/${id}`)
      .then((res) => {
        if (!res.ok) throw new Error("Not found");
        return res.json() as Promise<Record<string, unknown>>;
      })
      .then(async (tierList) => {
        const parsed = parseTierList(tierList);
        lastFingerprintRef.current = fingerprint(parsed);
        setData(parsed);
        // Check if current user owns this tier list
        if (user && (tierList as { ownerId?: string }).ownerId === user.id) {
          setIsOwner(true);
        }

        const ownsThis = user && (tierList as { ownerId?: string }).ownerId === user.id;

        // Check if there's an active live session
        const storedCode = getLiveCode(id);
        if (storedCode) {
          try {
            const checkRes = await fetch(`/api/live/${storedCode}`);
            if (checkRes.ok) {
              if (ownsThis) {
                setLiveCode(storedCode);
              } else {
                // Non-owner: redirect to the live viewer page
                router.replace(`/live/${storedCode}`);
                return;
              }
            } else {
              setLiveCodeStorage(id, null);
            }
          } catch {
            setLiveCodeStorage(id, null);
          }
        } else {
          // Check if there's an active session we don't know about
          try {
            const activeRes = await fetch(`/api/live/active?tierListId=${id}`);
            if (activeRes.ok) {
              const activeData = (await activeRes.json()) as { active: boolean; code?: string };
              if (activeData.active && activeData.code) {
                if (ownsThis) {
                  setLiveCode(activeData.code);
                  setLiveCodeStorage(id, activeData.code);
                } else {
                  // Non-owner: redirect to the live viewer page
                  router.replace(`/live/${activeData.code}`);
                  return;
                }
              }
            }
          } catch {
            // ignore
          }
        }
      })
      .catch(() => {
        toast.error("Tier list not found");
        router.push("/dashboard");
      })
      .finally(() => setLoading(false));
  }, [id, router, user, authLoading]);

  // Poll when live session is active (owner only)
  useEffect(() => {
    if (liveCode && isOwner) {
      pollLiveState(liveCode);
      pollRef.current = setInterval(() => pollLiveState(liveCode), 1000);
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
  }, [liveCode, isOwner, pollLiveState]);

  const handleSave = async (saveData: TierListData) => {
    if (!isOwner) {
      toast.error("You don't own this tier list");
      throw new Error("Not owner");
    }

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
    if (!isOwner) {
      toast.error("You must own this tier list to start a live session");
      return;
    }

    const res = await fetch("/api/live/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tierListId: id }),
    });
    if (res.ok) {
      const { code } = (await res.json()) as { code: string };
      setLiveCode(code);
      setLiveCodeStorage(id, code);
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
    setLiveCodeStorage(id, null);
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
      await pollLiveState(liveCode);
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
      await pollLiveState(liveCode);
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
      await pollLiveState(liveCode);
    },
    [liveCode, pollLiveState]
  );

  const handleLiveDragBroadcast = useCallback(
    (itemId: string | null) => {
      if (!liveCode) return;
      fetch(`/api/live/${liveCode}/drag`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: hostUserId, itemId }),
      });
    },
    [liveCode, hostUserId]
  );

  const handleRenameUser = useCallback(
    async (userId: string, newName: string) => {
      if (!liveCode || !newName.trim()) return;
      await fetch(`/api/live/${liveCode}/rename-user`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, newName: newName.trim() }),
      });
      // Immediately update local state
      setLiveUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, name: newName.trim() } : u))
      );
    },
    [liveCode]
  );

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-gray-400">Loading...</div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <nav className="border-b border-gray-800 px-4 py-3 flex items-center justify-between">
        <Link href="/" className="text-lg font-bold text-white">
          TierMaker
        </Link>
        <div className="flex items-center gap-3">
          {liveCode && liveUsers.length > 0 && (
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <span className="text-sm text-gray-400">
                {liveUsers.length} online
              </span>
            </div>
          )}
          {isOwner ? (
            <span className="text-xs text-green-400">Owner</span>
          ) : (
            <span className="text-xs text-gray-500">View only</span>
          )}
          <Link
            href="/dashboard"
            className="text-sm text-gray-400 hover:text-white transition"
          >
            Dashboard
          </Link>
        </div>
      </nav>

      {/* Live user list bar */}
      {liveCode && liveUsers.length > 0 && (
        <LiveUserBar
          users={liveUsers}
          hostUserId={hostUserId}
          isOwner={isOwner}
          onRenameUser={handleRenameUser}
        />
      )}

      <TierListEditor
        initialData={data}
        onSave={isOwner ? handleSave : undefined}
        canSave={isOwner}
        onStartLive={isOwner ? handleStartLive : undefined}
        liveSessionCode={liveCode}
        onEndLive={isOwner ? handleEndLive : undefined}
        onItemMoved={liveCode ? handleLiveItemMoved : undefined}
        onItemAdded={liveCode ? handleLiveItemAdded : undefined}
        onItemRemoved={liveCode ? handleLiveItemRemoved : undefined}
        onDragBroadcast={liveCode ? handleLiveDragBroadcast : undefined}
        dragIndicators={liveCode ? dragIndicators : undefined}
      />
    </div>
  );
}
