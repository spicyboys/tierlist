"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/components/AuthProvider";
import { createTierList } from "@/lib/firestore";
import toast from "react-hot-toast";

const DEFAULT_TIERS = [
  { id: "new-s", label: "S", color: "#ff7f7f", order: 0, items: [] },
  { id: "new-a", label: "A", color: "#ffbf7f", order: 1, items: [] },
  { id: "new-b", label: "B", color: "#ffdf7f", order: 2, items: [] },
  { id: "new-c", label: "C", color: "#ffff7f", order: 3, items: [] },
  { id: "new-d", label: "D", color: "#bfff7f", order: 4, items: [] },
  { id: "new-f", label: "F", color: "#7fffff", order: 5, items: [] },
];

export default function NewEditorPage() {
  const router = useRouter();
  const user = useUser();
  const creatingRef = useRef(false);

  useEffect(() => {
    if (!user || creatingRef.current) return;
    creatingRef.current = true;

    createTierList(user.id, "My Tier List", DEFAULT_TIERS)
      .then((id) => {
        router.replace(`/editor/${id}`);
      })
      .catch((error) => {
        console.error(error);
        toast.error("Failed to create tier list");
        creatingRef.current = false;
      });
  }, [user, router]);

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="text-gray-400">Creating tier list...</div>
    </div>
  );
}
