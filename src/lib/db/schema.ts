import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull().default("Anonymous"),
  passwordHash: text("password_hash").notNull(),
  resetToken: text("reset_token"),
  resetTokenExpiresAt: integer("reset_token_expires_at"),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(
    () => new Date()
  ),
});

export const tierLists = sqliteTable("tier_lists", {
  id: text("id").primaryKey(),
  title: text("title").notNull().default("My Tier List"),
  creatorName: text("creator_name").notNull().default("Anonymous"),
  editPasswordHash: text("edit_password_hash").notNull(),
  ownerId: text("owner_id").references(() => users.id),
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
  code: text("code").notNull().unique(),
  tierListId: text("tier_list_id")
    .notNull()
    .references(() => tierLists.id, { onDelete: "cascade" }),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(
    () => new Date()
  ),
});

export const liveSessionUsers = sqliteTable("live_session_users", {
  id: text("id").primaryKey(),
  sessionId: text("session_id")
    .notNull()
    .references(() => liveSessions.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  lastSeenAt: integer("last_seen_at").notNull(),
  draggingItemId: text("dragging_item_id"),
});
