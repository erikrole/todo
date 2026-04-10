ALTER TABLE `tasks` ADD `is_cancelled` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `tasks` ADD `deleted_at` text;--> statement-breakpoint
CREATE INDEX `idx_tasks_is_cancelled` ON `tasks` (`is_cancelled`);--> statement-breakpoint
CREATE INDEX `idx_tasks_deleted_at` ON `tasks` (`deleted_at`);