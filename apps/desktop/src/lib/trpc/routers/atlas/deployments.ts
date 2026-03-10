import { z } from "zod";
import { desc, eq } from "drizzle-orm";
import { atlasProjects } from "@superset/local-db";
import { publicProcedure, router } from "../..";
import { localDb } from "main/lib/local-db";

export const createAtlasDeploymentsRouter = () =>
	router({
		list: publicProcedure.query(async () => {
			return localDb
				.select()
				.from(atlasProjects)
				.orderBy(desc(atlasProjects.createdAt));
		}),

		getById: publicProcedure
			.input(z.object({ id: z.string() }))
			.query(async ({ input }) => {
				const [project] = await localDb
					.select()
					.from(atlasProjects)
					.where(eq(atlasProjects.id, input.id));
				return project ?? null;
			}),

		delete: publicProcedure
			.input(z.object({ id: z.string() }))
			.mutation(async ({ input }) => {
				await localDb
					.delete(atlasProjects)
					.where(eq(atlasProjects.id, input.id));
				return { success: true };
			}),

		updateStatus: publicProcedure
			.input(
				z.object({
					id: z.string(),
					status: z.enum(["created", "deployed", "error"]),
				}),
			)
			.mutation(async ({ input }) => {
				await localDb
					.update(atlasProjects)
					.set({ status: input.status, updatedAt: Date.now() })
					.where(eq(atlasProjects.id, input.id));
				return { success: true };
			}),
	});
