# TierMaker Clone - Build Prompt

Build a full-stack web application that lets users create, edit, and share tier lists (similar to tiermaker.com). Keep the design clean and minimal. Use **Next.js 14 (App Router)**, **TypeScript**, **Tailwind CSS**, **Prisma** with **SQLite**, and **NextAuth.js** for Google login. Use **Socket.IO** for real-time collaboration.

---

## Tech Stack

- **Frontend:** Next.js 14 (App Router), TypeScript, Tailwind CSS
- **Drag & Drop:** `@dnd-kit/core` + `@dnd-kit/sortable`
- **Auth:** NextAuth.js with Google provider (only tier list owners need to log in)
- **Database:** Prisma + SQLite (file-based, no external DB needed)
- **Real-time:** Socket.IO (embedded in a custom Next.js server)
- **Image Lookup:** Two methods for adding images to items: (1) paste any image URL directly, or (2) auto-fetch from Wikipedia/Wikimedia Commons API (free, no API key needed). Store the selected image URL on the object.

---

## Core Features

### 1. Tier List Editor

- A tier list has a **title** and an ordered list of **tiers**.
- Each tier has a **label** (e.g., S, A, B, C, D, F), a **color**, and an ordered list of **items**.
- Default tiers on creation: S (red), A (orange), B (yellow), C (green), D (blue), F (gray).
- Users can **add new tiers**, **remove tiers**, and **rename tier labels**.
- Users can **reorder tiers** (move a tier up or down in the ranking).

### 2. Items / Objects

- Each item has a **title** (text) and an optional **image URL**.
- Users can **add items** to any tier or to an "unsorted" pool at the bottom.
- Users can **remove items**.
- When adding an item, the user types a title. They have **two ways** to attach an image:

  **Option A — "Find image from Wikipedia" (default):**
  - A button labeled "Find Image" (or similar) calls an API route that queries the **Wikipedia API** using the item's title.
  - The API route uses the Wikipedia REST API (`/api/rest_v1/page/summary/{title}`) to fetch the page summary, which includes a `thumbnail` and `originalimage` field.
  - If a direct match isn't found, fall back to the **Wikipedia search endpoint** (`/w/api.php?action=query&list=search&srsearch={title}`) to find the top 3 matching pages, then fetch each page's summary to get images.
  - Display up to **5 image results** as clickable thumbnails. The user clicks one to select it.
  - The selected image's Wikimedia URL is stored on the item.
  - This requires **no API key** — the Wikipedia/Wikimedia API is free and open.

  **Option B — "Paste image URL":**
  - A text input where the user can paste any image URL from the web.
  - Show a small preview of the pasted URL to confirm it loads correctly.
  - On confirm, the URL is stored on the item.

  - If the user skips both options, the item displays with a text-only placeholder.
- Items display as square tiles showing the image (or a text fallback) with the title below or overlaid.

### 3. Drag and Drop

- Items can be **dragged between tiers** (including to/from the unsorted pool).
- Items can be **reordered within a tier** (ranked left to right).
- Use `@dnd-kit` for accessible, performant drag-and-drop.
- Visual feedback: show a drop indicator when dragging over a valid target.

### 4. Authentication (Google Login)

- Use NextAuth.js with the Google OAuth provider.
- Only the **owner** of a tier list needs to be logged in.
- Logged-in users see a dashboard of their saved tier lists.
- Unauthenticated users can still participate in live sessions as guests (no login required).

### 5. Saving Tier Lists

- Logged-in users can **save** their tier list to the database.
- Saved tier lists appear on the user's **dashboard** (list view with title, last modified date).
- Users can **load, edit, and delete** saved tier lists.
- Auto-save is NOT required — provide an explicit "Save" button.

### 6. Live Collaboration Sessions

- The tier list owner can click **"Start Live Session"** which:
  - Generates a short random **session code** (e.g., 6 alphanumeric characters).
  - Produces a **shareable URL** like `/live/ABC123`.
  - Starts a Socket.IO room for that session.
- **Guests** visit the URL or enter the code on the homepage to join. No login required.
- Guest behavior in a live session:
  - Guests can **add new items** (with title and optional image search).
  - Guests can **move items between tiers** and **reorder items within tiers**.
  - Guests **cannot** add/remove/rename tiers (only the owner can modify tier structure).
- All changes sync in **real-time** via Socket.IO to all participants.
- The owner can **end the session** at any time. When ended, guests see a "session ended" message.
- The owner's tier list state is updated live and can be saved at any time.

---

## Data Model (Prisma Schema)

