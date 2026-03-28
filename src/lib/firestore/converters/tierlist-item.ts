import {
  type SnapshotOptions,
  type FirestoreDataConverter,
  type QueryDocumentSnapshot,
} from "firebase/firestore";

export interface TierlistItemDoc {
  title: string;
  imageUrl: string | null;
  order: number;
  tierId: string | null;
}

export const tierlistItemConverter: FirestoreDataConverter<TierlistItemDoc> = {
  toFirestore(item: TierlistItemDoc) {
    return {
      title: item.title,
      imageUrl: item.imageUrl,
      order: item.order,
      tierId: item.tierId,
    };
  },
  fromFirestore(
    snapshot: QueryDocumentSnapshot,
    options?: SnapshotOptions,
  ): TierlistItemDoc {
    const data = snapshot.data(options);
    return {
      title: data.title,
      imageUrl: data.imageUrl ?? null,
      order: data.order,
      tierId: data.tierId ?? null,
    };
  },
};
