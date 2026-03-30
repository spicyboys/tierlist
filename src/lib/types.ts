export interface TierItem {
  id: string;
  title: string;
  imageUrl: string | null;
  order: number;
  locked?: boolean;
}

export interface VoteState {
  itemId: string;
  itemTitle: string;
  startedAt: number; // millis
  responses: Record<string, string>; // userId -> tier label (S/A/B/C/D/E/F)
  result: string | null; // computed tier label or null if still open
}

export interface TierData {
  id: string;
  label: string;
  color: string;
  order: number;
  items: TierItem[];
}

export interface TierListData {
  id: string;
  ownerId?: string;
  title: string;
  tiers: TierData[];
  unsortedItems: TierItem[];
  liveSessionId: string | null;
}
