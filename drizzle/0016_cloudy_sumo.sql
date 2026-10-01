ALTER TABLE `bookings` ADD `hirer_name` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `unavailable_periods` ADD `unavailable_until` text DEFAULT '' NOT NULL;--> statement-breakpoint
UPDATE `bookings` SET `hirer_name`=`passenger_name` WHERE `hirer_name`='';--> statement-breakpoint
UPDATE `unavailable_periods` SET `unavailable_until`=`unavailable_date` WHERE `unavailable_until`='';
