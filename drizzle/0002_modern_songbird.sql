CREATE UNIQUE INDEX `crm_contact_email` ON `crm_contacts` (`email`) WHERE email <> '';--> statement-breakpoint
CREATE UNIQUE INDEX `crm_contact_phone` ON `crm_contacts` (`phone`) WHERE phone <> '';