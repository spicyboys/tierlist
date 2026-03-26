export const runtime = "edge";

import { NextRequest, NextResponse } from "next/server";

interface SearchResult {
  url: string;
  thumbnail: string;
  title: string;
}

/* eslint-disable @typescript-eslint/no-explicit-any */

const UA = "TierMaker/1.0 (tierlist app)";

// --- Wikipedia ---
async function wikiSummary(title: string): Promise<SearchResult | null> {
  try {
    const res = await fetch(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`,
      { headers: { "User-Agent": UA } }
    );
    if (!res.ok) return null;
    const d = (await res.json()) as any;
    const url = d.originalimage?.source || d.thumbnail?.source;
    if (!url) return null;
    return { url, thumbnail: d.thumbnail?.source || url, title: d.title || title };
  } catch {
    return null;
  }
}

async function wikiSearch(query: string): Promise<SearchResult[]> {
  const results: SearchResult[] = [];
  try {
    const res = await fetch(
      `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&srlimit=5&origin=*`,
      { headers: { "User-Agent": UA } }
    );
    if (!res.ok) return results;
    const data = (await res.json()) as any;
    const pages = data.query?.search || [];
    const fetched = await Promise.all(pages.map((p: any) => wikiSummary(p.title)));
    for (const r of fetched) {
      if (r) results.push(r);
    }
  } catch { /* ignore */ }
  return results;
}

// --- Wikimedia Commons ---
async function commonsSearch(query: string, page = 0): Promise<SearchResult[]> {
  const results: SearchResult[] = [];
  try {
    const offset = page * 12;
    // Search in File namespace (ns 6) for actual images
    const res = await fetch(
      `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(query)}&gsrnamespace=6&gsrlimit=12&gsroffset=${offset}&prop=imageinfo&iiprop=url|mime&iiurlwidth=300&format=json&origin=*`,
      { headers: { "User-Agent": UA } }
    );
    if (!res.ok) return results;
    const data = (await res.json()) as any;
    const pages = data.query?.pages || {};
    for (const page of Object.values(pages) as any[]) {
      const info = page.imageinfo?.[0];
      if (!info) continue;
      const mime = info.mime || "";
      if (!mime.startsWith("image/")) continue;
      // Skip SVG since they often don't render well as thumbnails
      if (mime === "image/svg+xml") continue;
      results.push({
        url: info.url,
        thumbnail: info.thumburl || info.url,
        title: (page.title || "").replace("File:", ""),
      });
    }
  } catch { /* ignore */ }
  return results;
}

// --- Imgur ---
async function imgurSearch(query: string, page = 0): Promise<SearchResult[]> {
  const results: SearchResult[] = [];
  try {
    const res = await fetch(
      `https://api.imgur.com/3/gallery/search/top/${page}?q=${encodeURIComponent(query)}`,
      {
        headers: {
          Authorization: "Client-ID 546c25a59c58ad7",
          "User-Agent": UA,
        },
      }
    );
    if (!res.ok) return results;
    const data = (await res.json()) as any;
    const items = data.data || [];
    for (const item of items.slice(0, 12)) {
      if (item.is_album && item.images?.length > 0) {
        const img = item.images[0];
        if (img.type?.startsWith("image/")) {
          results.push({
            url: img.link,
            thumbnail: img.link.replace(/(\.\w+)$/, "m$1"),
            title: item.title || query,
          });
        }
      } else if (item.link && item.type?.startsWith("image/")) {
        results.push({
          url: item.link,
          thumbnail: item.link.replace(/(\.\w+)$/, "m$1"),
          title: item.title || query,
        });
      }
    }
  } catch { /* ignore */ }
  return results;
}

export async function POST(req: NextRequest) {
  const { query, source, page } = (await req.json()) as {
    query?: string;
    source?: string;
    page?: number;
  };

  if (!query || typeof query !== "string") {
    return NextResponse.json({ error: "Query required" }, { status: 400 });
  }

  const seenUrls = new Set<string>();
  const dedupe = (r: SearchResult[]) =>
    r.filter((item) => {
      if (seenUrls.has(item.url)) return false;
      seenUrls.add(item.url);
      return true;
    });

  let results: SearchResult[] = [];

  switch (source) {
    case "commons": {
      results = dedupe(await commonsSearch(query, page || 0)).slice(0, 12);
      break;
    }
    case "imgur": {
      results = dedupe(await imgurSearch(query, page || 0)).slice(0, 12);
      break;
    }
    case "wikipedia":
    default: {
      const direct = await wikiSummary(query);
      if (direct) results.push(direct);
      const searched = await wikiSearch(query);
      results = dedupe([...results, ...searched]).slice(0, 5);
      break;
    }
  }

  return NextResponse.json({ results });
}
