import { DocumentReference } from "firebase-admin/firestore";
import {
  type SnapshotOptions,
  type FirestoreDataConverter,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { TierlistTier, tierlistTierConverter } from "./tierlist-tier";

export class TierlistItem {
  constructor(
    readonly id: string,
    readonly title: string,
    readonly image_url: string | null,
    readonly order: number,
    readonly tier: DocumentReference<TierlistTier> | null,
  ) { }
}

export const tierlistItemConverter: FirestoreDataConverter<TierlistItem> = {
  toFirestore(item: TierlistItem) {
    return {
      id: item.id,
      title: item.title,
      image_url: item.image_url,
      order: item.order,
      tierId: item.tier?.id || null,
    };
  },
  fromFirestore(
    snapshot: QueryDocumentSnapshot,
    options: SnapshotOptions,
  ): TierlistItem {
    const data = snapshot.data(options);
    return new TierlistItem(
      data.id,
      data.title,
      data.image_url,
      data.order,
      data.tier ? data.tier.withConverter(tierlistTierConverter) : null,
    );
  },
};
