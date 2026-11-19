CREATE TABLE `integration_connections` (
	`brand` text NOT NULL,
	`provider` text NOT NULL,
	`resource` text NOT NULL,
	`credential` text,
	`generation` text NOT NULL,
	`verifiedAt` text NOT NULL,
	`status` text NOT NULL,
	`error` text NOT NULL,
	`successDay` text NOT NULL,
	`retryAt` text NOT NULL,
	`attempts` integer NOT NULL,
	`lockId` text NOT NULL,
	`lockUntil` text NOT NULL,
	PRIMARY KEY(`brand`, `provider`)
);
--> statement-breakpoint
CREATE TABLE `integration_post_links` (
	`brand` text NOT NULL,
	`resource` text NOT NULL,
	`media` text NOT NULL,
	`publication` text NOT NULL,
	`author` text NOT NULL,
	`at` text NOT NULL,
	PRIMARY KEY(`brand`, `resource`, `media`),
	FOREIGN KEY (`author`) REFERENCES `crm_members`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `integration_publication_unique` ON `integration_post_links` (`brand`,`publication`);--> statement-breakpoint
CREATE TABLE `integration_readings` (
	`brand` text NOT NULL,
	`provider` text NOT NULL,
	`resource` text NOT NULL,
	`day` text NOT NULL,
	`id` text NOT NULL,
	`data` text NOT NULL,
	PRIMARY KEY(`brand`, `provider`, `resource`, `day`, `id`)
);
--> statement-breakpoint
CREATE TABLE `integration_resources` (
	`brand` text NOT NULL,
	`provider` text NOT NULL,
	`id` text NOT NULL,
	`data` text NOT NULL,
	`syncedAt` text NOT NULL,
	`fromDay` text NOT NULL,
	`throughDay` text NOT NULL,
	PRIMARY KEY(`brand`, `provider`, `id`)
);
--> statement-breakpoint
CREATE TABLE `integration_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`brand` text NOT NULL,
	`provider` text NOT NULL,
	`resource` text NOT NULL,
	`started` text NOT NULL,
	`finished` text NOT NULL,
	`trigger` text NOT NULL,
	`status` text NOT NULL,
	`detail` text NOT NULL
);
