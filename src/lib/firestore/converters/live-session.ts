import {
  type SnapshotOptions,
  type FirestoreDataConverter,
  type QueryDocumentSnapshot,
  type DocumentReference,
  Timestamp,
} from "firebase/firestore";

export interface LiveSessionDoc {
  tierlist: DocumentReference;
  discordGuildId: string | null;
}

export const liveSessionConverter: FirestoreDataConverter<LiveSessionDoc> = {
  toFirestore(session: LiveSessionDoc) {
    return {
      tierlist: session.tierlist,
      discordGuildId: session.discordGuildId,
    };
  },
  fromFirestore(
    snapshot: QueryDocumentSnapshot,
    options?: SnapshotOptions,
  ): LiveSessionDoc {
    const data = snapshot.data(options);
    return {
      tierlist: data.tierlist,
      discordGuildId: data.discordGuildId ?? null,
    };
  },
};

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
