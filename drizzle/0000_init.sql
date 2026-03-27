CREATE TABLE `items` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`image_url` text,
	`order` integer NOT NULL,
	`tier_id` text,
	`tier_list_id` text NOT NULL,
	`is_unsorted` integer DEFAULT true NOT NULL,
	FOREIGN KEY (`tier_id`) REFERENCES `tiers`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tier_list_id`) REFERENCES `tier_lists`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `live_session_users` (
	`user_id` text NOT NULL,
	`session_id` text NOT NULL,
	`last_seen_at` integer NOT NULL,
	`dragging_item_id` text,
	PRIMARY KEY(`user_id`, `session_id`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`session_id`) REFERENCES `live_sessions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `live_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`tier_list_id` text NOT NULL,
	`created_at` integer,
	FOREIGN KEY (`tier_list_id`) REFERENCES `tier_lists`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `tier_lists` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`owner_id` text NOT NULL,
	`created_at` integer,
	`updated_at` integer,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `tiers` (
	`id` text PRIMARY KEY NOT NULL,
	`label` text NOT NULL,
	`color` text NOT NULL,
	`order` integer NOT NULL,
	`tier_list_id` text NOT NULL,
	FOREIGN KEY (`tier_list_id`) REFERENCES `tier_lists`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`username` text NOT NULL
);
