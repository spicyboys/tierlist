import {
  type SnapshotOptions,
  type FirestoreDataConverter,
  type QueryDocumentSnapshot,
} from "firebase/firestore";

export interface LiveSessionDoc {
  tierlistId: string;
  discordGuildId: string | null;
}

export const liveSessionConverter: FirestoreDataConverter<LiveSessionDoc> = {
  toFirestore(session: LiveSessionDoc) {
    return {
      tierlistId: session.tierlistId,
      discordGuildId: session.discordGuildId,
    };
  },
  fromFirestore(
    snapshot: QueryDocumentSnapshot,
    options?: SnapshotOptions,
  ): LiveSessionDoc {
    const data = snapshot.data(options);
    return {
      tierlistId: data.tierlistId,
      discordGuildId: data.discordGuildId ?? null,
    };
  },
};

export interface LiveSessionUserDoc {
  username: string;
  lastSeenAt: number;
  draggingItemId: string | null;
}

export const liveSessionUserConverter: FirestoreDataConverter<LiveSessionUserDoc> = {
  toFirestore(user: LiveSessionUserDoc) {
    return {
      username: user.username,
      lastSeenAt: user.lastSeenAt,
      draggingItemId: user.draggingItemId,
    };
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
