CREATE TABLE `carteira_agenda` (
	`week` text NOT NULL,
	`company` text NOT NULL,
	PRIMARY KEY(`week`, `company`),
	FOREIGN KEY (`company`) REFERENCES `crm_accounts`(`company`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `carteira_commands` (
	`version` integer PRIMARY KEY NOT NULL,
	`id` text NOT NULL,
	`author` text NOT NULL,
	`fingerprint` text NOT NULL,
	FOREIGN KEY (`author`) REFERENCES `crm_members`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `carteira_commands_id_unique` ON `carteira_commands` (`id`);--> statement-breakpoint
CREATE TABLE `carteira_decisions` (
	`id` text NOT NULL,
	`company` text NOT NULL,
	`version` integer NOT NULL,
	`data` text NOT NULL,
	PRIMARY KEY(`id`, `version`),
	FOREIGN KEY (`company`) REFERENCES `crm_accounts`(`company`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`version`) REFERENCES `carteira_commands`(`version`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `carteira_measures` (
	`company` text NOT NULL,
	`week` text NOT NULL,
	`version` integer NOT NULL,
	`data` text NOT NULL,
	PRIMARY KEY(`company`, `week`, `version`),
	FOREIGN KEY (`company`) REFERENCES `crm_accounts`(`company`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`version`) REFERENCES `carteira_commands`(`version`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `carteira_minutes` (
	`week` text PRIMARY KEY NOT NULL,
	`data` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `carteira_profiles` (
	`company` text PRIMARY KEY NOT NULL,
	`data` text NOT NULL,
	FOREIGN KEY (`company`) REFERENCES `crm_accounts`(`company`) ON UPDATE no action ON DELETE no action
);
