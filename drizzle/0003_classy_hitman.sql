ALTER TABLE `scenarios` ADD `mode` enum('receptionist','gp','pharmacist') DEFAULT 'receptionist' NOT NULL;--> statement-breakpoint
ALTER TABLE `scenarios` ADD `clinicalSystem` varchar(100);--> statement-breakpoint
ALTER TABLE `scores` ADD `googleReviewOffer` float DEFAULT 1 NOT NULL;