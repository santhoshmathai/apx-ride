CREATE TABLE `profile_documents` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`owner_id` text NOT NULL,
	`organisation_id` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`field_name` text NOT NULL,
	`file_name` text NOT NULL,
	`content_type` text NOT NULL,
	`object_key` text NOT NULL,
	`uploaded_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_profile_documents_entity` ON `profile_documents` (`organisation_id`,`entity_type`,`entity_id`);--> statement-breakpoint
ALTER TABLE `driver_profiles` ADD `first_name` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `driver_profiles` ADD `surname` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `driver_profiles` ADD `address` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `driver_profiles` ADD `phd_badge_number` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `driver_profiles` ADD `dbs_status` text DEFAULT 'MISSING' NOT NULL;--> statement-breakpoint
ALTER TABLE `driver_profiles` ADD `right_to_work_status` text DEFAULT 'MISSING' NOT NULL;--> statement-breakpoint
ALTER TABLE `driver_profiles` ADD `visa_status` text DEFAULT 'NOT_REQUIRED' NOT NULL;--> statement-breakpoint
ALTER TABLE `driver_profiles` ADD `emergency_contact` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `driver_vehicles` ADD `vehicle_make` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `driver_vehicles` ADD `vehicle_model` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `driver_vehicles` ADD `vehicle_colour` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `driver_vehicles` ADD `vehicle_category` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `driver_vehicles` ADD `phv_badge_number` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `driver_vehicles` ADD `registered_keeper_address` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `driver_vehicles` ADD `insurance_valid_from` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `driver_vehicles` ADD `in_term_mot_date` text DEFAULT '' NOT NULL;--> statement-breakpoint
UPDATE `driver_profiles` SET `first_name`=`full_name` WHERE `first_name`='';
