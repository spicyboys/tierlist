"use client";

import { useState } from "react";

interface DisplayNameModalProps {
  currentName: string;
  onSave: (name: string) => void;
  onClose: () => void;
}

export default function DisplayNameModal({
  currentName,
  onSave,
  onClose,
}: DisplayNameModalProps) {
  const [name, setName] = useState(currentName);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    const trimmed = name.trim();
    if (!trimmed || trimmed === currentName) {
      onClose();
      return;
    }
    setSaving(true);
    onSave(trimmed);
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-gray-900 rounded-xl p-6 max-w-sm w-full shadow-2xl">
        <h3 className="text-lg font-bold text-white mb-4">
          Change Display Name
        </h3>

        <input
          autoFocus
          type="text"
          placeholder="Display name..."
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSubmit();
          }}
          maxLength={50}
          className="w-full bg-gray-800 text-white px-4 py-2.5 rounded-lg border border-gray-700 focus:border-blue-500 outline-none mb-4"
        />

        <div className="flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-400 hover:text-white transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!name.trim() || saving}
            className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg transition"
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
