"use client";

import { db } from "@/lib/firebase/client";
import {
    collection,
    doc,
    setDoc,
    getDoc,
    getDocs,
    deleteDoc,
    updateDoc,
    onSnapshot,
    query,
    where,
    orderBy,
    writeBatch,
    serverTimestamp,
    Unsubscribe,
    Timestamp,
} from "firebase/firestore";
import { TierListData, TierData, TierItem } from "@/lib/types";
import { customAlphabet } from "nanoid";
import { tierlistConverter, type TierlistDoc } from "./converters/tierlist";
import { tierlistTierConverter, type TierlistTierDoc } from "./converters/tierlist-tier";
import { tierlistItemConverter, type TierlistItemDoc } from "./converters/tierlist-item";
import { liveSessionConverter, liveSessionUserConverter } from "./converters/live-session";
import { userConverter, type UserDoc } from "./converters/user";

const generateId = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 25);
const generateCode = customAlphabet("ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789", 6);

// ── Typed collection/doc helpers ───────────────────────────────────────

function tierlistDoc(id: string) {
    return doc(db, "tierlists", id).withConverter(tierlistConverter);
}

function tiersCol(tierlistId: string) {
    return collection(doc(db, "tierlists", tierlistId), "tiers").withConverter(tierlistTierConverter);
}

function itemsCol(tierlistId: string) {
    return collection(doc(db, "tierlists", tierlistId), "items").withConverter(tierlistItemConverter);
}

function liveSessionDoc(code: string) {
    return doc(db, "liveSessions", code).withConverter(liveSessionConverter);
}

function liveSessionUsersCol(code: string) {
    return collection(db, "liveSessions", code, "users").withConverter(liveSessionUserConverter);
}

function userDoc(uid: string) {
    return doc(db, "users", uid);
}

// ── User ───────────────────────────────────────────────────────────────

export async function ensureUserDocument(uid: string, name: string, hasCustomName: boolean = false) {
    const userRef = doc(db, "users", uid).withConverter(userConverter);
    const existing = await getDoc(userRef);
    if (existing.exists()) {
        // Only update the name if not already custom-named (unless this call is setting a custom name)
        const data = existing.data()!;
        if (!data.hasCustomName || hasCustomName) {
            await setDoc(userRef, { name, hasCustomName: data.hasCustomName || hasCustomName }, { merge: true });
        }
    } else {
        await setDoc(userRef, { name, hasCustomName }, { merge: true });
    }
}

export async function getUserDocument(uid: string): Promise<UserDoc | null> {
    const userRef = doc(db, "users", uid).withConverter(userConverter);
    const snapshot = await getDoc(userRef);
    return snapshot.exists() ? snapshot.data()! : null;
}

export async function updateUserDisplayName(uid: string, name: string) {
    const userRef = doc(db, "users", uid).withConverter(userConverter);
    await setDoc(userRef, { name, hasCustomName: true }, { merge: true });
}

// ── Tier List CRUD ─────────────────────────────────────────────────────

export async function createTierList(
    userId: string,
    title: string,
    tiers: TierData[],
    unsortedItems: TierItem[] = [],
): Promise<string> {
    const id = generateId();
    const batch = writeBatch(db);

    // Root doc uses raw ref for serverTimestamp()
    const tierlistRef = doc(db, "tierlists", id);
    batch.set(tierlistRef, {
        title,
        owner: userDoc(userId),
        updatedAt: serverTimestamp(),
        liveSession: null,
    });

    const tiersCollection = tiersCol(id);
    const itemsCollection = itemsCol(id);

    for (const tier of tiers) {
        const tierRef = doc(tiersCollection);
        batch.set(tierRef, {
            label: tier.label,
            color: tier.color,
            order: tier.order,
        });

        for (const item of tier.items) {
            const itemRef = doc(itemsCollection);
            batch.set(itemRef, {
                title: item.title,
                imageUrl: item.imageUrl || null,
                order: item.order,
                tier: tierRef,
            });
        }
    }

    for (const item of unsortedItems) {
        const itemRef = doc(itemsCollection);
        batch.set(itemRef, {
            title: item.title,
            imageUrl: item.imageUrl || null,
            order: item.order,
            tier: null,
        });
    }

    await batch.commit();
    return id;
}

