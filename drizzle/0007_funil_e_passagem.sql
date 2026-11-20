ALTER TABLE `crm_activities` ADD `enteredStage` text;--> statement-breakpoint
ALTER TABLE `crm_activities` ADD `scheduledFor` text;--> statement-breakpoint
CREATE INDEX `crm_activity_period` ON `crm_activities` (`at`,`id`);--> statement-breakpoint
ALTER TABLE `crm_deals` ADD `proposalUrl` text;