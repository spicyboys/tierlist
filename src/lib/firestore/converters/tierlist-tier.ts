import {
  type SnapshotOptions,
  type FirestoreDataConverter,
  type QueryDocumentSnapshot,
} from "firebase/firestore";

export interface TierlistTierDoc {
  label: string;
  color: string;
  order: number;
}

export const tierlistTierConverter: FirestoreDataConverter<TierlistTierDoc> = {
  toFirestore(tier: TierlistTierDoc) {
    return {
      label: tier.label,
      color: tier.color,
      order: tier.order,
    };
  },
  fromFirestore(
    snapshot: QueryDocumentSnapshot,
    options?: SnapshotOptions,
  ): TierlistTierDoc {
    const data = snapshot.data(options);
    return {
      label: data.label,
      color: data.color,
      order: data.order,
    };
  },
};
