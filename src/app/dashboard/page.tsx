"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";
import { useAuth } from "@/components/AuthProvider";

interface TierListSummary {
  id: string;
  title: string;
  creatorName: string;
  updatedAt: number;
  _count: { items: number };
}

export default function DashboardPage() {
  const { user, loading: authLoading, logout } = useAuth();
  const router = useRouter();
  const [tierLists, setTierLists] = useState<TierListSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push("/auth/login");
      return;
    }
    fetch("/api/tierlist?mine=1")
      .then((res) => res.json() as Promise<TierListSummary[]>)
      .then((data) => setTierLists(data))
      .finally(() => setLoading(false));
  }, [user, authLoading, router]);

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this tier list?")) return;

    const res = await fetch(`/api/tierlist/${id}`, {
      method: "DELETE",
    });
    if (res.ok) {
      setTierLists((prev) => prev.filter((t) => t.id !== id));
      toast.success("Deleted");
    } else {
      toast.error("Failed to delete");
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-gray-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <nav className="border-b border-gray-800 px-4 py-3 flex items-center justify-between">
        <Link href="/" className="text-lg font-bold text-white">
          TierMaker
        </Link>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-400">{user?.name}</span>
          <button
            onClick={logout}
            className="text-sm text-gray-500 hover:text-white transition"
          >
            Log Out
          </button>
        </div>
      </nav>

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
              <div
                key={tl.id}
                className="bg-gray-900 rounded-lg p-4 flex items-center justify-between group hover:bg-gray-800 transition"
              >
                <Link href={`/editor/${tl.id}`} className="flex-1 min-w-0">
                  <h3 className="font-medium text-white truncate">
                    {tl.title}
                  </h3>
                  <p className="text-sm text-gray-500">
                    {tl._count.items} items
                  </p>
                </Link>
                <button
                  onClick={() => handleDelete(tl.id)}
                  className="text-gray-600 hover:text-red-400 ml-4 opacity-0 group-hover:opacity-100 transition-opacity text-sm"
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
