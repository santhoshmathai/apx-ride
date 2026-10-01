ALTER TABLE `bookings` ADD `booking_received_at` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `bookings` ADD `responded_by` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `bookings` ADD `responded_at` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `bookings` ADD `dispatched_by` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `bookings` ADD `dispatched_at` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `bookings` ADD `vehicle_registration` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `bookings` ADD `vehicle_licence` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `bookings` ADD `retention_until` text DEFAULT '' NOT NULL;--> statement-breakpoint
UPDATE `bookings` SET `booking_received_at`=`created_at`, `responded_by`='Legacy record - verify', `responded_at`=`created_at`, `retention_until`=strftime('%Y-%m-%dT%H:%M:%fZ',`pickup_at`,'+1 year') WHERE `booking_received_at`='';
