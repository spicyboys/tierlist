import Link from "next/link";
import { eq, desc, count } from "drizzle-orm";
import { getAuthUser } from "@/lib/auth";
import { getEnv } from "@/lib/env";
import { getDb, schema } from "@/lib/db";
import { refresh } from "next/cache";

async function fetchTierLists() {
  const user = await getAuthUser();
  if (!user) {
    throw new Error("Unauthorized");
  }
  const db = getDb();
  return await db
    .select({
      id: schema.tierLists.id,
      title: schema.tierLists.title,
      itemCount: count(schema.items.id)
    })
    .from(schema.tierLists)
    .leftJoin(schema.items, eq(schema.tierLists.id, schema.items.tierListId))
    .where(eq(schema.tierLists.ownerId, user.id))
    .groupBy(schema.tierLists.id)
    .orderBy(desc(schema.tierLists.updatedAt));
}

export default async function DashboardPage() {
  const tierLists = await fetchTierLists();
  console.log("Fetched tier lists", tierLists);

  return (
    <main className="max-w-2xl mx-auto px-4 py-24 text-center">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">My Tier Lists</h1>
          <Link
            href="/editor/new"
            className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
          >
            + New Tier List
          </Link>
        </div>

        {tierLists.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-gray-500 mb-4">No tier lists yet</p>
            <Link
              href="/editor/new"
              className="text-blue-400 hover:underline"
            >
              Create your first one
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {tierLists.map((tl) => (
              <TierListItem key={tl.id} tierList={tl} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

function TierListItem({ tierList }: {
  tierList: {
    id: string;
    title: string;
    itemCount: number;
  }
}) {

  async function deleteItem() {
    "use server";

    const user = await getAuthUser();
    if (!user) {
      throw new Error("Unauthorized");
    }
    const db = getDb();

    const t = await db
      .select()
      .from(schema.tierLists)
      .where(eq(schema.tierLists.id, tierList.id))
      .get();

    if (!t) {
      throw new Error("Not found");
    }

    if (t.ownerId !== user.id) {
      throw new Error("Unauthorized");
    }

    await db.delete(schema.tierLists).where(eq(schema.tierLists.id, tierList.id)).run();

    refresh();
  }

  return (
    <div
      key={tierList.id}
      className="bg-gray-900 rounded-lg p-4 flex items-center justify-between group hover:bg-gray-800 transition"
    >
      <Link href={`/editor/${tierList.id}`} className="flex-1 min-w-0">
        <h3 className="font-medium text-white truncate">
          {tierList.title}
        </h3>
        <p className="text-sm text-gray-500">
          {tierList.itemCount} items
        </p>
      </Link>
      <button
        onClick={deleteItem}
        className="text-gray-600 hover:text-red-400 ml-4 opacity-0 group-hover:opacity-100 transition-opacity text-sm"
      >
        Delete
      </button>
    </div>
  );
}