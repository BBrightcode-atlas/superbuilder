CREATE TABLE `atlas_projects` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`local_path` text NOT NULL,
	`features` text NOT NULL,
	`git_initialized` integer DEFAULT false,
	`supabase_project_id` text,
	`supabase_project_url` text,
	`vercel_project_id` text,
	`vercel_url` text,
	`vercel_deployment_id` text,
	`status` text DEFAULT 'created' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `atlas_projects_status_idx` ON `atlas_projects` (`status`);--> statement-breakpoint
CREATE INDEX `atlas_projects_created_at_idx` ON `atlas_projects` (`created_at`);