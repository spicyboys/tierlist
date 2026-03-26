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

export interface TierListData {
  id: string;
  title: string;
  tiers: TierData[];
  unsortedItems: TierItem[];
}
