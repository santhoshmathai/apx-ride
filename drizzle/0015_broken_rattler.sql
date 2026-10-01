CREATE TABLE `council_staff` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`owner_id` text NOT NULL,
	`organisation_id` text NOT NULL,
	`full_name` text NOT NULL,
	`email` text DEFAULT '' NOT NULL,
	`phone` text DEFAULT '' NOT NULL,
	`role_title` text DEFAULT 'Booking/dispatch staff' NOT NULL,
	`takes_bookings` integer DEFAULT 0 NOT NULL,
	`dispatches_vehicles` integer DEFAULT 0 NOT NULL,
	`start_date` text NOT NULL,
	`end_date` text DEFAULT '' NOT NULL,
	`dbs_sighted` integer DEFAULT 0 NOT NULL,
	`dbs_sighted_date` text DEFAULT '' NOT NULL,
	`dbs_certificate_date` text DEFAULT '' NOT NULL,
	`dbs_sighted_by` text DEFAULT '' NOT NULL,
	`suitability_decision` text DEFAULT 'PENDING' NOT NULL,
	`suitability_decision_date` text DEFAULT '' NOT NULL,
	`conviction_declaration_date` text DEFAULT '' NOT NULL,
	`training_notes` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'ACTIVE' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_council_staff_org` ON `council_staff` (`organisation_id`,`status`);