export async function saveTierList(
    id: string,
    data: { title: string; tiers: TierData[]; unsortedItems: TierItem[] },
) {
    const tierlistRef = doc(db, "tierlists", id);

    // Read existing subcollection docs first
    const [existingTiers, existingItems] = await Promise.all([
        getDocs(tiersCol(id)),
        getDocs(itemsCol(id)),
    ]);

    const batch = writeBatch(db);

    // Update main doc (raw ref for serverTimestamp())
    batch.update(tierlistRef, {
        title: data.title,
        updatedAt: serverTimestamp(),
    });

    // Delete old tiers & items
    for (const d of existingTiers.docs) batch.delete(d.ref);
    for (const d of existingItems.docs) batch.delete(d.ref);

    // Write new tiers & items
    const tiersCollection = tiersCol(id);
    const itemsCollection = itemsCol(id);

    for (const tier of data.tiers) {
        const tierRef = doc(tiersCollection);
        batch.set(tierRef, {
            label: tier.label,
            color: tier.color,
            order: tier.order,
        });

        for (const item of tier.items) {
            const itemRef = doc(itemsCollection);
            batch.set(itemRef, {
                title: item.title,
                imageUrl: item.imageUrl || null,
                order: item.order,
                tier: tierRef,
            });
        }
    }

    for (const item of data.unsortedItems) {
        const itemRef = doc(itemsCollection);
        batch.set(itemRef, {
            title: item.title,
            imageUrl: item.imageUrl || null,
            order: item.order,
            tier: null,
        });
    }

    await batch.commit();
}

export async function deleteTierList(id: string) {
    const batch = writeBatch(db);

    const [tiers, items] = await Promise.all([
        getDocs(tiersCol(id)),
        getDocs(itemsCol(id)),
    ]);

    for (const d of tiers.docs) batch.delete(d.ref);
    for (const d of items.docs) batch.delete(d.ref);
    batch.delete(doc(db, "tierlists", id));

    await batch.commit();
}

// ── Tier List Subscriptions ────────────────────────────────────────────

export function subscribeUserTierLists(
    userId: string,
    callback: (
        lists: Array<{ id: string; title: string; itemCount: number }>,
    ) => void,
): Unsubscribe {
    const q = query(
        collection(db, "tierlists").withConverter(tierlistConverter),
        where("owner", "==", userDoc(userId)),
        orderBy("updatedAt", "desc"),
    );

    return onSnapshot(q, async (snapshot) => {
        const lists = await Promise.all(
            snapshot.docs.map(async (d) => {
                const data = d.data();
                const items = await getDocs(itemsCol(d.id));
                return {
                    id: d.id,
                    title: data.title,
                    itemCount: items.size,
                };
            }),
        );
        callback(lists);
    });
}

/**
 * Subscribe to a full tier list with real-time updates.
 * Listens to the tierlist doc, tiers subcollection, and items subcollection.
 */
export function subscribeTierList(
    id: string,
    callback: (data: TierListData | null) => void,
): Unsubscribe {
    const tlRef = tierlistDoc(id);
    const tiersRef = tiersCol(id);
    const itemsRef = itemsCol(id);

    let tierlistData: TierlistDoc | null = null;
    let tiersData: Array<{ id: string } & TierlistTierDoc> = [];
    let itemsData: Array<{ id: string } & TierlistItemDoc> = [];
    let emitTimer: ReturnType<typeof setTimeout> | null = null;

    function emit() {
        if (emitTimer) clearTimeout(emitTimer);
        emitTimer = setTimeout(() => {
            if (!tierlistData) {
                callback(null);
                return;
            }

            const tiers: TierData[] = tiersData
                .sort((a, b) => a.order - b.order)
                .map((t) => ({
                    id: t.id,
                    label: t.label,
                    color: t.color,
                    order: t.order,
                    items: itemsData
                        .filter((i) => i.tier?.id === t.id)
                        .sort((a, b) => a.order - b.order)
                        .map((i) => ({
                            id: i.id,
                            title: i.title,
                            imageUrl: i.imageUrl,
                            order: i.order,
                        })),
                }));

            const unsortedItems: TierItem[] = itemsData
                .filter((i) => !i.tier)
                .sort((a, b) => a.order - b.order)
                .map((i) => ({
                    id: i.id,
                    title: i.title,
                    imageUrl: i.imageUrl,
                    order: i.order,
                }));

            callback({
                id,
                ownerId: tierlistData.owner.id,
                title: tierlistData.title,
                tiers,
                unsortedItems,
                liveSessionId: tierlistData.liveSession?.id ?? null,
            });
        }, 50);
    }

    const unsub1 = onSnapshot(tlRef, (snapshot) => {
        tierlistData = snapshot.data() ?? null;
        emit();
    });

    const unsub2 = onSnapshot(tiersRef, (snapshot) => {
        tiersData = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        emit();
    });

    const unsub3 = onSnapshot(itemsRef, (snapshot) => {
        itemsData = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        emit();
    });

    return () => {
        if (emitTimer) clearTimeout(emitTimer);
        unsub1();
        unsub2();
        unsub3();
    };
}

// ── Live Session ───────────────────────────────────────────────────────

export async function createLiveSession(
    tierlistId: string,
    discordGuildId: string | null,
): Promise<string> {
    const code = generateCode();
    const tlRef = doc(db, "tierlists", tierlistId);
    await setDoc(liveSessionDoc(code), {
        tierlist: tlRef,
        discordGuildId,
    });

    // Mark the tierlist as having an active live session
    await updateDoc(tlRef, {
        liveSession: doc(db, "liveSessions", code),
    });

    return code;
}

