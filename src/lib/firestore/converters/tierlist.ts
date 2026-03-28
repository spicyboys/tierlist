import {
  type SnapshotOptions,
  type FirestoreDataConverter,
  type QueryDocumentSnapshot,
} from "firebase/firestore";

export interface TierlistDoc {
  title: string;
  ownerId: string;
  liveSessionCode: string | null;
}

export const tierlistConverter: FirestoreDataConverter<TierlistDoc> = {
  toFirestore(tierlist: TierlistDoc) {
    return {
      title: tierlist.title,
      ownerId: tierlist.ownerId,
      liveSessionCode: tierlist.liveSessionCode,
    };
  },
  fromFirestore(
    snapshot: QueryDocumentSnapshot,
    options?: SnapshotOptions,
  ): TierlistDoc {
    const data = snapshot.data(options);
    return {
      title: data.title,
      ownerId: data.ownerId,
      liveSessionCode: data.liveSessionCode ?? null,
    };
  },
};
