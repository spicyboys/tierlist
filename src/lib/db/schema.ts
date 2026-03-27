import { sqliteTable, text, integer, primaryKey } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  username: text("username").notNull(),
});

export const tierLists = sqliteTable("tier_lists", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  ownerId: text("owner_id").notNull().references(() => users.id),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(
    () => new Date()
  ),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(
    () => new Date()
  ),
});

export const tiers = sqliteTable("tiers", {
  id: text("id").primaryKey(),
  label: text("label").notNull(),
  color: text("color").notNull(),
  order: integer("order").notNull(),
  tierListId: text("tier_list_id")
    .notNull()
    .references(() => tierLists.id, { onDelete: "cascade" }),
});

export const items = sqliteTable("items", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  imageUrl: text("image_url"),
  order: integer("order").notNull(),
  tierId: text("tier_id").references(() => tiers.id, { onDelete: "cascade" }),
  tierListId: text("tier_list_id")
    .notNull()
    .references(() => tierLists.id, { onDelete: "cascade" }),
  isUnsorted: integer("is_unsorted", { mode: "boolean" })
    .notNull()
    .default(true),
});

export const liveSessions = sqliteTable("live_sessions", {
  id: text("id").primaryKey(),
  tierListId: text("tier_list_id")
    .notNull()
    .references(() => tierLists.id, { onDelete: "cascade" })
    .unique(),
  discordGuildId: text("discord_guild_id"),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(
    () => new Date()
  ),
});

export const liveSessionUsers = sqliteTable("live_session_users", {
  userId: text("user_id").
    notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  sessionId: text("session_id")
    .notNull()
    .references(() => liveSessions.id, { onDelete: "cascade" }),
  lastSeenAt: integer("last_seen_at").notNull(),
  draggingItemId: text("dragging_item_id"),
}, (table) => [
  primaryKey({ columns: [table.userId, table.sessionId] })
]);
