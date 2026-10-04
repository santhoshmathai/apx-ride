ALTER TABLE `notification_outbox` ADD `attachment_object_key` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `notification_outbox` ADD `attachment_filename` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `notification_outbox` ADD `attachment_content_type` text DEFAULT '' NOT NULL;
