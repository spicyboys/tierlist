"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
  DragOverEvent,
  pointerWithin,
  rectIntersection,
  closestCenter,
  CollisionDetection,
} from "@dnd-kit/core";
import {
  SortableContext,
  horizontalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useDroppable } from "@dnd-kit/core";
import { TierData, TierItem, TierListData } from "@/lib/types";
import TierRow from "./TierRow";
import ItemTile from "./ItemTile";
import AddItemModal from "./AddItemModal";
import EditItemModal from "./EditItemModal";
import VotePanel from "./VotePanel";
import { useImageProxy, useDiscordSDK } from "./DiscordSDKProvider";
import toast from "react-hot-toast";
import { useDiscordAccessToken } from "./AuthProvider";
import type { DiscordSDK } from "@discord/embedded-app-sdk";
import { VoteState } from "@/lib/types";

async function uploadAndShareMoment(
  canvas: HTMLCanvasElement,
  filename: string,
  discordSdk: DiscordSDK,
  accessToken: string,
) {
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/png"),
  );
  if (!blob) throw new Error("Failed to convert canvas to blob");

  const form = new FormData();
  form.append("file", blob, filename);

  const uploadRes = await fetch(
    `https://discord.com/api/v10/applications/${discordSdk.clientId}/attachment`,
    {
      method: "POST",
      body: form,
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );
  if (!uploadRes.ok) throw new Error("Failed to upload image to Discord");

  const {
    attachment: { url: mediaUrl },
  } = (await uploadRes.json()) as { attachment: { url: string } };
  await discordSdk.commands.openShareMomentDialog({ mediaUrl });
}

export interface DragIndicator {
  itemId: string;
  userName: string;
}

interface TierListEditorProps {
  initialData: TierListData;
  onSave?: (data: TierListData) => Promise<void>;
  canEditTiers?: boolean;
  canSave?: boolean;
  onStartLive?: () => void;
  liveSessionCode?: string | null;
  onEndLive?: () => void;
  onItemAdded?: (item: TierItem, targetTierId: string | null) => void;
  onItemMoved?: (
    itemId: string,
    targetTierId: string | null,
    newOrder: number,
  ) => void | Promise<void>;
  onItemRemoved?: (itemId: string) => void;
  onDragBroadcast?: (itemId: string | null) => void;
  dragIndicators?: DragIndicator[];
  // Vote
  vote?: VoteState | null;
  currentUserId?: string;
  totalLiveUsers?: number;
  onStartVote?: (itemId: string, itemTitle: string) => void;
  onSubmitVote?: (tier: string) => void;
  onResolveVote?: (result: string) => void;
  onClearVote?: () => void;
  // Lock
  isHost?: boolean;
  onToggleLockItem?: (itemId: string, locked: boolean) => void;
}

let nextId = 1;
function tempId() {
  return `temp-${Date.now()}-${nextId++}`;
}

const tierListCollision: CollisionDetection = (args) => {
  const pw = pointerWithin(args);
  if (pw.length > 0) {
    // Prefer item collisions over container collisions (tier-xxx, unsorted)
    // so that same-container reordering works
    const items = pw.filter(
      (c) => !String(c.id).startsWith("tier-") && String(c.id) !== "unsorted",
    );
    if (items.length > 0) {
      // Use closestCenter among the item hits for precision
      const itemIds = new Set(items.map((c) => String(c.id)));
      const filteredArgs = {
        ...args,
        droppableContainers: args.droppableContainers.filter((c) =>
          itemIds.has(String(c.id)),
        ),
      };
      const cc = closestCenter(filteredArgs);
      if (cc.length > 0) return cc;
      return items;
    }
    return pw;
  }
  return rectIntersection(args);
};

