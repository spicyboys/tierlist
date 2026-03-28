import { DocumentReference } from "firebase-admin/firestore";
import {
  type SnapshotOptions,
  type FirestoreDataConverter,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { Tierlist, tierlistConverter } from "./tierlist";

export class LiveSession {
  constructor(
    readonly code: string,
    readonly tierlist: DocumentReference<Tierlist>,
  ) { }
}

export const liveSessionConverter: FirestoreDataConverter<LiveSession> = {
  toFirestore(liveSession: LiveSession) {
    return { code: liveSession.code, tierlist: liveSession.tierlist };
  },
  fromFirestore(
    snapshot: QueryDocumentSnapshot,
    options: SnapshotOptions,
  ): LiveSession {
    const data = snapshot.data(options);
    return new LiveSession(data.code, data.tierlist.withConverter(tierlistConverter));
  },
};
