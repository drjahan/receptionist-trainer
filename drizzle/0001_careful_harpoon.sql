CREATE TABLE `messages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sessionId` int NOT NULL,
	`role` enum('user','assistant') NOT NULL,
	`content` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `scenarios` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(255) NOT NULL,
	`category` varchar(100) NOT NULL,
	`difficulty` enum('beginner','intermediate','advanced') NOT NULL,
	`description` text NOT NULL,
	`patientPersona` text NOT NULL,
	`learningObjectives` json NOT NULL,
	`tags` json NOT NULL,
	`estimatedMinutes` int NOT NULL DEFAULT 10,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `scenarios_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `scores` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sessionId` int NOT NULL,
	`userId` int NOT NULL,
	`scenarioId` int NOT NULL,
	`activeListeningEmpathy` float NOT NULL,
	`informationGathering` float NOT NULL,
	`policyAdherence` float NOT NULL,
	`communicationClarity` float NOT NULL,
	`deEscalation` float NOT NULL,
	`overallScore` float NOT NULL,
	`overallGrade` varchar(2) NOT NULL,
	`wentWell` text NOT NULL,
	`areasForImprovement` text NOT NULL,
	`detailedFeedback` json NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `scores_id` PRIMARY KEY(`id`),
	CONSTRAINT `scores_sessionId_unique` UNIQUE(`sessionId`)
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`scenarioId` int NOT NULL,
	`status` enum('active','completed','abandoned') NOT NULL DEFAULT 'active',
	`startedAt` timestamp NOT NULL DEFAULT (now()),
	`completedAt` timestamp,
	`durationSeconds` int,
	CONSTRAINT `sessions_id` PRIMARY KEY(`id`)
);
