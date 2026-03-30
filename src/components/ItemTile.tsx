"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { TierItem } from "@/lib/types";
import { useImageProxy } from "./DiscordSDKProvider";

interface ItemTileProps {
  item: TierItem;
  onRemove?: () => void;
  onEdit?: () => void;
  onVote?: () => void;
  onToggleLock?: () => void;
  overlay?: boolean;
  draggedBy?: string;
  isHost?: boolean;
  isLive?: boolean;
}

export default function ItemTile({
  item,
  onRemove,
  onEdit,
  onVote,
  onToggleLock,
  overlay,
  draggedBy,
  isHost,
  isLive,
}: ItemTileProps) {
  const proxyUrl = useImageProxy();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id, disabled: !!item.locked });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
  };

  const content = (
    <>
      {item.imageUrl ? (
        <img
          src={proxyUrl(item.imageUrl)}
          alt={item.title}
          className="w-full h-full object-cover export-img"
          draggable={false}
          referrerPolicy="no-referrer"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-[11px] text-gray-200 p-1 text-center leading-tight bg-gray-700">
          {item.title}
        </div>
      )}
      {item.imageUrl && (
        <div className="export-title absolute bottom-0 left-0 right-0 bg-black/70 text-white text-[9px] leading-tight px-1 py-[2px] truncate text-center font-medium">
          {item.title}
        </div>
      )}
    </>
  );

  if (overlay) {
    return (
      <div className="export-tile w-[80px] h-[80px] sm:w-[100px] sm:h-[100px] overflow-hidden bg-gray-700 border-2 border-blue-400 shadow-2xl relative flex-shrink-0">
        {content}
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`export-tile w-[80px] h-[80px] sm:w-[100px] sm:h-[100px] overflow-hidden bg-gray-700 relative flex-shrink-0 group touch-none ${
        item.locked
          ? "cursor-not-allowed border-2 border-yellow-600/50 opacity-90"
          : "cursor-grab active:cursor-grabbing"
      } ${
        draggedBy
          ? "border-2 border-yellow-400 ring-1 ring-yellow-400/50 animate-pulse"
          : item.locked
            ? ""
            : "border border-gray-900/50 hover:brightness-110 hover:z-10"
      }`}
    >
      {content}
      {draggedBy && (
        <div className="absolute top-0 left-0 right-0 bg-yellow-500 text-black text-[9px] font-bold px-1 py-[1px] truncate text-center z-20">
          {draggedBy}
        </div>
      )}
      {/* Lock indicator */}
      {item.locked && (
        <div className="absolute top-0 left-0 bg-yellow-600 text-black text-[9px] w-4 h-4 flex items-center justify-center z-20" title="Locked">
          🔒
        </div>
      )}
      {!draggedBy && (onRemove || onEdit || onVote || onToggleLock) && (
        <div className="export-hide absolute top-0 right-0 flex sm:opacity-0 sm:group-hover:opacity-100 transition-opacity z-20">
          {isLive && onVote && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onVote();
              }}
              className="bg-amber-600 text-white text-[10px] w-5 h-5 sm:w-4 sm:h-4 flex items-center justify-center"
              title="Start vote"
            >
              ⚖
            </button>
          )}
          {onEdit && !item.locked && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}
              className="bg-blue-600 text-white text-[10px] w-5 h-5 sm:w-4 sm:h-4 flex items-center justify-center"
              title="Edit"
            >
              ✎
            </button>
          )}
          {isHost && isLive && onToggleLock && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleLock();
              }}
              className={`text-white text-[10px] w-5 h-5 sm:w-4 sm:h-4 flex items-center justify-center ${item.locked ? "bg-yellow-600" : "bg-gray-500"}`}
              title={item.locked ? "Unlock" : "Lock"}
            >
              {item.locked ? "🔓" : "🔒"}
            </button>
          )}
          {onRemove && !item.locked && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRemove();
              }}
              className="bg-red-600 text-white text-[10px] w-5 h-5 sm:w-4 sm:h-4 flex items-center justify-center"
              title="Remove"
            >
              x
            </button>
          )}
        </div>
      )}
    </div>
  );
}
