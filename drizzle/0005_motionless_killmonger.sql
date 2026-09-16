ALTER TABLE `bookings` ADD `base_fare` real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `bookings` ADD `airport_fee` real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `bookings` ADD `toll_fee` real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `bookings` ADD `tariff` text DEFAULT 'day' NOT NULL;--> statement-breakpoint
ALTER TABLE `settings` ADD `message_templates_json` text DEFAULT '{}' NOT NULL;