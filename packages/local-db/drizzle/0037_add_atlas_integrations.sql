CREATE TABLE `atlas_integrations` (
	`id` text PRIMARY KEY NOT NULL,
	`service` text NOT NULL,
	`encrypted_token` blob NOT NULL,
	`metadata` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `atlas_integrations_service_unique` ON `atlas_integrations` (`service`);