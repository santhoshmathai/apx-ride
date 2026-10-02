ALTER TABLE `booking_requests` ADD `hirer_name` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `booking_requests` ADD `responded_by` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `driver_profiles` ADD `medical_exemption` integer DEFAULT 0 NOT NULL;
