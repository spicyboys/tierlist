"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useUser } from "@/components/AuthProvider";
import { subscribeUserTierLists, deleteTierList } from "@/lib/firestore";
import toast from "react-hot-toast";

export default function DashboardPage() {
  const user = useUser();
  const [tierLists, setTierLists] = useState<
    Array<{ id: string; title: string; itemCount: number }>
  >([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const unsub = subscribeUserTierLists(user.id, (lists) => {
      setTierLists(lists);
      setLoading(false);
    });
    return unsub;
  }, [user]);

  if (!user) {
    return (
      <main className="max-w-2xl mx-auto px-4 pt-4 pb-20 text-center">
        <p className="text-gray-400">Sign in to see your tier lists.</p>
      </main>
    );
  }

  return (
    <main className="max-w-2xl mx-auto px-4 pt-4 pb-20 text-center">
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

        {loading ? (
          <div className="text-gray-400 py-16">Loading...</div>
        ) : tierLists.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-gray-500 mb-4">No tier lists yet</p>
            <Link href="/editor/new" className="text-blue-400 hover:underline">
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

function TierListItem({
  tierList,
}: {
  tierList: {
    id: string;
    title: string;
    itemCount: number;
  };
}) {
  const handleDelete = async () => {
    try {
      await deleteTierList(tierList.id);
      toast.success("Tier list deleted");
    } catch {
      toast.error("Failed to delete");
    }
  };

  return (
    <div className="bg-gray-900 rounded-lg p-4 flex items-center justify-between group hover:bg-gray-800 transition">
      <Link href={`/editor/${tierList.id}`} className="flex-1 min-w-0">
        <h3 className="font-medium text-white truncate">{tierList.title}</h3>
        <p className="text-sm text-gray-500">{tierList.itemCount} items</p>
      </Link>
      <button
        onClick={handleDelete}
        className="text-gray-600 hover:text-red-400 ml-4 opacity-0 group-hover:opacity-100 transition-opacity text-sm"
      >
        Delete
      </button>
    </div>
  );
}
