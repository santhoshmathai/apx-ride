CREATE TABLE `audit_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`owner_id` text NOT NULL,
	`actor_email` text NOT NULL,
	`action` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`summary` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `compliance_records` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`owner_id` text NOT NULL,
	`record_type` text NOT NULL,
	`reference` text NOT NULL,
	`event_date` text NOT NULL,
	`status` text NOT NULL,
	`data_json` text NOT NULL,
	`retention_until` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
ALTER TABLE `settings` ADD `operators_json` text DEFAULT '["APX RIDE"]' NOT NULL;--> statement-breakpoint
ALTER TABLE `settings` ADD `rates_json` text DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE `settings` ADD `time_format` text DEFAULT '24' NOT NULL;