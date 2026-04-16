CREATE TABLE `task_completions` (
	`id` text PRIMARY KEY NOT NULL,
	`task_id` text NOT NULL,
	`completed_at` text NOT NULL,
	`interval_actual` real,
	`notes` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_task_completions_task_id` ON `task_completions` (`task_id`);--> statement-breakpoint
CREATE INDEX `idx_task_completions_completed_at` ON `task_completions` (`completed_at`);