function UnsortedPool({
  items,
  onRemoveItem,
  onEditItem,
  onVoteItem,
  onToggleLockItem,
  dragIndicators,
  isHost,
  isLive,
}: {
  items: TierItem[];
  onRemoveItem?: (id: string) => void;
  onEditItem?: (id: string) => void;
  onVoteItem?: (id: string) => void;
  onToggleLockItem?: (id: string) => void;
  dragIndicators?: DragIndicator[];
  isHost?: boolean;
  isLive?: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: "unsorted" });

  return (
    <div
      ref={setNodeRef}
      className={`bg-[#1a1a2e] min-h-[80px] sm:min-h-[100px] ${
        isOver ? "bg-white/5" : ""
      }`}
    >
      <SortableContext
        items={items.map((i) => i.id)}
        strategy={horizontalListSortingStrategy}
      >
        <div className="flex flex-wrap min-h-[80px] sm:min-h-[100px]">
          {items.map((item) => (
            <ItemTile
              key={item.id}
              item={item}
              onRemove={onRemoveItem ? () => onRemoveItem(item.id) : undefined}
              onEdit={onEditItem ? () => onEditItem(item.id) : undefined}
              onVote={onVoteItem ? () => onVoteItem(item.id) : undefined}
              onToggleLock={onToggleLockItem ? () => onToggleLockItem(item.id) : undefined}
              draggedBy={
                dragIndicators?.find((d) => d.itemId === item.id)?.userName
              }
              isHost={isHost}
              isLive={isLive}
            />
          ))}
          {items.length === 0 && (
            <p className="text-gray-500 text-sm py-8 w-full text-center">
              Drag items here or add new items below
            </p>
          )}
        </div>
      </SortableContext>
    </div>
  );
}

// Build recommended items based on what the title suggests
function useRecommendations(title: string, allItems: TierItem[]) {
  const [suggestions, setSuggestions] = useState<
    Array<{ title: string; imageUrl: string | null }>
  >([]);
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);
  const lastQuery = useRef("");

  const fetchRecommendations = useCallback(async () => {
    if (!title.trim() || title === lastQuery.current) return;
    lastQuery.current = title;
    setLoading(true);
    try {
      // Use Wikipedia search to get related topics
      const res = await fetch("/api/image-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: title, source: "wikipedia" }),
      });
      const data = (await res.json()) as {
        results?: Array<{ url: string; thumbnail: string; title: string }>;
      };
      const existingTitles = new Set(
        allItems.map((i) => i.title.toLowerCase()),
      );
      const recs = (data.results || [])
        .filter((r) => !existingTitles.has(r.title.toLowerCase()))
        .map((r) => ({ title: r.title, imageUrl: r.thumbnail || r.url }));
      setSuggestions(recs);
      setFetched(true);
    } catch {
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  }, [title, allItems]);

  return {
    suggestions,
    loading,
    fetched,
    fetchRecommendations,
    setSuggestions,
  };
}

