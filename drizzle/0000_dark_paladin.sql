CREATE TABLE `bookings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`owner_id` text NOT NULL,
	`passenger_name` text NOT NULL,
	`phone` text DEFAULT '' NOT NULL,
	`pickup` text NOT NULL,
	`dropoff` text NOT NULL,
	`pickup_at` text NOT NULL,
	`operator` text DEFAULT 'APX RIDE' NOT NULL,
	`passengers` integer DEFAULT 1 NOT NULL,
	`large_bags` integer DEFAULT 0 NOT NULL,
	`small_bags` integer DEFAULT 0 NOT NULL,
	`fleet_tier` text DEFAULT 'Saloon' NOT NULL,
	`distance` real DEFAULT 0 NOT NULL,
	`fare` real DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'upcoming' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`owner_id` text PRIMARY KEY NOT NULL,
	`fare_model` text DEFAULT 'A' NOT NULL,
	`fuel_per_100` real DEFAULT 50 NOT NULL,
	`include_fuel` integer DEFAULT true NOT NULL,
	`review_url` text DEFAULT '' NOT NULL,
	`updated_at` text NOT NULL
);
