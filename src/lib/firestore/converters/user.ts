import {
  type SnapshotOptions,
  type FirestoreDataConverter,
  type QueryDocumentSnapshot,
} from "firebase/firestore";

export class User {
  constructor(
    readonly id: string,
    readonly name: string,
  ) { }
}

export const userConverter: FirestoreDataConverter<User> = {
  toFirestore(user: User) {
    return { id: user.id, name: user.name };
  },
  fromFirestore(
    snapshot: QueryDocumentSnapshot,
    options: SnapshotOptions,
  ): User {
    const data = snapshot.data(options);
    return new User(data.id, data.name);
  },
};
