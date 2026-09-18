CREATE INDEX `idx_booking_request_events_request` ON `booking_request_events` (`organisation_id`,`request_id`);--> statement-breakpoint
CREATE INDEX `idx_booking_requests_org_created` ON `booking_requests` (`organisation_id`,`created_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_booking_requests_org_reference` ON `booking_requests` (`organisation_id`,`reference`);--> statement-breakpoint
CREATE INDEX `idx_notification_outbox_org_status` ON `notification_outbox` (`organisation_id`,`status`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_organisation_members_org_user` ON `organisation_members` (`organisation_id`,`user_id`);