```prisma
model User {
  id            String      @id @default(cuid())
  name          String?
  email         String?     @unique
  image         String?
  accounts      Account[]
  sessions      Session[]
  tierLists     TierList[]
}

model TierList {
  id            String      @id @default(cuid())
  title         String      @default("My Tier List")
  userId        String
  user          User        @relation(fields: [userId], references: [id])
  tiers         Tier[]
  createdAt     DateTime    @default(now())
  updatedAt     DateTime    @updatedAt
}

model Tier {
  id            String      @id @default(cuid())
  label         String
  color         String
  order         Int
  tierListId    String
  tierList      TierList    @relation(fields: [tierListId], references: [id], onDelete: Cascade)
  items         Item[]
}

model Item {
  id            String      @id @default(cuid())
  title         String
  imageUrl      String?
  order         Int
  tierId        String?
  tier          Tier?       @relation(fields: [tierId], references: [id], onDelete: Cascade)
  tierListId    String
  isUnsorted    Boolean     @default(true)
}

// NextAuth models (Account, Session, VerificationToken) — include standard NextAuth schema
```

---

## API Routes

- `POST /api/tierlist` — Create a new tier list (auth required)
- `GET /api/tierlist` — List user's tier lists (auth required)
- `GET /api/tierlist/[id]` — Get a tier list by ID
- `PUT /api/tierlist/[id]` — Update a tier list (auth required, owner only)
- `DELETE /api/tierlist/[id]` — Delete a tier list (auth required, owner only)
- `POST /api/image-search` — Search Wikipedia for images by query string. Uses the Wikipedia REST API to find page summaries with images. Returns up to 5 results with thumbnail URLs. No API key needed.
- `POST /api/live/create` — Create a live session (generates code, returns session info)
- `GET /api/live/[code]` — Get live session info (validates code is active)

---

## Pages

- `/` — Homepage: hero section with "Create Tier List" button + session code input to join a live session. If logged in, show link to dashboard.
- `/dashboard` — User's saved tier lists (protected, requires login).
- `/editor/[id]` — Tier list editor (loads from DB if saved, or creates a new unsaved one).
- `/editor/new` — New blank tier list editor (no ID yet, save creates one).
- `/live/[code]` — Join a live session as a guest. Shows the live tier list editor with guest permissions.
- `/login` — Sign in with Google.

---

## UI/UX Guidelines

- Clean, modern, minimal design. Dark mode by default with a light mode toggle.
- Tiers render as horizontal rows. Each row has the tier label (colored) on the left and items flowing horizontally to the right.
- The unsorted pool sits at the bottom as a grid/row of unranked items.
- Items are ~80x80px square tiles. Image fills the tile; title overlays at the bottom in a semi-transparent bar.
- Drag handles should be intuitive — the whole item tile is draggable.
- Mobile-friendly: tiers stack vertically, items wrap within tiers.
- Use toast notifications for save confirmations, errors, and session events (guest joined, session ended).

---

## Implementation Notes

- For the custom server with Socket.IO, create a `server.ts` that wraps the Next.js app and attaches Socket.IO. Run with `ts-node server.ts` or compile and run.
- Socket.IO events:
  - `join-session` — client joins a room by session code
  - `item-added` — broadcast new item to all clients
  - `item-moved` — broadcast item move (new tier, new order) to all clients
  - `tier-updated` — broadcast tier changes (owner only)
  - `session-ended` — owner ends session, notify all clients
- For the Wikipedia image search API route, use the following endpoints (no API key required):
  - **Direct lookup:** `https://en.wikipedia.org/api/rest_v1/page/summary/{title}` — returns `thumbnail.source` and `originalimage.source` if the page has an image.
  - **Search fallback:** `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch={query}&format=json&srlimit=5` — returns matching page titles, then fetch each page's summary for images.
  - **Page images:** `https://en.wikipedia.org/w/api.php?action=query&titles={title}&prop=pageimages&format=json&pithumbsize=300` — another way to get thumbnails.
  - Combine results and return up to 5 unique image URLs to the client.
  - Handle edge cases: no results, disambiguation pages, pages without images.
- Generate session codes using `nanoid` (6 chars, alphanumeric, uppercase).
- Store active live sessions in memory on the server (no need to persist them in DB — they're ephemeral).

---

## Environment Variables Needed

```env
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
NEXTAUTH_SECRET=
NEXTAUTH_URL=http://localhost:3000
```

Note: No API keys are needed for image search — the Wikipedia/Wikimedia API is free and open.

---

## Getting Started

1. `npm install`
2. Copy `.env.example` to `.env` and fill in Google OAuth credentials.
3. `npx prisma db push` to create the SQLite database.
4. `npm run dev` to start the development server.

Build the entire application. Start with the data model and API routes, then build the editor UI with drag-and-drop, then add auth and saving, and finally add live sessions with Socket.IO.
