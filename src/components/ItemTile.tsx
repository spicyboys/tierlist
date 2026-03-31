"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { TierItem } from "@/lib/types";
import { useImageProxy } from "./DiscordSDKProvider";

interface ItemTileProps {
  item: TierItem;
  onRemove?: () => void;
  onEdit?: () => void;
  overlay?: boolean;
  draggedBy?: string;
}

export default function ItemTile({
  item,
  onRemove,
  onEdit,
  overlay,
  draggedBy,
}: ItemTileProps) {
  const proxyUrl = useImageProxy();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

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
      className={`export-tile w-[80px] h-[80px] sm:w-[100px] sm:h-[100px] overflow-hidden bg-gray-700 cursor-grab active:cursor-grabbing relative flex-shrink-0 group touch-none ${
        draggedBy
          ? "border-2 border-yellow-400 ring-1 ring-yellow-400/50 animate-pulse"
          : "border border-gray-900/50 hover:brightness-110 hover:z-10"
      }`}
    >
      {content}
      {draggedBy && (
        <div className="absolute top-0 left-0 right-0 bg-yellow-500 text-black text-[9px] font-bold px-1 py-[1px] truncate text-center z-20">
          {draggedBy}
        </div>
      )}
      {!draggedBy && (onRemove || onEdit) && (
        <div className="export-hide absolute top-0 right-0 flex sm:opacity-0 sm:group-hover:opacity-100 transition-opacity z-20">
          {onEdit && (
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
          {onRemove && (
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
