import {
	index,
	jsonb,
	pgEnum,
	pgTable,
	text,
	timestamp,
	uuid,
	varchar,
} from "drizzle-orm/pg-core";

import { organizations, users } from "./auth";
import { composerProjectStatusValues } from "./enums";

export const composerProjectStatus = pgEnum(
	"composer_project_status",
	composerProjectStatusValues,
);

/**
 * Composer Projects — compose 파이프라인으로 생성한 프로젝트 추적
 */
export const composerProjects = pgTable(
	"composer_projects",
	{
		id: uuid().primaryKey().defaultRandom(),
		organizationId: uuid("organization_id")
			.notNull()
			.references(() => organizations.id, { onDelete: "cascade" }),
		createdById: uuid("created_by_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		name: varchar({ length: 200 }).notNull(),
		status: composerProjectStatus().notNull().default("scaffolding"),
		features: jsonb().$type<string[]>().notNull(),

		// GitHub
		githubRepoUrl: text("github_repo_url"),

		// Neon
		neonProjectId: varchar("neon_project_id", { length: 100 }),

		// Vercel — app
		vercelProjectId: varchar("vercel_project_id", { length: 100 }),
		vercelUrl: text("vercel_url"),

		// Vercel — server (API)
		vercelServerProjectId: varchar("vercel_server_project_id", { length: 100 }),
		vercelServerUrl: text("vercel_server_url"),

		// Vercel — admin
		vercelAdminProjectId: varchar("vercel_admin_project_id", { length: 100 }),
		vercelAdminUrl: text("vercel_admin_url"),

		// Vercel — landing
		vercelLandingProjectId: varchar("vercel_landing_project_id", { length: 100 }),
		vercelLandingUrl: text("vercel_landing_url"),

		// Owner
		ownerEmail: varchar("owner_email", { length: 255 }),

		// Error
		errorMessage: text("error_message"),

		createdAt: timestamp("created_at").notNull().defaultNow(),
		updatedAt: timestamp("updated_at")
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date()),
	},
	(table) => [
		index("composer_projects_org_idx").on(table.organizationId),
		index("composer_projects_status_idx").on(table.status),
		index("composer_projects_created_by_idx").on(table.createdById),
		index("composer_projects_created_at_idx").on(table.createdAt),
	],
);

export type InsertComposerProject = typeof composerProjects.$inferInsert;
export type SelectComposerProject = typeof composerProjects.$inferSelect;
