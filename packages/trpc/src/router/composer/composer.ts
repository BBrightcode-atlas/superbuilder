import { db } from "@superset/db/client";
import {
	composerProjectStatusValues,
	composerProjects,
} from "@superset/db/schema";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../../trpc";

export const composerRouter = createTRPCRouter({
	create: protectedProcedure
		.input(
			z.object({
				name: z.string().min(1).max(200),
				features: z.array(z.string()),
				ownerEmail: z.string().email().optional(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const orgId = ctx.session.session.activeOrganizationId;
			if (!orgId) {
				throw new Error("No active organization");
			}

			const [project] = await db
				.insert(composerProjects)
				.values({
					organizationId: orgId,
					createdById: ctx.session.user.id,
					name: input.name,
					status: "scaffolding",
					features: input.features,
					ownerEmail: input.ownerEmail,
				})
				.returning();

			return project;
		}),

	update: protectedProcedure
		.input(
			z.object({
				id: z.string().uuid(),
				status: z.enum(composerProjectStatusValues).optional(),
				features: z.array(z.string()).optional(),
				githubRepoUrl: z.string().optional(),
				neonProjectId: z.string().optional(),
				vercelProjectId: z.string().optional(),
				vercelUrl: z.string().optional(),
				vercelServerProjectId: z.string().optional(),
				vercelServerUrl: z.string().optional(),
				vercelAdminProjectId: z.string().optional(),
				vercelAdminUrl: z.string().optional(),
				vercelLandingProjectId: z.string().optional(),
				vercelLandingUrl: z.string().optional(),
				ownerEmail: z.string().optional(),
				errorMessage: z.string().nullable().optional(),
			}),
		)
		.mutation(async ({ input }) => {
			const { id, ...updates } = input;
			// Filter out undefined values
			const setValues: Record<string, unknown> = {};
			for (const [key, value] of Object.entries(updates)) {
				if (value !== undefined) {
					setValues[key] = value;
				}
			}

			if (Object.keys(setValues).length === 0) return { success: true };

			await db
				.update(composerProjects)
				.set(setValues)
				.where(eq(composerProjects.id, id));

			return { success: true };
		}),

	list: protectedProcedure.query(async ({ ctx }) => {
		const orgId = ctx.session.session.activeOrganizationId;
		if (!orgId) return [];

		return db
			.select()
			.from(composerProjects)
			.where(eq(composerProjects.organizationId, orgId))
			.orderBy(desc(composerProjects.createdAt));
	}),

	getById: protectedProcedure
		.input(z.object({ id: z.string().uuid() }))
		.query(async ({ input }) => {
			const [project] = await db
				.select()
				.from(composerProjects)
				.where(eq(composerProjects.id, input.id));

			return project ?? null;
		}),

	delete: protectedProcedure
		.input(z.object({ id: z.string().uuid() }))
		.mutation(async ({ input }) => {
			await db
				.delete(composerProjects)
				.where(eq(composerProjects.id, input.id));

			return { success: true };
		}),
});
