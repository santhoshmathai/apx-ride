ALTER TABLE `booking_assignments` ADD `vehicle_id` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `booking_assignments` ADD `driver_name_snapshot` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `booking_assignments` ADD `driver_licence_snapshot` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `booking_assignments` ADD `vehicle_registration_snapshot` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `booking_assignments` ADD `vehicle_licence_snapshot` text DEFAULT '' NOT NULL;
--> statement-breakpoint
UPDATE `booking_assignments`
SET `driver_name_snapshot`=COALESCE((SELECT `full_name` FROM `driver_profiles` WHERE `staff_id`=`booking_assignments`.`driver_staff_id` LIMIT 1),''),
    `driver_licence_snapshot`=COALESCE((SELECT `private_hire_licence_number` FROM `driver_profiles` WHERE `staff_id`=`booking_assignments`.`driver_staff_id` LIMIT 1),''),
    `vehicle_id`=COALESCE((SELECT `id` FROM `driver_vehicles` WHERE `registration`=(SELECT `vehicle_registration` FROM `bookings` WHERE `id`=`booking_assignments`.`booking_id`) AND `owner_id`=`booking_assignments`.`owner_id` LIMIT 1),''),
    `vehicle_registration_snapshot`=COALESCE((SELECT `vehicle_registration` FROM `bookings` WHERE `id`=`booking_assignments`.`booking_id`),''),
    `vehicle_licence_snapshot`=COALESCE((SELECT `vehicle_licence` FROM `bookings` WHERE `id`=`booking_assignments`.`booking_id`),'');
