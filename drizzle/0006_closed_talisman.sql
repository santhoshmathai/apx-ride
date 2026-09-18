CREATE TABLE `booking_request_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`organisation_id` text NOT NULL,
	`request_id` integer NOT NULL,
	`actor_email` text NOT NULL,
	`event_type` text NOT NULL,
	`from_status` text DEFAULT '' NOT NULL,
	`to_status` text NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `booking_requests` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`organisation_id` text NOT NULL,
	`owner_id` text NOT NULL,
	`reference` text NOT NULL,
	`passenger_name` text NOT NULL,
	`email` text NOT NULL,
	`phone` text NOT NULL,
	`pickup` text NOT NULL,
	`dropoff` text NOT NULL,
	`pickup_at` text NOT NULL,
	`passengers` integer DEFAULT 1 NOT NULL,
	`large_bags` integer DEFAULT 0 NOT NULL,
	`small_bags` integer DEFAULT 0 NOT NULL,
	`fleet_tier` text DEFAULT 'Saloon' NOT NULL,
	`quoted_fare` real DEFAULT 0 NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`source` text DEFAULT 'PORTAL' NOT NULL,
	`status` text DEFAULT 'RECEIVED' NOT NULL,
	`decision_reason` text DEFAULT '' NOT NULL,
	`assigned_booking_id` integer,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`decided_at` text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `notification_deliveries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`organisation_id` text NOT NULL,
	`outbox_id` integer NOT NULL,
	`provider` text NOT NULL,
	`provider_message_id` text DEFAULT '' NOT NULL,
	`status` text NOT NULL,
	`detail` text DEFAULT '' NOT NULL,
	`occurred_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `notification_outbox` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`organisation_id` text NOT NULL,
	`request_id` integer NOT NULL,
	`booking_id` integer,
	`channel` text DEFAULT 'EMAIL' NOT NULL,
	`recipient` text NOT NULL,
	`template_key` text NOT NULL,
	`subject` text NOT NULL,
	`message` text NOT NULL,
	`status` text DEFAULT 'PREPARED' NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`last_error` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL,
	`sent_at` text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `organisation_members` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`organisation_id` text NOT NULL,
	`user_id` text NOT NULL,
	`email` text NOT NULL,
	`role` text DEFAULT 'OWNER' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `organisations` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`owner_user_id` text NOT NULL,
	`owner_email` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `public_booking_settings` (
	`organisation_id` text PRIMARY KEY NOT NULL,
	`public_key` text NOT NULL,
	`public_bookings_enabled` integer DEFAULT false NOT NULL,
	`acknowledgement_template` text DEFAULT '' NOT NULL,
	`confirmation_template` text DEFAULT '' NOT NULL,
	`unavailable_template` text DEFAULT '' NOT NULL,
	`cancellation_template` text DEFAULT '' NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
ALTER TABLE `bookings` ADD `customer_email` text DEFAULT '' NOT NULL;