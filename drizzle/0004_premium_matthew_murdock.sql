CREATE TABLE `compliance_documents` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`owner_id` text NOT NULL,
	`record_id` integer NOT NULL,
	`field_name` text NOT NULL,
	`file_name` text NOT NULL,
	`content_type` text NOT NULL,
	`object_key` text NOT NULL,
	`uploaded_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `message_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`owner_id` text NOT NULL,
	`booking_id` integer NOT NULL,
	`channel` text NOT NULL,
	`recipient` text NOT NULL,
	`message` text NOT NULL,
	`status` text NOT NULL,
	`actor_email` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `record_revisions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`owner_id` text NOT NULL,
	`record_id` integer NOT NULL,
	`revision_number` integer NOT NULL,
	`snapshot_json` text NOT NULL,
	`actor_email` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `unavailable_periods` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`owner_id` text NOT NULL,
	`unavailable_date` text NOT NULL,
	`full_day` integer DEFAULT true NOT NULL,
	`start_time` text DEFAULT '' NOT NULL,
	`end_time` text DEFAULT '' NOT NULL,
	`reason` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
ALTER TABLE `bookings` ADD `driver_call_sign` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `bookings` ADD `driver_name` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `bookings` ADD `driver_licence` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `expenses` ADD `driver_call_sign` text DEFAULT '' NOT NULL;