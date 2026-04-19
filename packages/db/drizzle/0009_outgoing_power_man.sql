ALTER TABLE `occasions` ADD `occasion_type` text DEFAULT 'event' NOT NULL;--> statement-breakpoint
ALTER TABLE `occasions` ADD `person_name` text;--> statement-breakpoint
ALTER TABLE `occasions` ADD `start_year` integer;