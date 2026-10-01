ALTER TABLE `driver_availability` ADD `unavailable_until` text DEFAULT '' NOT NULL;--> statement-breakpoint
UPDATE `driver_availability` SET `unavailable_until`=`unavailable_date` WHERE `unavailable_until`='';
