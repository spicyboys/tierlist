import { DocumentReference } from "firebase-admin/firestore";
import {
  type SnapshotOptions,
  type FirestoreDataConverter,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { User, userConverter } from "./user";

export class Tierlist {
  constructor(
    readonly title: string,
    readonly owner: DocumentReference<User>,
  ) { }
}

export const tierlistConverter: FirestoreDataConverter<Tierlist> = {
  toFirestore(tierlist: Tierlist) {
    return { title: tierlist.title, owner: tierlist.owner };
  },
  fromFirestore(
    snapshot: QueryDocumentSnapshot,
    options: SnapshotOptions,
  ): Tierlist {
    const data = snapshot.data(options);
    return new Tierlist(data.title, data.owner.withConverter(userConverter));
  },
};
