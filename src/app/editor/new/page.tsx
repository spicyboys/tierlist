"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import TierListEditor from "@/components/TierListEditor";
import { TierListData } from "@/lib/types";
import toast from "react-hot-toast";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";

const DEFAULT_TIERS = [
  { id: "new-s", label: "S", color: "#ff7f7f", order: 0, items: [] },
  { id: "new-a", label: "A", color: "#ffbf7f", order: 1, items: [] },
  { id: "new-b", label: "B", color: "#ffdf7f", order: 2, items: [] },
  { id: "new-c", label: "C", color: "#ffff7f", order: 3, items: [] },
  { id: "new-d", label: "D", color: "#bfff7f", order: 4, items: [] },
  { id: "new-f", label: "F", color: "#7fffff", order: 5, items: [] },
];

const BLANK_DATA: TierListData = {
  id: "",
  title: "My Tier List",
  tiers: DEFAULT_TIERS,
  unsortedItems: [],
};

export default function NewEditorPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/auth/login");
    }
  }, [user, authLoading, router]);

  const handleCreate = async (data: TierListData) => {
    setSaving(true);
    try {
      const createRes = await fetch("/api/tierlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: data.title }),
      });

      if (!createRes.ok) throw new Error("Failed to create tier list");
      const created = (await createRes.json()) as { id: string };

      // Save the full state
      const saveRes = await fetch(`/api/tierlist/${created.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: data.title,
          tiers: data.tiers,
          unsortedItems: data.unsortedItems,
        }),
      });

      if (!saveRes.ok) throw new Error("Failed to save");

      toast.success("Created and saved!");
      router.push(`/editor/${created.id}`);
    } finally {
      setSaving(false);
    }
  };

  if (authLoading || !user) {
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
        <Link
          href="/dashboard"
          className="text-sm text-gray-400 hover:text-white transition"
        >
          Dashboard
        </Link>
      </nav>
      <TierListEditor
        initialData={BLANK_DATA}
        onSave={handleCreate}
        canSave={!saving}
      />
    </div>
  );
}
