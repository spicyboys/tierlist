import {
  type SnapshotOptions,
  type FirestoreDataConverter,
  type QueryDocumentSnapshot,
} from "firebase/firestore";

export interface UserDoc {
  name: string;
  hasCustomName: boolean;
}

export const userConverter: FirestoreDataConverter<UserDoc> = {
  toFirestore(user: UserDoc) {
    return { name: user.name, hasCustomName: user.hasCustomName };
  },
  fromFirestore(
    snapshot: QueryDocumentSnapshot,
    options?: SnapshotOptions,
  ): UserDoc {
    const data = snapshot.data(options);
    return { name: data.name, hasCustomName: data.hasCustomName ?? false };
  },
};
