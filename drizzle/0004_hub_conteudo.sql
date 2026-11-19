CREATE TABLE `hub_commands` (
	`version` integer PRIMARY KEY NOT NULL,
	`id` text NOT NULL,
	`author` text NOT NULL,
	`fingerprint` text NOT NULL,
	FOREIGN KEY (`author`) REFERENCES `crm_members`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `hub_commands_id_unique` ON `hub_commands` (`id`);--> statement-breakpoint
CREATE TABLE `hub_entries` (
	`brand` text NOT NULL,
	`kind` text NOT NULL,
	`id` text NOT NULL,
	`version` integer NOT NULL,
	`data` text NOT NULL,
	PRIMARY KEY(`brand`, `kind`, `id`, `version`),
	FOREIGN KEY (`version`) REFERENCES `hub_commands`(`version`) ON UPDATE no action ON DELETE no action
);
