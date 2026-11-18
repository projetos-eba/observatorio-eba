CREATE TABLE `store_entries` (
	`collection` text NOT NULL,
	`id` text NOT NULL,
	`data` text NOT NULL,
	`revision` integer NOT NULL,
	PRIMARY KEY(`collection`, `id`)
);
