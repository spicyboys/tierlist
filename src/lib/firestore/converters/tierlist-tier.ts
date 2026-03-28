import { DocumentReference } from "firebase-admin/firestore";
import {
  type SnapshotOptions,
  type FirestoreDataConverter,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { Tierlist, tierlistConverter } from "./tierlist";

export class TierlistTier {
  constructor(
    readonly id: string,
    readonly label: string,
    readonly color: string,
    readonly order: number,
    readonly tierlist: DocumentReference<Tierlist>,
  ) { }
}

export const tierlistTierConverter: FirestoreDataConverter<TierlistTier> = {
  toFirestore(tierlist: TierlistTier) {
    return {
      id: tierlist.id,
      label: tierlist.label,
      color: tierlist.color,
      order: tierlist.order,
      tierListId: tierlist.tierlist.id,
    };
  },
  fromFirestore(
    snapshot: QueryDocumentSnapshot,
    options: SnapshotOptions,
  ): TierlistTier {
    const data = snapshot.data(options);
    return new TierlistTier(
      data.id,
      data.label,
      data.color,
      data.order,
      data.tierlist.withConverter(tierlistConverter),
    );
  },
};
