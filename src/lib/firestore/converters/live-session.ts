import {
  type SnapshotOptions,
  type FirestoreDataConverter,
  type QueryDocumentSnapshot,
  Timestamp,
} from "firebase/firestore";

export interface LiveSessionUserDoc {
  username: string;
  lastSeenAt: Timestamp;
  draggingItemId: string | null;
}

export const liveSessionUserConverter: FirestoreDataConverter<LiveSessionUserDoc> = {
  toFirestore(user: LiveSessionUserDoc) {
    const data: Record<string, unknown> = {};
    if (user.username !== undefined) data.username = user.username;
    if (user.lastSeenAt !== undefined) data.lastSeenAt = user.lastSeenAt;
    if (user.draggingItemId !== undefined) data.draggingItemId = user.draggingItemId;
    return data;
  },
  fromFirestore(
    snapshot: QueryDocumentSnapshot,
    options?: SnapshotOptions,
  ): LiveSessionUserDoc {
    const data = snapshot.data(options);
    return {
      username: data.username,
      lastSeenAt: data.lastSeenAt,
      draggingItemId: data.draggingItemId ?? null,
    };
  },
};
