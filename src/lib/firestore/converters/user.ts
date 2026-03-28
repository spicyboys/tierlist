import {
  type SnapshotOptions,
  type FirestoreDataConverter,
  type QueryDocumentSnapshot,
} from "firebase/firestore";

export interface UserDoc {
  name: string;
}

export const userConverter: FirestoreDataConverter<UserDoc> = {
  toFirestore(user: UserDoc) {
    return { name: user.name };
  },
  fromFirestore(
    snapshot: QueryDocumentSnapshot,
    options?: SnapshotOptions,
  ): UserDoc {
    const data = snapshot.data(options);
    return { name: data.name };
  },
};
