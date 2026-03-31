export interface TierItem {
  id: string;
  title: string;
  imageUrl: string | null;
  order: number;
}

export interface TierData {
  id: string;
  label: string;
  color: string;
  order: number;
  items: TierItem[];
}

export interface LiveSessionInfo {
  code: string;
  active: boolean;
}

export interface TierListData {
  id: string;
  ownerId?: string;
  title: string;
  tiers: TierData[];
  unsortedItems: TierItem[];
  liveSession: LiveSessionInfo | null;
}
