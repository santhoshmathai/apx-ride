ALTER TABLE `booking_assignments` ADD `collection_method` text DEFAULT 'NONE' NOT NULL;--> statement-breakpoint
ALTER TABLE `booking_assignments` ADD `collection_status` text DEFAULT 'NOT_COLLECTED' NOT NULL;--> statement-breakpoint
ALTER TABLE `booking_assignments` ADD `collected_at` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `booking_assignments` ADD `receipt_number` text DEFAULT '' NOT NULL;