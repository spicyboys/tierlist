"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/components/AuthProvider";
import { createTierList } from "@/lib/firestore";
import toast from "react-hot-toast";
import { DEFAULT_TIERS } from "@/lib/consts";

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
