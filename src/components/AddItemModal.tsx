"use client";

import { useState } from "react";

interface SearchResult {
  url: string;
  thumbnail: string;
  title: string;
}

type ImageSource = "commons" | "wikipedia" | "imgur" | "paste";

const SOURCE_LABELS: Record<ImageSource, string> = {
  commons: "Commons",
  wikipedia: "Wikipedia",
  imgur: "Imgur",
  paste: "Paste URL",
};

const SOURCE_ORDER: ImageSource[] = ["commons", "wikipedia", "imgur", "paste"];

interface AddItemModalProps {
  onAdd: (title: string, imageUrl: string | null) => void;
  onClose: () => void;
}

export default function AddItemModal({ onAdd, onClose }: AddItemModalProps) {
  const [title, setTitle] = useState("");
  const [source, setSource] = useState<ImageSource>("commons");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedUrl, setSelectedUrl] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [pasteUrl, setPasteUrl] = useState("");
  const [pasteValid, setPasteValid] = useState<boolean | null>(null);
  const [shufflePage, setShufflePage] = useState(0);

  const handleSearch = async (page = 0) => {
    if (!title.trim()) return;
    setSearching(true);
    if (page === 0) {
      setSelectedUrl(null);
      setResults([]);
    }
    try {
      const res = await fetch("/api/image-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: title, source, page }),
      });
      const data = (await res.json()) as { results?: SearchResult[] };
      setResults(data.results || []);
      setSearched(true);
      setShufflePage(page);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  };

  const handleShuffle = () => {
    handleSearch(shufflePage + 1);
  };

  const handleSourceChange = (s: ImageSource) => {
    setSource(s);
    setSelectedUrl(null);
    setResults([]);
    setSearched(false);
    setPasteUrl("");
    setPasteValid(null);
    setShufflePage(0);
  };

  const handlePasteUrlChange = (url: string) => {
    setPasteUrl(url);
    setPasteValid(null);
    setSelectedUrl(null);
    if (url.trim()) {
      const img = new Image();
      img.onload = () => {
        setPasteValid(true);
        setSelectedUrl(url.trim());
      };
      img.onerror = () => {
        setPasteValid(false);
        setSelectedUrl(null);
      };
      img.src = url.trim();
    }
  };

  const handleSubmit = () => {
    if (!title.trim()) return;
    onAdd(title.trim(), selectedUrl);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-xl p-6 max-w-lg w-full shadow-2xl max-h-[90vh] overflow-y-auto">
        <h3 className="text-lg font-bold text-white mb-4">Add Item</h3>

        <input
          autoFocus
          type="text"
          placeholder="Item title..."
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full bg-gray-800 text-white px-4 py-2.5 rounded-lg border border-gray-700 focus:border-blue-500 outline-none mb-4"
        />

        {/* Source tabs */}
        <div className="flex gap-1 mb-3 bg-gray-800 rounded-lg p-1">
          {SOURCE_ORDER.map((s) => (
            <button
              key={s}
              onClick={() => handleSourceChange(s)}
              className={`flex-1 text-xs py-1.5 rounded-md transition font-medium ${
                source === s
                  ? "bg-gray-600 text-white"
                  : "text-gray-400 hover:text-gray-300"
              }`}
            >
              {SOURCE_LABELS[s]}
            </button>
          ))}
        </div>

        {/* Search-based sources */}
        {source !== "paste" && (
          <>
            <div className="flex gap-2 mb-3">
              <button
                onClick={() => handleSearch(0)}
                disabled={!title.trim() || searching}
                className="flex-1 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-white py-2 rounded-lg transition text-sm"
              >
                {searching
                  ? `Searching ${SOURCE_LABELS[source]}...`
                  : `Search ${SOURCE_LABELS[source]}`}
              </button>
              {(source === "imgur" || source === "commons") && searched && results.length > 0 && (
                <button
                  onClick={handleShuffle}
                  disabled={searching}
                  className="bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-white px-3 py-2 rounded-lg transition text-sm"
                  title="Load more results"
                >
                  Shuffle
                </button>
              )}
            </div>

            {searched && results.length > 0 && (
              <div className="mb-3">
                <p className="text-xs text-gray-400 mb-2">
                  Select an image:
                  {(source === "imgur" || source === "commons") && (
                    <span className="text-gray-500 ml-1">
                      (page {shufflePage + 1})
                    </span>
                  )}
                </p>
                <div className="grid grid-cols-4 gap-2">
                  {results.map((r, i) => (
                    <button
                      key={i}
                      onClick={() =>
                        setSelectedUrl(selectedUrl === r.url ? null : r.url)
                      }
                      className={`aspect-square rounded overflow-hidden border-2 transition ${
                        selectedUrl === r.url
                          ? "border-blue-500 ring-1 ring-blue-500"
                          : "border-gray-700 hover:border-gray-500"
                      }`}
                      title={r.title}
                    >
                      <img
                        src={r.thumbnail}
                        alt={r.title}
                        className="w-full h-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {searched && results.length === 0 && (
              <p className="text-sm text-gray-500 mb-3">
                No images found. Try a different source or search term.
              </p>
            )}
          </>
        )}

        {/* Paste URL */}
        {source === "paste" && (
          <div className="mb-3">
            <input
              type="text"
              placeholder="https://example.com/image.png"
              value={pasteUrl}
              onChange={(e) => handlePasteUrlChange(e.target.value)}
              className="w-full bg-gray-800 text-white px-4 py-2 rounded-lg border border-gray-700 focus:border-blue-500 outline-none text-sm mb-2"
            />
            {pasteUrl.trim() && pasteValid === true && (
              <div className="flex items-center gap-3">
                <div className="w-16 h-16 overflow-hidden border-2 border-green-500 flex-shrink-0">
                  <img
                    src={pasteUrl.trim()}
                    alt="Preview"
                    className="w-full h-full object-cover"
                  />
                </div>
                <span className="text-xs text-green-400">Image loaded</span>
              </div>
            )}
            {pasteUrl.trim() && pasteValid === false && (
              <p className="text-xs text-red-400">
                Could not load image from this URL.
              </p>
            )}
          </div>
        )}

        <div className="flex gap-2 mt-4">
          <button
            onClick={onClose}
            className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 py-2.5 rounded-lg transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!title.trim()}
            className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white py-2.5 rounded-lg transition font-medium"
          >
            Add Item
          </button>
        </div>
      </div>
    </div>
  );
}
