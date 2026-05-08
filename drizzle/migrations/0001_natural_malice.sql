ALTER TABLE `workout_sessions` ADD `is_custom` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `workout_sessions` ADD `custom_exercises` text;