CREATE TABLE `sections` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`title` text NOT NULL,
	`position` real DEFAULT 0 NOT NULL,
	`is_collapsed` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_sections_project_id` ON `sections` (`project_id`);--> statement-breakpoint
ALTER TABLE `projects` ADD `parent_project_id` text REFERENCES projects(id);--> statement-breakpoint
CREATE INDEX `idx_projects_parent_project_id` ON `projects` (`parent_project_id`);--> statement-breakpoint
ALTER TABLE `tasks` ADD `section_id` text REFERENCES sections(id);--> statement-breakpoint
CREATE INDEX `idx_tasks_section_id` ON `tasks` (`section_id`);