CREATE TABLE `driver_vehicle_assignments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`organisation_id` text NOT NULL,
	`owner_id` text NOT NULL,
	`driver_profile_id` text NOT NULL,
	`vehicle_id` text NOT NULL,
	`valid_from` text NOT NULL,
	`valid_until` text DEFAULT '' NOT NULL,
	`primary_vehicle` integer DEFAULT 0 NOT NULL,
	`active` integer DEFAULT 1 NOT NULL,
	`approved` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_driver_vehicle_assignment_driver` ON `driver_vehicle_assignments` (`organisation_id`,`driver_profile_id`);--> statement-breakpoint
CREATE INDEX `idx_driver_vehicle_assignment_vehicle` ON `driver_vehicle_assignments` (`organisation_id`,`vehicle_id`);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_driver_vehicles` (
	`id` text PRIMARY KEY NOT NULL,
	`organisation_id` text NOT NULL,
	`owner_id` text NOT NULL,
	`driver_profile_id` text DEFAULT '' NOT NULL,
	`registration` text DEFAULT '' NOT NULL,
	`make_model_colour` text DEFAULT '' NOT NULL,
	`vehicle_make` text DEFAULT '' NOT NULL,
	`vehicle_model` text DEFAULT '' NOT NULL,
	`vehicle_colour` text DEFAULT '' NOT NULL,
	`vehicle_category` text DEFAULT '' NOT NULL,
	`phv_badge_number` text DEFAULT '' NOT NULL,
	`registered_keeper_address` text DEFAULT '' NOT NULL,
	`insurance_valid_from` text DEFAULT '' NOT NULL,
	`in_term_mot_date` text DEFAULT '' NOT NULL,
	`private_hire_vehicle_licence_number` text DEFAULT '' NOT NULL,
	`private_hire_vehicle_licence_expiry` text DEFAULT '' NOT NULL,
	`mot_expiry` text DEFAULT '' NOT NULL,
	`insurance_expiry` text DEFAULT '' NOT NULL,
	`v5_document_status` text DEFAULT 'MISSING' NOT NULL,
	`approved` integer DEFAULT 0 NOT NULL,
	`active` integer DEFAULT 1 NOT NULL,
	`available_from` text DEFAULT '' NOT NULL,
	`available_until` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_driver_vehicles`("id", "organisation_id", "owner_id", "driver_profile_id", "registration", "make_model_colour", "vehicle_make", "vehicle_model", "vehicle_colour", "vehicle_category", "phv_badge_number", "registered_keeper_address", "insurance_valid_from", "in_term_mot_date", "private_hire_vehicle_licence_number", "private_hire_vehicle_licence_expiry", "mot_expiry", "insurance_expiry", "v5_document_status", "approved", "active", "available_from", "available_until", "created_at", "updated_at") SELECT "id", "organisation_id", "owner_id", "driver_profile_id", "registration", "make_model_colour", "vehicle_make", "vehicle_model", "vehicle_colour", "vehicle_category", "phv_badge_number", "registered_keeper_address", "insurance_valid_from", "in_term_mot_date", "private_hire_vehicle_licence_number", "private_hire_vehicle_licence_expiry", "mot_expiry", "insurance_expiry", "v5_document_status", "approved", "active", '', '', "created_at", "updated_at" FROM `driver_vehicles`;--> statement-breakpoint
DROP TABLE `driver_vehicles`;--> statement-breakpoint
ALTER TABLE `__new_driver_vehicles` RENAME TO `driver_vehicles`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `idx_driver_vehicles_profile` ON `driver_vehicles` (`driver_profile_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_driver_vehicles_registration` ON `driver_vehicles` (`organisation_id`,`registration`);--> statement-breakpoint
INSERT INTO `driver_vehicle_assignments` (`organisation_id`,`owner_id`,`driver_profile_id`,`vehicle_id`,`valid_from`,`valid_until`,`primary_vehicle`,`active`,`approved`,`created_at`,`updated_at`)
SELECT `organisation_id`,`owner_id`,`driver_profile_id`,`id`,substr(`created_at`,1,10),'',1,`active`,`approved`,`created_at`,`updated_at` FROM `driver_vehicles` WHERE `driver_profile_id`<>'';
