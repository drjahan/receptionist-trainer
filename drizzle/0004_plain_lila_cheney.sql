CREATE TABLE `session_notes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sessionId` int NOT NULL,
	`userId` int NOT NULL,
	`subjective` text,
	`objective` text,
	`assessment` text,
	`plan` text,
	`freeText` text,
	`submittedAt` timestamp NOT NULL DEFAULT (now()),
	`notesFeedback` text,
	`notesScore` float,
	CONSTRAINT `session_notes_id` PRIMARY KEY(`id`),
	CONSTRAINT `session_notes_sessionId_unique` UNIQUE(`sessionId`)
);
--> statement-breakpoint
ALTER TABLE `scenarios` ADD `clinicalSystem` varchar(100);--> statement-breakpoint
ALTER TABLE `scenarios` ADD `complexityTier` int DEFAULT 1;--> statement-breakpoint
ALTER TABLE `scenarios` ADD `comorbidities` json DEFAULT ('[]');--> statement-breakpoint
ALTER TABLE `scenarios` ADD `hiddenCues` json DEFAULT ('[]');--> statement-breakpoint
ALTER TABLE `scenarios` ADD `iceElements` json;--> statement-breakpoint
ALTER TABLE `scores` ADD `iceElicitation` float;--> statement-breakpoint
ALTER TABLE `scores` ADD `cueDetection` float;--> statement-breakpoint
ALTER TABLE `scores` ADD `comorbidityReasoning` float;--> statement-breakpoint
ALTER TABLE `scores` ADD `documentationQuality` float;