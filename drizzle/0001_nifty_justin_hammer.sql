CREATE TABLE `crm_accounts` (
	`company` text PRIMARY KEY NOT NULL,
	`since` text NOT NULL,
	FOREIGN KEY (`company`) REFERENCES `crm_companies`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `crm_activities` (
	`id` text PRIMARY KEY NOT NULL,
	`deal` text NOT NULL,
	`revision` integer NOT NULL,
	`author` text NOT NULL,
	`kind` text NOT NULL,
	`note` text NOT NULL,
	`at` text NOT NULL,
	FOREIGN KEY (`deal`) REFERENCES `crm_deals`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`author`) REFERENCES `crm_members`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `crm_activity_revision` ON `crm_activities` (`deal`,`revision`);--> statement-breakpoint
CREATE TABLE `crm_companies` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `crm_contacts` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`phone` text NOT NULL,
	`email` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `crm_deals` (
	`id` text PRIMARY KEY NOT NULL,
	`company` text,
	`contact` text,
	`owner` text NOT NULL,
	`stage` text NOT NULL,
	`status` text NOT NULL,
	`source` text NOT NULL,
	`service` text NOT NULL,
	`goal` text NOT NULL,
	`monthly` integer,
	`once` integer,
	`next` text NOT NULL,
	`due` text NOT NULL,
	`reason` text NOT NULL,
	`revision` integer NOT NULL,
	`updated` text NOT NULL,
	FOREIGN KEY (`company`) REFERENCES `crm_companies`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`contact`) REFERENCES `crm_contacts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`owner`) REFERENCES `crm_members`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `crm_handoffs` (
	`deal` text PRIMARY KEY NOT NULL,
	`company` text NOT NULL,
	`lead` text NOT NULL,
	`scope` text NOT NULL,
	`terms` text NOT NULL,
	`first` text NOT NULL,
	`date` text NOT NULL,
	FOREIGN KEY (`deal`) REFERENCES `crm_deals`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`company`) REFERENCES `crm_accounts`(`company`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`lead`) REFERENCES `crm_members`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `crm_members` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `crm_people` (
	`deal` text NOT NULL,
	`contact` text NOT NULL,
	PRIMARY KEY(`deal`, `contact`),
	FOREIGN KEY (`deal`) REFERENCES `crm_deals`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`contact`) REFERENCES `crm_contacts`(`id`) ON UPDATE no action ON DELETE no action
);
