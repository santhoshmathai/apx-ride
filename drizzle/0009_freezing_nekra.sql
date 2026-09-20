CREATE TABLE `portal_staff` (
	`id` text PRIMARY KEY NOT NULL,
	`organisation_id` text NOT NULL,
	`owner_id` text NOT NULL,
	`email` text NOT NULL,
	`role` text NOT NULL,
	`access_subject` text,
	`active` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_portal_staff_email` ON `portal_staff` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_portal_staff_access_subject` ON `portal_staff` (`access_subject`);--> statement-breakpoint
ALTER TABLE `bookings` ADD `assigned_driver_user_id` text;