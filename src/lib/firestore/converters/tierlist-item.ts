import {
  type SnapshotOptions,
  type FirestoreDataConverter,
  type QueryDocumentSnapshot,
  type DocumentReference,
} from "firebase/firestore";

export interface TierlistItemDoc {
  title: string;
  imageUrl: string | null;
  order: number;
  tier: DocumentReference | null;
  locked?: boolean;
}

export const tierlistItemConverter: FirestoreDataConverter<TierlistItemDoc> = {
  toFirestore(item: TierlistItemDoc) {
    return {
      title: item.title,
      imageUrl: item.imageUrl,
      order: item.order,
      tier: item.tier,
      locked: item.locked ?? false,
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
      tier: data.tier ?? null,
      locked: data.locked ?? false,
    };
  },
};
