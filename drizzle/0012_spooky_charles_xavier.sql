CREATE TABLE `assignment_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`owner_id` text NOT NULL,
	`assignment_id` integer NOT NULL,
	`booking_id` integer NOT NULL,
	`driver_staff_id` text NOT NULL,
	`actor_email` text NOT NULL,
	`from_status` text DEFAULT '' NOT NULL,
	`to_status` text NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_assignment_events_assignment` ON `assignment_events` (`owner_id`,`assignment_id`);--> statement-breakpoint
CREATE TABLE `booking_assignments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`owner_id` text NOT NULL,
	`organisation_id` text NOT NULL,
	`booking_id` integer NOT NULL,
	`driver_staff_id` text NOT NULL,
	`status` text DEFAULT 'OFFERED' NOT NULL,
	`active` integer DEFAULT 1 NOT NULL,
	`driver_agreed_payment` real DEFAULT 0 NOT NULL,
	`payment_status` text DEFAULT 'PENDING' NOT NULL,
	`payment_date` text DEFAULT '' NOT NULL,
	`payment_notes` text DEFAULT '' NOT NULL,
	`offered_at` text NOT NULL,
	`acknowledged_at` text DEFAULT '' NOT NULL,
	`assigned_at` text DEFAULT '' NOT NULL,
	`completed_at` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_booking_assignments_booking` ON `booking_assignments` (`owner_id`,`booking_id`);--> statement-breakpoint
CREATE INDEX `idx_booking_assignments_driver` ON `booking_assignments` (`driver_staff_id`,`active`);--> statement-breakpoint
CREATE TABLE `driver_availability` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`owner_id` text NOT NULL,
	`organisation_id` text NOT NULL,
	`driver_staff_id` text NOT NULL,
	`unavailable_date` text NOT NULL,
	`full_day` integer DEFAULT 1 NOT NULL,
	`start_time` text DEFAULT '' NOT NULL,
	`end_time` text DEFAULT '' NOT NULL,
	`reason` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_driver_availability` ON `driver_availability` (`driver_staff_id`,`unavailable_date`);