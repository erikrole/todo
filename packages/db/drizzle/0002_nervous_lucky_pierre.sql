CREATE INDEX `idx_projects_area_id` ON `projects` (`area_id`);--> statement-breakpoint
CREATE INDEX `idx_projects_is_completed` ON `projects` (`is_completed`);--> statement-breakpoint
CREATE INDEX `idx_tasks_project_id` ON `tasks` (`project_id`);--> statement-breakpoint
CREATE INDEX `idx_tasks_area_id` ON `tasks` (`area_id`);--> statement-breakpoint
CREATE INDEX `idx_tasks_parent_task_id` ON `tasks` (`parent_task_id`);--> statement-breakpoint
CREATE INDEX `idx_tasks_when_date` ON `tasks` (`when_date`);--> statement-breakpoint
CREATE INDEX `idx_tasks_is_completed` ON `tasks` (`is_completed`);--> statement-breakpoint
CREATE INDEX `idx_tasks_is_someday` ON `tasks` (`is_someday`);