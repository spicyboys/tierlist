"use client";

import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  horizontalListSortingStrategy,
} from "@dnd-kit/sortable";
import { TierData } from "@/lib/types";
import ItemTile from "./ItemTile";
import { DragIndicator } from "./TierListEditor";

interface TierRowProps {
  tier: TierData;
  onRemoveTier?: () => void;
  onRenameTier?: (label: string) => void;
  onMoveTierUp?: () => void;
  onMoveTierDown?: () => void;
  onRemoveItem?: (itemId: string) => void;
  onEditItem?: (itemId: string) => void;
  isFirst?: boolean;
  isLast?: boolean;
  canEditTiers?: boolean;
  readOnly?: boolean;
  dragIndicators?: DragIndicator[];
}

export default function TierRow({
  tier,
  onRemoveTier,
  onRenameTier,
  onMoveTierUp,
  onMoveTierDown,
  onRemoveItem,
  onEditItem,
  isFirst,
  isLast,
  canEditTiers = true,
  readOnly,
  dragIndicators,
}: TierRowProps) {
  const { setNodeRef, isOver } = useDroppable({ id: `tier-${tier.id}` });

  return (
    <div
      className={`flex items-stretch border-b border-black/40 last:border-b-0 ${
        isOver ? "bg-white/5" : ""
      }`}
    >
      {/* Tier label */}
      <div
        className="w-[90px] sm:w-[120px] min-h-[80px] sm:min-h-[100px] flex flex-col items-center justify-center flex-shrink-0 gap-1 border-r border-black/30"
        style={{ backgroundColor: tier.color }}
      >
        {canEditTiers ? (
          <input
            className="w-[60px] sm:w-[80px] text-center font-extrabold text-black bg-transparent border-none outline-none text-xl sm:text-2xl tracking-wide drop-shadow-[0_1px_1px_rgba(255,255,255,0.3)]"
            value={tier.label}
            onChange={(e) => onRenameTier?.(e.target.value)}
          />
        ) : (
          <span className="font-extrabold text-black text-xl sm:text-2xl tracking-wide drop-shadow-[0_1px_1px_rgba(255,255,255,0.3)]">
            {tier.label}
          </span>
        )}
        {canEditTiers && (
          <div className="flex gap-1 export-hide">
            {!isFirst && (
              <button
                onClick={onMoveTierUp}
                className="text-black/50 hover:text-black text-[10px] leading-none"
                title="Move up"
              >
                ▲
              </button>
            )}
            {!isLast && (
              <button
                onClick={onMoveTierDown}
                className="text-black/50 hover:text-black text-[10px] leading-none"
                title="Move down"
              >
                ▼
              </button>
            )}
            <button
              onClick={onRemoveTier}
              className="text-black/50 hover:text-black text-[10px] leading-none"
              title="Remove tier"
            >
              ✕
            </button>
          </div>
        )}
      </div>

      {/* Items area */}
      <div
        ref={setNodeRef}
        className="flex-1 bg-[#1a1a2e] min-h-[80px] sm:min-h-[100px]"
      >
        <SortableContext
          items={tier.items.map((i) => i.id)}
          strategy={horizontalListSortingStrategy}
        >
          <div className="flex flex-wrap min-h-[80px] sm:min-h-[100px]">
            {tier.items.map((item) => (
              <ItemTile
                key={item.id}
                item={item}
                onRemove={
                  onRemoveItem ? () => onRemoveItem(item.id) : undefined
                }
                onEdit={onEditItem ? () => onEditItem(item.id) : undefined}
                draggedBy={
                  dragIndicators?.find((d) => d.itemId === item.id)?.userName
                }
                readOnly={readOnly}
              />
            ))}
          </div>
        </SortableContext>
      </div>
    </div>
  );
}
