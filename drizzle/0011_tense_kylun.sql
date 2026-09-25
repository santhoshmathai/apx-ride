CREATE TABLE `driver_profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`organisation_id` text NOT NULL,
	`owner_id` text NOT NULL,
	`staff_id` text NOT NULL,
	`full_name` text DEFAULT '' NOT NULL,
	`phone` text DEFAULT '' NOT NULL,
	`licensing_authority` text DEFAULT '' NOT NULL,
	`private_hire_licence_number` text DEFAULT '' NOT NULL,
	`private_hire_licence_expiry` text DEFAULT '' NOT NULL,
	`dvla_licence_number` text DEFAULT '' NOT NULL,
	`dvla_licence_expiry` text DEFAULT '' NOT NULL,
	`address_evidence_status` text DEFAULT 'MISSING' NOT NULL,
	`active` integer DEFAULT 1 NOT NULL,
	`approved_for_assignment` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_driver_profiles_staff` ON `driver_profiles` (`staff_id`);--> statement-breakpoint
CREATE TABLE `driver_vehicles` (
	`id` text PRIMARY KEY NOT NULL,
	`organisation_id` text NOT NULL,
	`owner_id` text NOT NULL,
	`driver_profile_id` text NOT NULL,
	`registration` text DEFAULT '' NOT NULL,
	`make_model_colour` text DEFAULT '' NOT NULL,
	`private_hire_vehicle_licence_number` text DEFAULT '' NOT NULL,
	`private_hire_vehicle_licence_expiry` text DEFAULT '' NOT NULL,
	`mot_expiry` text DEFAULT '' NOT NULL,
	`insurance_expiry` text DEFAULT '' NOT NULL,
	`v5_document_status` text DEFAULT 'MISSING' NOT NULL,
	`approved` integer DEFAULT 0 NOT NULL,
	`active` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_driver_vehicles_profile` ON `driver_vehicles` (`driver_profile_id`);