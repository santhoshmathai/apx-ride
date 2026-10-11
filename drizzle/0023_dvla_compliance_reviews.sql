ALTER TABLE `driver_profiles` ADD `dvla_share_code` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `driver_profiles` ADD `dvla_check_completed_at` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `driver_profiles` ADD `dvla_next_check_due` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `driver_profiles` ADD `dvla_review_interval_months` integer DEFAULT 3 NOT NULL;
--> statement-breakpoint
CREATE TABLE `compliance_alerts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`organisation_id` text NOT NULL,
	`owner_id` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`entity_label` text NOT NULL,
	`document_type` text NOT NULL,
	`due_date` text NOT NULL,
	`severity` text NOT NULL,
	`alert_key` text NOT NULL,
	`status` text DEFAULT 'OPEN' NOT NULL,
	`first_alerted_at` text NOT NULL,
	`last_checked_at` text NOT NULL,
	`resolved_at` text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_compliance_alert_key` ON `compliance_alerts` (`alert_key`);
--> statement-breakpoint
CREATE INDEX `idx_compliance_alerts_org_status` ON `compliance_alerts` (`organisation_id`,`status`,`due_date`);