export default function TierListEditor({
  initialData,
  onSave,
  canEditTiers = true,
  canSave = true,
  onStartLive,
  liveSessionCode,
  onEndLive,
  onItemAdded,
  onItemMoved,
  onItemRemoved,
  onDragBroadcast,
  dragIndicators,
  vote,
  currentUserId,
  totalLiveUsers,
  onStartVote,
  onSubmitVote,
  onResolveVote,
  onClearVote,
  isHost,
  onToggleLockItem,
}: TierListEditorProps) {
  const proxyUrl = useImageProxy();
  const discordSdk = useDiscordSDK();
  const discordAccessToken = useDiscordAccessToken();
  const [title, setTitle] = useState(initialData.title);
  const [tiers, setTiers] = useState<TierData[]>(initialData.tiers);
  const [unsortedItems, setUnsortedItems] = useState<TierItem[]>(
    initialData.unsortedItems,
  );
  const [activeItem, setActiveItem] = useState<TierItem | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingItem, setEditingItem] = useState<TierItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const tierListRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const tiersRef = useRef(tiers);
  const unsortedRef = useRef(unsortedItems);

  // Wrapped setters that update refs SYNCHRONOUSLY before setState
  // This is critical because dnd-kit may fire handleDragOver and handleDragEnd
  // in the same event, and handleDragEnd needs to read from refs immediately.
  const setTiersWrapped = useCallback(
    (updater: TierData[] | ((prev: TierData[]) => TierData[])) => {
      const next =
        typeof updater === "function" ? updater(tiersRef.current) : updater;
      tiersRef.current = next;
      setTiers(next);
    },
    [],
  );
  const setUnsortedWrapped = useCallback(
    (updater: TierItem[] | ((prev: TierItem[]) => TierItem[])) => {
      const next =
        typeof updater === "function" ? updater(unsortedRef.current) : updater;
      unsortedRef.current = next;
      setUnsortedItems(next);
    },
    [],
  );

  // All items for recommendations
  const allItems = useMemo(() => {
    const items = [...unsortedItems];
    for (const tier of tiers) {
      items.push(...tier.items);
    }
    return items;
  }, [tiers, unsortedItems]);

  const {
    suggestions,
    loading: recsLoading,
    fetched: recsFetched,
    fetchRecommendations,
    setSuggestions,
  } = useRecommendations(title, allItems);

  // Sync initialData when it changes (live session updates)
  const prevDataRef = useRef(initialData);
  useEffect(() => {
    if (prevDataRef.current !== initialData && !isDraggingRef.current) {
      prevDataRef.current = initialData;
      setTitle(initialData.title);
      setTiersWrapped(initialData.tiers);
      setUnsortedWrapped(initialData.unsortedItems);
    }
  }, [initialData]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 5 },
    }),
  );

  const findItem = useCallback(
    (id: string): { item: TierItem; source: "unsorted" | string } | null => {
      const unsorted = unsortedRef.current.find((i) => i.id === id);
      if (unsorted) return { item: unsorted, source: "unsorted" };
      for (const tier of tiersRef.current) {
        const found = tier.items.find((i) => i.id === id);
        if (found) return { item: found, source: tier.id };
      }
      return null;
    },
    [],
  );

  const getContainerId = useCallback((id: string): string | null => {
    if (id === "unsorted") return "unsorted";
    if (id.startsWith("tier-")) return id.replace("tier-", "");
    if (unsortedRef.current.some((i) => i.id === id)) return "unsorted";
    for (const tier of tiersRef.current) {
      if (tier.items.some((i) => i.id === id)) return tier.id;
    }
    return null;
  }, []);

  const handleDragStart = (event: DragStartEvent) => {
    const result = findItem(event.active.id as string);
    if (result?.item.locked) return;
    isDraggingRef.current = true;
    if (result) {
      setActiveItem(result.item);
      onDragBroadcast?.(event.active.id as string);
    }
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    const activeContainer = getContainerId(activeId);
    let overContainer = getContainerId(overId);
    if (overId.startsWith("tier-")) {
      overContainer = overId.replace("tier-", "");
    }

    if (!activeContainer || !overContainer) return;

    // Same-container reordering
    if (activeContainer === overContainer) {
      if (overId.startsWith("tier-") || overId === "unsorted") return;
      if (activeId === overId) return;

      if (activeContainer === "unsorted") {
        setUnsortedWrapped((prev) => {
          const oldIndex = prev.findIndex((i) => i.id === activeId);
          const newIndex = prev.findIndex((i) => i.id === overId);
          if (oldIndex === -1 || newIndex === -1) return prev;
          const updated = [...prev];
          const [moved] = updated.splice(oldIndex, 1);
          updated.splice(newIndex, 0, moved);
          return updated;
        });
      } else {
        setTiersWrapped((prev) =>
          prev.map((tier) => {
            if (tier.id !== activeContainer) return tier;
            const oldIndex = tier.items.findIndex((i) => i.id === activeId);
            const newIndex = tier.items.findIndex((i) => i.id === overId);
            if (oldIndex === -1 || newIndex === -1) return tier;
            const items = [...tier.items];
            const [moved] = items.splice(oldIndex, 1);
            items.splice(newIndex, 0, moved);
            return { ...tier, items };
          }),
        );
      }
      return;
    }

    const itemResult = findItem(activeId);
    if (!itemResult) return;
    const item = itemResult.item;

    if (activeContainer === "unsorted") {
      setUnsortedWrapped((prev) => prev.filter((i) => i.id !== activeId));
    } else {
      setTiersWrapped((prev) =>
        prev.map((tier) =>
          tier.id === activeContainer
            ? { ...tier, items: tier.items.filter((i) => i.id !== activeId) }
            : tier,
        ),
      );
    }

    if (overContainer === "unsorted") {
      setUnsortedWrapped((prev) => {
        if (prev.some((i) => i.id === item.id)) return prev;
        return [...prev, item];
      });
    } else {
      setTiersWrapped((prev) =>
        prev.map((tier) => {
          if (tier.id !== overContainer) return tier;
          if (tier.items.some((i) => i.id === item.id)) return tier;
          return { ...tier, items: [...tier.items, item] };
        }),
      );
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    // Keep isDraggingRef true until onItemMoved completes to prevent poll overwrites
    setActiveItem(null);
    onDragBroadcast?.(null);

    if (!over) {
      isDraggingRef.current = false;
      return;
    }

    const activeId = active.id as string;

    if (onItemMoved) {
      // Read from refs which are kept in sync by the wrapped setters
      const latestUnsorted = unsortedRef.current;
      const latestTiers = tiersRef.current;

      let resolvedContainer: string | null = null;
      let resolvedIndex = 0;

      const unsortedIdx = latestUnsorted.findIndex((i) => i.id === activeId);
      if (unsortedIdx !== -1) {
        resolvedContainer = "unsorted";
        resolvedIndex = unsortedIdx;
      } else {
        for (const tier of latestTiers) {
          const idx = tier.items.findIndex((i) => i.id === activeId);
          if (idx !== -1) {
            resolvedContainer = tier.id;
            resolvedIndex = idx;
            break;
          }
        }
      }

      // Wait for server update before allowing polls to overwrite local state
      const result = onItemMoved(
        activeId,
        resolvedContainer === "unsorted" ? null : resolvedContainer,
        resolvedIndex,
      );
      if (result && typeof result.then === "function") {
        result.finally(() => {
          isDraggingRef.current = false;
        });
      } else {
        isDraggingRef.current = false;
      }
    } else {
      isDraggingRef.current = false;
    }
  };

  const handleAddItem = (itemTitle: string, imageUrl: string | null) => {
    const newItem: TierItem = {
      id: tempId(),
      title: itemTitle,
      imageUrl,
      order: unsortedItems.length,
    };
    setUnsortedWrapped((prev) => [...prev, newItem]);
    onItemAdded?.(newItem, null);
  };

  const handleRemoveItem = (itemId: string) => {
    setUnsortedWrapped((prev) => prev.filter((i) => i.id !== itemId));
    setTiersWrapped((prev) =>
      prev.map((tier) => ({
        ...tier,
        items: tier.items.filter((i) => i.id !== itemId),
      })),
    );
    onItemRemoved?.(itemId);
  };

  const handleEditItem = (itemId: string) => {
    const result = findItem(itemId);
    if (result) {
      setEditingItem(result.item);
    }
  };

  const handleSaveEditedItem = (updatedItem: TierItem) => {
    setUnsortedWrapped((prev) =>
      prev.map((i) => (i.id === updatedItem.id ? updatedItem : i)),
    );
    setTiersWrapped((prev) =>
      prev.map((tier) => ({
        ...tier,
        items: tier.items.map((i) =>
          i.id === updatedItem.id ? updatedItem : i,
        ),
      })),
    );
  };

  const handleAddRecommendation = (rec: {
    title: string;
    imageUrl: string | null;
  }) => {
    const newItem: TierItem = {
      id: tempId(),
      title: rec.title,
      imageUrl: rec.imageUrl,
      order: unsortedItems.length,
    };
    setUnsortedWrapped((prev) => [...prev, newItem]);
    onItemAdded?.(newItem, null);
    // Remove from suggestions
    setSuggestions((prev) => prev.filter((s) => s.title !== rec.title));
  };

  const handleVoteItem = (itemId: string) => {
    if (!onStartVote) return;
    if (vote && !vote.result) {
      toast.error("A vote is already in progress");
      return;
    }
    const result = findItem(itemId);
    if (result) {
      onStartVote(itemId, result.item.title);
    }
  };

  const handleToggleLockItem = (itemId: string) => {
    if (!onToggleLockItem) return;
    const result = findItem(itemId);
    if (result) {
      onToggleLockItem(itemId, !result.item.locked);
    }
  };

  const handleAddTier = () => {
    const newTier: TierData = {
      id: tempId(),
      label: "New",
      color: "#9333ea",
      order: tiers.length,
      items: [],
    };
    setTiersWrapped((prev) => [...prev, newTier]);
  };

  const handleRemoveTier = (tierId: string) => {
    const tier = tiers.find((t) => t.id === tierId);
    if (tier) {
      setUnsortedWrapped((prev) => [...prev, ...tier.items]);
    }
    setTiersWrapped((prev) => prev.filter((t) => t.id !== tierId));
  };

  const handleRenameTier = (tierId: string, label: string) => {
    setTiersWrapped((prev) =>
      prev.map((t) => (t.id === tierId ? { ...t, label } : t)),
    );
  };

  const handleMoveTier = (tierId: string, direction: "up" | "down") => {
    setTiersWrapped((prev) => {
      const idx = prev.findIndex((t) => t.id === tierId);
      if (idx === -1) return prev;
      const swap = direction === "up" ? idx - 1 : idx + 1;
      if (swap < 0 || swap >= prev.length) return prev;
      const updated = [...prev];
      [updated[idx], updated[swap]] = [updated[swap], updated[idx]];
      return updated.map((t, i) => ({ ...t, order: i }));
    });
  };

  const handleSave = async () => {
    if (!onSave) return;
    setSaving(true);
    try {
      await onSave({
        id: initialData.id,
        title,
        tiers: tiers.map((t, i) => ({
          ...t,
          order: i,
          items: t.items.map((item, j) => ({ ...item, order: j })),
        })),
        unsortedItems: unsortedItems.map((item, i) => ({
          ...item,
          order: i,
        })),
        liveSessionId: initialData.liveSessionId,
      });
      toast.success("Tier list saved!");
    } catch {
      toast.error("Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleExportPNG = async () => {
    if (!tierListRef.current) return;
    setExporting(true);
    try {
      const renderScale = 4;

      // Clone the tier list offscreen so we can mutate it without visual glitches
      const clone = tierListRef.current.cloneNode(true) as HTMLDivElement;
      clone.setAttribute("data-exporting", "true");
      clone.style.position = "fixed";
      clone.style.left = "-99999px";
      clone.style.top = "0";
      clone.style.width = `${tierListRef.current.offsetWidth}px`;

      // Add title header at top of exported image
      const titleEl = document.createElement("div");
      titleEl.textContent = title || "Tier List";
      titleEl.style.fontSize = "24px";
      titleEl.style.fontWeight = "bold";
      titleEl.style.color = "white";
      titleEl.style.textAlign = "center";
      titleEl.style.padding = "16px 0 12px";
      clone.insertBefore(titleEl, clone.firstChild);

      document.body.appendChild(clone);

      // html2canvas doesn't support object-fit:cover, so we pre-render each
      // image onto a <canvas> at high resolution with cover-crop. html2canvas
      // copies canvas pixels directly, preserving full quality.
      const origImgs =
        tierListRef.current.querySelectorAll<HTMLImageElement>(".export-img");
      const cloneImgs = clone.querySelectorAll<HTMLImageElement>(".export-img");

      // Reload each image with CORS enabled so we can draw to canvas
      const loadedImages = await Promise.all(
        Array.from(origImgs).map(
          (img) =>
            new Promise<HTMLImageElement>((resolve) => {
              const corsImg = new Image();
              corsImg.crossOrigin = "anonymous";
              corsImg.onload = () => resolve(corsImg);
              corsImg.onerror = () => resolve(img); // fallback to original
              corsImg.src = img.src;
            }),
        ),
      );

      cloneImgs.forEach((cloneImg, i) => {
        const srcImg = loadedImages[i];
        const tile = cloneImg.closest(".export-tile");
        if (!tile) return;
        const tileEl = tile as HTMLElement;
        const tw = tileEl.offsetWidth;
        const th = tileEl.offsetHeight;
        const nw = srcImg.naturalWidth || tw;
        const nh = srcImg.naturalHeight || th;

        // Create a high-res canvas that simulates object-fit:cover
        const cvs = document.createElement("canvas");
        cvs.width = tw * renderScale;
        cvs.height = th * renderScale;
        cvs.style.width = `${tw}px`;
        cvs.style.height = `${th}px`;
        const ctx = cvs.getContext("2d");
        if (ctx) {
          try {
            // Compute cover-crop source rect
            const scale = Math.max(tw / nw, th / nh);
            const sw = tw / scale;
            const sh = th / scale;
            const sx = (nw - sw) / 2;
            const sy = (nh - sh) / 2;
            ctx.drawImage(srcImg, sx, sy, sw, sh, 0, 0, cvs.width, cvs.height);
            cloneImg.parentNode?.replaceChild(cvs, cloneImg);
          } catch {
            // If drawImage fails (CORS), leave the original img in place
          }
        }
      });

      const html2canvas = (await import("html2canvas")).default;
      const canvas = await html2canvas(clone, {
        backgroundColor: "#1a1a2e",
        scale: renderScale,
        useCORS: true,
        allowTaint: true,
      });

      document.body.removeChild(clone);

      if (discordSdk && discordAccessToken) {
        await uploadAndShareMoment(
          canvas,
          `${title || "tierlist"}.png`,
          discordSdk,
          discordAccessToken,
        );
      } else {
        const link = document.createElement("a");
        link.download = `${title || "tierlist"}.png`;
        link.href = canvas.toDataURL("image/png");
        link.click();
        toast.success("Exported as PNG!");
      }
    } catch (error) {
      console.error("Failed to export:", error);
      // Clean up clone if it's still in the DOM
      document.querySelector("[data-exporting]")?.remove();
      toast.error("Failed to export");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="text-2xl font-bold bg-transparent text-white border-b-2 border-transparent hover:border-gray-600 focus:border-blue-500 outline-none flex-1 min-w-0"
          placeholder="Tier List Title"
        />
        <div className="flex gap-2 flex-shrink-0 flex-wrap">
          <button
            onClick={handleExportPNG}
            disabled={exporting}
            className="bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
          >
            {exporting
              ? "Exporting..."
              : discordSdk && discordAccessToken
                ? "Share Image"
                : "Download Image"}
          </button>
          {canSave && onSave && (
            <button
              onClick={handleSave}
              disabled={saving}
              className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
            >
              {saving ? "Saving..." : "Save"}
            </button>
          )}
          {onStartLive && !liveSessionCode && (
            <button
              onClick={onStartLive}
              className="bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
            >
              Start Live Session
            </button>
          )}
          {liveSessionCode && (
            <div className="flex items-center gap-2">
              <span className="bg-green-900/50 text-green-400 px-3 py-2 rounded-lg text-sm font-mono">
                {liveSessionCode}
              </span>
              {onEndLive && (
                <button
                  onClick={onEndLive}
                  className="bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
                >
                  End
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Tiers */}
      <DndContext
        sensors={sensors}
        collisionDetection={tierListCollision}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-3 mb-4 items-start">
        <div
          ref={tierListRef}
          className="border-2 border-gray-950 overflow-hidden bg-[#1a1a2e] flex-1 min-w-0"
        >
          {tiers.map((tier, idx) => (
            <TierRow
              key={tier.id}
              tier={tier}
              onRemoveTier={() => handleRemoveTier(tier.id)}
              onRenameTier={(label) => handleRenameTier(tier.id, label)}
              onMoveTierUp={() => handleMoveTier(tier.id, "up")}
              onMoveTierDown={() => handleMoveTier(tier.id, "down")}
              onRemoveItem={handleRemoveItem}
              onEditItem={handleEditItem}
              onVoteItem={onStartVote ? handleVoteItem : undefined}
              onToggleLockItem={isHost ? handleToggleLockItem : undefined}
              isFirst={idx === 0}
              isLast={idx === tiers.length - 1}
              canEditTiers={canEditTiers}
              dragIndicators={dragIndicators}
              isHost={isHost}
              isLive={!!liveSessionCode}
            />
          ))}
        </div>

        {/* Vote panel - right side of tiers */}
        {liveSessionCode && vote !== undefined && currentUserId && (
          <VotePanel
            vote={vote}
            currentUserId={currentUserId}
            totalUsers={totalLiveUsers ?? 1}
            onSubmitVote={onSubmitVote ?? (() => {})}
            onResolveVote={onResolveVote ?? (() => {})}
            onClearVote={onClearVote ?? (() => {})}
          />
        )}
        </div>

        {/* Add tier button */}
        {canEditTiers && (
          <button
            onClick={handleAddTier}
            className="w-full border border-dashed border-gray-700 hover:border-gray-500 text-gray-500 hover:text-gray-300 py-2 mb-5 transition text-sm"
          >
            + Add Tier
          </button>
        )}

        {/* Unsorted pool */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider">
              Unsorted
            </h3>
            <button
              onClick={() => setShowAddModal(true)}
              className="bg-gray-700 hover:bg-gray-600 text-white px-3 py-1.5 rounded text-sm transition"
            >
              + Add Item
            </button>
          </div>
          <UnsortedPool
            items={unsortedItems}
            onRemoveItem={handleRemoveItem}
            onEditItem={handleEditItem}
            onVoteItem={onStartVote ? handleVoteItem : undefined}
            onToggleLockItem={isHost ? handleToggleLockItem : undefined}
            dragIndicators={dragIndicators}
            isHost={isHost}
            isLive={!!liveSessionCode}
          />
        </div>

        {/* Recommended items */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider">
              Recommended
            </h3>
            <button
              onClick={fetchRecommendations}
              disabled={recsLoading}
              className="bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-white px-3 py-1.5 rounded text-sm transition"
            >
              {recsLoading
                ? "Loading..."
                : recsFetched
                  ? "Refresh"
                  : "Get Suggestions"}
            </button>
          </div>
          {suggestions.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {suggestions.map((rec, i) => (
                <button
                  key={i}
                  onClick={() => handleAddRecommendation(rec)}
                  className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-gray-500 rounded-lg px-3 py-2 transition group"
                  title={`Add "${rec.title}"`}
                >
                  {rec.imageUrl && (
                    <img
                      src={proxyUrl(rec.imageUrl)}
                      alt={rec.title}
                      className="w-8 h-8 object-cover rounded flex-shrink-0"
                    />
                  )}
                  <span className="text-sm text-gray-300 group-hover:text-white">
                    {rec.title}
                  </span>
                  <span className="text-green-400 text-xs">+</span>
                </button>
              ))}
            </div>
          ) : recsFetched && !recsLoading ? (
            <p className="text-gray-600 text-sm py-3">
              No suggestions found. Try changing the tier list title.
            </p>
          ) : (
            <p className="text-gray-600 text-sm py-3">
              Click &quot;Get Suggestions&quot; to find related items based on
              the tier list title.
            </p>
          )}
        </div>

        <DragOverlay>
          {activeItem ? <ItemTile item={activeItem} overlay /> : null}
        </DragOverlay>
      </DndContext>

      {showAddModal && (
        <AddItemModal
          onAdd={handleAddItem}
          onClose={() => setShowAddModal(false)}
        />
      )}

      {editingItem && (
        <EditItemModal
          item={editingItem}
          onSave={handleSaveEditedItem}
          onClose={() => setEditingItem(null)}
        />
      )}
    </div>
  );
}
