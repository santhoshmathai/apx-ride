ALTER TABLE `notification_deliveries` ADD `event_id` text DEFAULT '' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `idx_notification_deliveries_event` ON `notification_deliveries` (`event_id`);--> statement-breakpoint
CREATE INDEX `idx_notification_deliveries_outbox` ON `notification_deliveries` (`organisation_id`,`outbox_id`);--> statement-breakpoint
ALTER TABLE `notification_outbox` ADD `provider_message_id` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `notification_outbox` ADD `copy_to` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `notification_outbox` ADD `next_attempt_at` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `notification_outbox` ADD `last_attempt_at` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `public_booking_settings` ADD `notification_copy_email` text DEFAULT 'apxride.bookings@gmail.com' NOT NULL;--> statement-breakpoint
ALTER TABLE `public_booking_settings` ADD `sender_name` text DEFAULT 'APX RIDE' NOT NULL;--> statement-breakpoint
ALTER TABLE `public_booking_settings` ADD `sender_email` text DEFAULT 'bookings@notifications.apxride.com' NOT NULL;--> statement-breakpoint
ALTER TABLE `public_booking_settings` ADD `reply_to_email` text DEFAULT 'apxride.bookings@gmail.com' NOT NULL;