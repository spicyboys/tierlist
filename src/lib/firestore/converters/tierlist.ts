import {
  type SnapshotOptions,
  type FirestoreDataConverter,
  type QueryDocumentSnapshot,
  type DocumentReference,
} from "firebase/firestore";

export interface TierlistDoc {
  title: string;
  owner: DocumentReference;
  liveSession: DocumentReference | null;
}

export const tierlistConverter: FirestoreDataConverter<TierlistDoc> = {
  toFirestore(tierlist: TierlistDoc) {
    return {
      title: tierlist.title,
      owner: tierlist.owner,
      liveSession: tierlist.liveSession,
    };
  },
  fromFirestore(
    snapshot: QueryDocumentSnapshot,
    options?: SnapshotOptions,
  ): TierlistDoc {
    const data = snapshot.data(options);
    return {
      title: data.title,
      owner: data.owner,
      liveSession: data.liveSession ?? null,
    };
  },
};
