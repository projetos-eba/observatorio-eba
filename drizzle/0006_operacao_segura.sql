CREATE TABLE `integration_audit` (
	`id` text PRIMARY KEY NOT NULL,
	`brand` text NOT NULL,
	`provider` text NOT NULL,
	`resource` text NOT NULL,
	`action` text NOT NULL,
	`author` text NOT NULL,
	`at` text NOT NULL,
	FOREIGN KEY (`author`) REFERENCES `crm_members`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `integration_audit_history` ON `integration_audit` (`brand`,`provider`,`at`,`id`);--> statement-breakpoint
CREATE TABLE `workspace_permissions` (
	`member` text NOT NULL,
	`scope` text NOT NULL,
	`target` text NOT NULL,
	`grantedBy` text NOT NULL,
	`grantedAt` text NOT NULL,
	PRIMARY KEY(`member`, `scope`, `target`),
	FOREIGN KEY (`member`) REFERENCES `crm_members`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`grantedBy`) REFERENCES `crm_members`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
ALTER TABLE `crm_activities` ADD `fingerprint` text;--> statement-breakpoint
CREATE INDEX `crm_activity_kind_revision` ON `crm_activities` (`deal`,`kind`,`revision`);--> statement-breakpoint
CREATE INDEX `crm_deals_company_owner` ON `crm_deals` (`company`,`owner`);--> statement-breakpoint
CREATE INDEX `integration_runs_history` ON `integration_runs` (`brand`,`provider`,`started`,`id`);