export async function endLiveSession(code: string, tierlistId: string) {
    const batch = writeBatch(db);

    const usersSnapshot = await getDocs(liveSessionUsersCol(code));
    for (const d of usersSnapshot.docs) batch.delete(d.ref);

    batch.delete(doc(db, "liveSessions", code));
    batch.update(doc(db, "tierlists", tierlistId), { liveSession: null });

    await batch.commit();
}

export async function checkLiveSession(
    code: string,
): Promise<{ tierlistId: string; discordGuildId: string | null } | null> {
    const snapshot = await getDoc(liveSessionDoc(code));
    if (!snapshot.exists()) return null;
    const data = snapshot.data()!;
    return {
        tierlistId: data.tierlist.id,
        discordGuildId: data.discordGuildId,
    };
}

// ── Live Session Item Operations ───────────────────────────────────────

export async function addTierListItem(
    tierlistId: string,
    title: string,
    imageUrl: string | null,
): Promise<string> {
    const itemRef = doc(itemsCol(tierlistId));
    await setDoc(itemRef, {
        title,
        imageUrl: imageUrl || null,
        order: Date.now(),
        tier: null,
    });
    return itemRef.id;
}

export async function moveTierListItem(
    tierlistId: string,
    itemId: string,
    targetTierId: string | null,
    order: number,
) {
    const items = itemsCol(tierlistId);
    const itemsSnapshot = await getDocs(items);

    const batch = writeBatch(db);

    // Items in the target container (excluding the one being moved)
    const targetItems = itemsSnapshot.docs
        .filter((d) => {
            const data = d.data();
            if (d.id === itemId) return false;
            return targetTierId ? data.tier?.id === targetTierId : !data.tier;
        })
        .map((d) => ({ ref: d.ref, order: d.data().order }))
        .sort((a, b) => a.order - b.order);

    const insertAt = Math.min(Math.max(order, 0), targetItems.length);

    // Update the moved item
    const targetTierRef = targetTierId
        ? doc(tiersCol(tierlistId), targetTierId)
        : null;
    batch.update(doc(items, itemId), {
        tier: targetTierRef,
        order: insertAt,
    });

    // Recompute order for other items in the target container
    let orderIdx = 0;
    for (let i = 0; i < targetItems.length; i++) {
        if (orderIdx === insertAt) orderIdx++;
        batch.update(targetItems[i].ref, { order: orderIdx });
        orderIdx++;
    }

    await batch.commit();
}

export async function removeTierListItem(
    tierlistId: string,
    itemId: string,
) {
    await deleteDoc(doc(itemsCol(tierlistId), itemId));
}

// ── Live Session Presence ──────────────────────────────────────────────

export async function updatePresence(
    code: string,
    userId: string,
    username: string,
) {
    await setDoc(
        doc(liveSessionUsersCol(code), userId),
        {
            username,
            lastSeenAt: Timestamp.fromMillis(Date.now()),
        },
        { merge: true },
    );
}

export async function setDragState(
    code: string,
    userId: string,
    itemId: string | null,
) {
    await setDoc(
        doc(liveSessionUsersCol(code), userId),
        {
            draggingItemId: itemId || null,
            lastSeenAt: Timestamp.fromMillis(Date.now()),
        },
        { merge: true },
    );
}

export function subscribeLiveSessionUsers(
    code: string,
    callback: (
        users: Array<{
            id: string;
            username: string;
            draggingItemId: string | null;
        }>,
    ) => void,
): Unsubscribe {
    return onSnapshot(
        liveSessionUsersCol(code),
        (snapshot) => {
            const now = Math.floor(Date.now() / 1000);
            const TIMEOUT = 15;

            const users = snapshot.docs
                .map((d) => ({
                    id: d.id,
                    ...d.data(),
                }))
                .filter((u) => now - u.lastSeenAt.toMillis() / 1000 < TIMEOUT);

            callback(users);
        },
    );
}

// ── Guild Sessions ─────────────────────────────────────────────────────

export function subscribeGuildSessions(
    guildId: string,
    callback: (sessions: Array<{ code: string; title: string }>) => void,
): Unsubscribe {
    const q = query(
        collection(db, "liveSessions").withConverter(liveSessionConverter),
        where("discordGuildId", "==", guildId),
    );

    return onSnapshot(q, async (snapshot) => {
        const sessions = await Promise.all(
            snapshot.docs.map(async (d) => {
                const data = d.data();
                const tlDoc = await getDoc(tierlistDoc(data.tierlist.id));
                return {
                    code: d.id,
                    title: tlDoc.exists()
                        ? tlDoc.data()!.title
                        : "Unknown",
                };
            }),
        );
        callback(sessions);
    });
}
