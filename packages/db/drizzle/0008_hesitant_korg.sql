CREATE TABLE `log_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`log_id` text NOT NULL,
	`logged_at` text NOT NULL,
	`numeric_value` real,
	`data` text,
	`notes` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`log_id`) REFERENCES `logs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_log_entries_log_id` ON `log_entries` (`log_id`);--> statement-breakpoint
CREATE INDEX `idx_log_entries_logged_at` ON `log_entries` (`logged_at`);--> statement-breakpoint
CREATE TABLE `logs` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`description` text,
	`icon` text,
	`color` text,
	`is_built_in` integer DEFAULT false NOT NULL,
	`position` real DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `logs_slug_unique` ON `logs` (`slug`);--> statement-breakpoint
CREATE TABLE `occasions` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`date` text NOT NULL,
	`is_annual` integer DEFAULT true NOT NULL,
	`prep_window_days` integer DEFAULT 0 NOT NULL,
	`notes` text,
	`emoji` text,
	`position` real DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_occasions_date` ON `occasions` (`date`);--> statement-breakpoint
CREATE TABLE `subscriptions` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`amount` real NOT NULL,
	`billing_period` text NOT NULL,
	`next_due_date` text,
	`category` text,
	`auto_renew` integer DEFAULT true NOT NULL,
	`url` text,
	`notes` text,
	`is_active` integer DEFAULT true NOT NULL,
	`position` real DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_subscriptions_next_due_date` ON `subscriptions` (`next_due_date`);--> statement-breakpoint
CREATE INDEX `idx_subscriptions_is_active` ON `subscriptions` (`is_active`);