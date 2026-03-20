import { atlasIntegrations, atlasProjects } from "@superset/local-db";
import { desc, eq } from "drizzle-orm";
import { localDb } from "main/lib/local-db";
import { z } from "zod";
import { publicProcedure, router } from "../..";
import { decrypt } from "../auth/utils/crypto-storage";

async function getTokenForService(
	service: "neon" | "vercel",
): Promise<string | null> {
	const envKey = service === "neon" ? "NEON_API_KEY" : "VERCEL_TOKEN";
	const envToken = process.env[envKey];
	if (envToken) return envToken;

	const [integration] = await localDb
		.select()
		.from(atlasIntegrations)
		.where(eq(atlasIntegrations.service, service));
	if (!integration) return null;
	return decrypt(integration.encryptedToken);
}

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
				// 프로젝트 정보 조회
				const [project] = await localDb
					.select()
					.from(atlasProjects)
					.where(eq(atlasProjects.id, input.id));

				if (project) {
					// Neon 프로젝트 삭제
					if (project.neonProjectId) {
						try {
							const token = await getTokenForService("neon");
							if (token) {
								const res = await fetch(
									`https://console.neon.tech/api/v2/projects/${project.neonProjectId}`,
									{
										method: "DELETE",
										headers: {
											Authorization: `Bearer ${token}`,
											"Content-Type": "application/json",
										},
									},
								);
								if (!res.ok && res.status !== 404) {
									console.warn(`Neon 프로젝트 삭제 실패 (${res.status})`);
								}
							}
						} catch {
							// Neon 삭제 실패해도 로컬 삭제는 진행
						}
					}

					// Vercel 프로젝트 삭제
					if (project.vercelProjectId) {
						try {
							const token = await getTokenForService("vercel");
							if (token) {
								const res = await fetch(
									`https://api.vercel.com/v9/projects/${project.vercelProjectId}`,
									{
										method: "DELETE",
										headers: {
											Authorization: `Bearer ${token}`,
										},
									},
								);
								if (!res.ok && res.status !== 404) {
									console.warn(`Vercel 프로젝트 삭제 실패 (${res.status})`);
								}
							}
						} catch {
							// Vercel 삭제 실패해도 로컬 삭제는 진행
						}
					}
				}

				// 로컬 DB에서 삭제
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
